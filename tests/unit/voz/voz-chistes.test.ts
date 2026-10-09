import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  AVISO_SIN_VOZ,
  crearLocutor,
  elegirVoz,
  FACTOR_MUSICA_HABLANDO,
  sanearPreferenciaVoz,
  type MotorVoz,
  type OpcionesHabla,
  type VozSistema,
} from "@/juego/audio/voz";
import { TIMBRE_POR_VOZ } from "@/contenido/vocesPersonajes";
import { VOCES_BROMAS } from "@/contenido/bancoBromas";
import { PERSONALIDADES } from "@/sim/ia/personalidades";

const voz = (lang: string, localService: boolean, name = lang): VozSistema => ({ name, lang, localService });

// voz-3: la elección nunca devuelve otro idioma ni una voz remota.
test("voz-3: [en-US local] → null; [es-ES remota] → null; [es-MX local] → es-MX", () => {
  assert.equal(elegirVoz([voz("en-US", true)]), null);
  assert.equal(elegirVoz([voz("es-ES", false)]), null);
  assert.equal(elegirVoz([voz("es-MX", true)])?.lang, "es-MX");
  assert.equal(elegirVoz([voz("es_ES", true)])?.lang, "es_ES");
  assert.equal(elegirVoz([voz("est-EE", true)]), null);
  assert.equal(elegirVoz([voz("es-MX", true), voz("es-ES", true)])?.lang, "es-ES");
  assert.equal(elegirVoz([]), null);
});

// Invariante: para cualquier lista de voces, null o es-* local.
test("invariante: la voz elegida es null o es-* con localService", () => {
  const arbVoz = fc.record({
    name: fc.string(),
    lang: fc.oneof(fc.constantFrom("es-ES", "es-MX", "es_AR", "es", "en-US", "est-EE", "fr-FR", "ES-es", ""), fc.string()),
    localService: fc.boolean(),
  });
  fc.assert(
    fc.property(fc.array(arbVoz, { maxLength: 12 }), (voces) => {
      const elegida = elegirVoz(voces);
      if (elegida === null) return true;
      return /^es([-_]|$)/i.test(elegida.lang) && elegida.localService === true && voces.includes(elegida);
    }),
    { numRuns: 300 },
  );
});

test("la preferencia solo se desactiva con exactamente «false»", () => {
  assert.equal(sanearPreferenciaVoz("false"), false);
  for (const bruto of [null, "true", "quizas", "", "0", undefined]) assert.equal(sanearPreferenciaVoz(bruto), true);
});

interface Banco {
  readonly orden: string[];
  readonly factores: number[];
  readonly pendientes: OpcionesHabla[];
  readonly almacen: { valor: unknown; guardado: boolean | null };
  readonly motor: MotorVoz;
  desbloqueos: number;
}

function crearBanco(voces: readonly VozSistema[], preferencia: unknown = null): Banco {
  const banco: Banco = {
    orden: [],
    factores: [],
    pendientes: [],
    almacen: { valor: preferencia, guardado: null },
    desbloqueos: 0,
    motor: {
      iniciar: async () => voces,
      hablar: (opciones) => {
        banco.orden.push("speak");
        banco.pendientes.push(opciones);
      },
      cancelar: () => {
        banco.orden.push("cancel");
        banco.pendientes.length = 0;
      },
    },
  };
  return banco;
}

async function locutorListo(banco: Banco) {
  const locutor = crearLocutor({
    motor: banco.motor,
    atenuarMusica: (factor) => banco.factores.push(factor),
    leerPreferencia: () => banco.almacen.valor,
    guardarPreferencia: (activada) => {
      banco.almacen.guardado = activada;
    },
    desbloquear: () => {
      banco.desbloqueos += 1;
    },
  });
  locutor.iniciar();
  await new Promise((resolver) => setImmediate(resolver));
  return locutor;
}

test("voz-1: el chiste se pide con la voz es-ES y el timbre del personaje, tras un cancel", async () => {
  const banco = crearBanco([voz("en-US", true), voz("es-ES", true)]);
  const locutor = await locutorListo(banco);
  locutor.hablar("almirante-bisagra", "Un chiste");
  assert.deepEqual(banco.orden, ["cancel", "speak"]);
  const [opciones] = banco.pendientes;
  assert.equal(opciones.text, "Un chiste");
  assert.equal(opciones.lang, "es-ES");
  assert.equal(opciones.rate, TIMBRE_POR_VOZ["almirante-bisagra"].rate);
  assert.equal(opciones.pitch, TIMBRE_POR_VOZ["almirante-bisagra"].pitch);
  assert.equal(banco.desbloqueos, 1);
});

// Invariante: nunca hay más de un utterance vivo; cada speak va tras un cancel.
test("invariante: para cualquier secuencia de chistes, cada speak va precedido de cancel y hay uno vivo", async () => {
  const banco = crearBanco([voz("es-ES", true)]);
  const locutor = await locutorListo(banco);
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.tuple(fc.constantFrom(...VOCES_BROMAS), fc.string({ minLength: 1 }).filter((t) => t.trim() !== "")), { maxLength: 20 }),
      async (chistes) => {
        banco.orden.length = 0;
        for (const [personaje, texto] of chistes) {
          locutor.hablar(personaje, texto);
          if (banco.pendientes.length > 1) return false;
        }
        banco.orden.forEach((llamada, i) => {
          if (llamada === "speak" && banco.orden[i - 1] !== "cancel") throw new Error("speak sin cancel");
        });
        return banco.pendientes.length <= 1;
      },
    ),
    { numRuns: 100 },
  );
});

test("voz-3: sin voz castellana local no se habla, se avisa una vez y se deshabilita", async () => {
  const banco = crearBanco([voz("en-US", true), voz("es-ES", false)]);
  const locutor = await locutorListo(banco);
  locutor.hablar("chispa", "Hola");
  locutor.iniciar();
  assert.deepEqual(banco.orden, []);
  assert.deepEqual(locutor.estado(), { activada: true, disponibilidad: "no", aviso: AVISO_SIN_VOZ });
});

test("voz-3: si easy-speech falla al iniciar, el juego sigue en texto", async () => {
  const banco = crearBanco([]);
  const roto: MotorVoz = { ...banco.motor, iniciar: async () => Promise.reject(new Error("sin síntesis")) };
  const locutor = crearLocutor({
    motor: roto,
    atenuarMusica: () => undefined,
    leerPreferencia: () => null,
    guardarPreferencia: () => undefined,
    desbloquear: () => undefined,
  });
  locutor.iniciar();
  await new Promise((resolver) => setImmediate(resolver));
  assert.equal(locutor.estado().disponibilidad, "no");
});

test("voz-2: silenciada no habla y la elección se guarda; 'quizas' arranca activada", async () => {
  const banco = crearBanco([voz("es-ES", true)], "false");
  const locutor = await locutorListo(banco);
  locutor.hablar("chispa", "Hola");
  assert.deepEqual(banco.orden, []);
  assert.equal(banco.desbloqueos, 0);
  assert.equal(locutor.alternar(), true);
  assert.equal(banco.almacen.guardado, true);
  assert.equal(locutor.alternar(), false);
  assert.equal(banco.almacen.guardado, false);
  assert.equal((await locutorListo(crearBanco([voz("es-ES", true)], "quizas"))).estado().activada, true);
});

test("voz-4: la música baja a 0,35 al empezar y vuelve a 1 al terminar o fallar", async () => {
  const banco = crearBanco([voz("es-ES", true)]);
  const locutor = await locutorListo(banco);
  locutor.hablar("chispa", "Uno");
  banco.pendientes[0].start();
  assert.deepEqual(banco.factores, [FACTOR_MUSICA_HABLANDO]);
  banco.pendientes[0].end();
  assert.deepEqual(banco.factores, [FACTOR_MUSICA_HABLANDO, 1]);
  locutor.hablar("chispa", "Dos");
  banco.pendientes[0].start();
  banco.pendientes[0].error();
  assert.equal(banco.factores.at(-1), 1);
});

test("voz-4: el fin tardío de un chiste cancelado no sube la música del siguiente", async () => {
  const banco = crearBanco([voz("es-ES", true)]);
  const locutor = await locutorListo(banco);
  locutor.hablar("chispa", "Uno");
  const primero = banco.pendientes[0];
  primero.start();
  locutor.hablar("chispa", "Dos");
  banco.pendientes[0].start();
  const antes = banco.factores.length;
  primero.error();
  assert.equal(banco.factores.length, antes);
  assert.equal(banco.factores.at(-1), FACTOR_MUSICA_HABLANDO);
});

test("callar corta el chiste y devuelve la música", async () => {
  const banco = crearBanco([voz("es-ES", true)]);
  const locutor = await locutorListo(banco);
  locutor.hablar("chispa", "Uno");
  banco.pendientes[0].start();
  locutor.callar();
  assert.equal(banco.orden.at(-1), "cancel");
  assert.equal(banco.factores.at(-1), 1);
});

test("voz-5: cada personalidad tiene timbre propio dentro de rango y sin pares repetidos", () => {
  const ids = new Set<string>(VOCES_BROMAS);
  for (const personalidad of PERSONALIDADES) assert.ok(ids.has(personalidad.id), personalidad.id);
  const pares = new Set<string>();
  for (const id of VOCES_BROMAS) {
    const { rate, pitch } = TIMBRE_POR_VOZ[id];
    assert.ok(rate >= 0.9 && rate <= 1.2, `${id} rate`);
    assert.ok(pitch >= 0.8 && pitch <= 1.4, `${id} pitch`);
    pares.add(`${rate}/${pitch}`);
  }
  assert.equal(pares.size, VOCES_BROMAS.length);
});

test("voz-6: easy-speech está fijada a 2.4.0 sin ^ ni ~", async () => {
  const { readFileSync } = await import("node:fs");
  const paquete = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };
  assert.equal(paquete.dependencies["easy-speech"], "2.4.0");
});
