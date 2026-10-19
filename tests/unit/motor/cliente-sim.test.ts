import { mock, test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { ClienteSim, type TrabajadorLike } from "@/juego/motor/clienteSim";
import type { Peticion, Respuesta } from "@/juego/motor/protocolo";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { MedidorRespuesta } from "@/juego/rendimiento/medidorRespuesta";

const PREVIS = {
  tipo: "previsualizar",
  mascara: crearMascaraVacia(40, 40),
  gravedad: 1,
  deriva: 0,
  ancho: 40,
  alto: 40,
  tirador: 0,
  origenX: 10,
  origenY: 10,
  anguloGrados: 45,
  potencia: 50,
  armaId: "pepinazo-cortesia",
  aleatorio: crearEstadoAleatorio(1),
} as const;

// Un trabajador falso que guarda las peticiones y deja al test decidir en qué
// orden y si contesta.
function trabajadorManual() {
  const recibidas: Peticion[] = [];
  const t: TrabajadorLike & { responder(r: Respuesta): void } = {
    onmessage: null,
    onerror: null,
    postMessage: (p) => void recibidas.push(p),
    terminate: () => undefined,
    responder(r) {
      t.onmessage?.({ data: r } as MessageEvent<Respuesta>);
    },
  };
  return { t, recibidas };
}

const respuestaPrevis = (p: Peticion): Respuesta => ({
  tipo: "previsualizar",
  idPeticion: p.idPeticion,
  idPartida: p.idPartida,
  resultado: { banda: { centro: [], extremoMenor: [], extremoMayor: [], amplitudGrados: 0 }, duracionMs: 1 },
});

test("res-2: una respuesta antigua se descarta y la última se aplica", async () => {
  const { t, recibidas } = trabajadorManual();
  const cliente = new ClienteSim(() => t);
  assert.equal(cliente.modo, "trabajador");
  const primera = cliente.previsualizar(PREVIS);
  const segunda = cliente.previsualizar({ ...PREVIS, anguloGrados: 50 });
  // La segunda espera en el cliente: el trabajador solo tiene una en cola.
  assert.equal(recibidas.length, 1);
  t.responder(respuestaPrevis(recibidas[0]));
  assert.equal(await primera, null);
  assert.equal(recibidas.length, 2);
  t.responder(respuestaPrevis(recibidas[1]));
  assert.notEqual(await segunda, null);
  cliente.terminar();
});

test("rsp-5: 50 previsualizaciones seguidas dejan como mucho 2 en el trabajador y la última se resuelve", async () => {
  const { t, recibidas } = trabajadorManual();
  const cliente = new ClienteSim(() => t);
  const todas = Array.from({ length: 50 }, (_, i) => cliente.previsualizar({ ...PREVIS, anguloGrados: i }));
  t.responder(respuestaPrevis(recibidas[0]));
  await todas[0];
  t.responder(respuestaPrevis(recibidas[1]));
  const resultados = await Promise.all(todas);
  assert.equal(recibidas.length, 2);
  assert.equal((recibidas[1] as { anguloGrados: number }).anguloGrados, 49);
  assert.notEqual(resultados[49], null);
  assert.ok(resultados.slice(0, 49).every((r) => r === null));
  cliente.terminar();
});

test("rsp-5: un resolverImpacto enviado después solo espera a una previsualización", async () => {
  const { t, recibidas } = trabajadorManual();
  const cliente = new ClienteSim(() => t);
  for (let i = 0; i < 10; i++) void cliente.previsualizar({ ...PREVIS, anguloGrados: i });
  void cliente.resolverImpacto({ tipo: "resolverImpacto", estado: {} as never, entrada: {} as never });
  // En el trabajador: la previsualización en vuelo y, detrás, el resolverImpacto;
  // las otras nueve no se han enviado.
  assert.deepEqual(recibidas.map((p) => p.tipo), ["previsualizar", "resolverImpacto"]);
  cliente.terminar();
});

test("res-2: una respuesta de la partida anterior se descarta", async () => {
  const { t, recibidas } = trabajadorManual();
  const cliente = new ClienteSim(() => t);
  const vieja = cliente.previsualizar(PREVIS);
  cliente.nuevaPartida();
  t.responder(respuestaPrevis(recibidas[0]));
  assert.equal(await vieja, null);
  cliente.terminar();
});

test("res-4: sin Worker, el cliente resuelve en línea con el mismo resultado", async () => {
  const cliente = new ClienteSim(null);
  assert.equal(cliente.modo, "en-linea");
  const resultado = await cliente.previsualizar(PREVIS);
  assert.ok(resultado && resultado.banda.centro.length > 0);
});

test("res-4: si crear el Worker lanza, el cliente cae a en-línea y lo registra", () => {
  const cliente = new ClienteSim(() => {
    throw new Error("sin módulos en este navegador");
  });
  assert.equal(cliente.modo, "en-linea");
  assert.match(cliente.motivoEnLinea ?? "", /sin módulos/);
});

test("res-4: si el Worker falla con una petición en vuelo, se resuelve en línea", async () => {
  const { t } = trabajadorManual();
  const cliente = new ClienteSim(() => t);
  const pendiente = cliente.previsualizar(PREVIS);
  t.onerror?.(new Event("error"));
  assert.equal(cliente.modo, "en-linea");
  const resultado = await pendiente;
  assert.ok(resultado && resultado.banda.centro.length > 0);
});

test("res-1: el medidor guarda la interacción y su peor duración es el INP", () => {
  const m = new MedidorRespuesta();
  m.registrar({ tipo: "click", objetivo: "button[a]", retrasoEntrada: 3, duracion: 40 });
  m.registrar({ tipo: "pointerdown", objetivo: "canvas", retrasoEntrada: 1, duracion: 120 });
  const i = m.instantanea();
  assert.equal(i.interacciones.length, 2);
  assert.equal(i.inp, 120);
});

test("res-5: un trabajador que sigue contestando no se abandona por una petición lenta", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let ahora = 0;
    const { t } = trabajadorManual();
    const cliente = new ClienteSim(() => t, () => ahora);
    void cliente.previsualizar(PREVIS);
    ahora = 50_000;
    t.responder({ tipo: "previsualizar", idPeticion: 999, idPartida: cliente["idPartida"], resultado: { banda: null, duracionMs: 1 } } as unknown as Respuesta);
    ahora = 61_000;
    mock.timers.tick(61_000);
    assert.equal(cliente.modo, "trabajador");
  } finally {
    mock.timers.reset();
  }
});

test("res-5: un trabajador mudo más allá del límite pasa a en línea", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let ahora = 0;
    const { t } = trabajadorManual();
    const cliente = new ClienteSim(() => t, () => ahora);
    void cliente.previsualizar(PREVIS);
    ahora = 61_000;
    mock.timers.tick(61_000);
    assert.equal(cliente.modo, "en-linea");
  } finally {
    mock.timers.reset();
  }
});

test("rsp-5: para cualquier secuencia de previsualizar y respuestas hay como mucho 1 sin responder y la última pedida se resuelve", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 40 }), async (pasos) => {
      const { t, recibidas } = trabajadorManual();
      const cliente = new ClienteSim(() => t);
      try {
        const respondidas = new Set<number>();
        const promesas: Promise<unknown>[] = [];
        pasos.forEach((pedir, i) => {
          if (pedir) promesas.push(cliente.previsualizar({ ...PREVIS, anguloGrados: i }));
          else {
            const sinResponder = recibidas.find((p) => !respondidas.has(p.idPeticion));
            if (sinResponder) {
              respondidas.add(sinResponder.idPeticion);
              t.responder(respuestaPrevis(sinResponder));
            }
          }
          assert.ok(recibidas.filter((p) => !respondidas.has(p.idPeticion)).length <= 1);
        });
        const ultima = promesas.at(-1);
        // Se contesta lo que quede para cerrar la secuencia.
        for (let ronda = 0; ronda < 60 && ultima !== undefined; ronda++) {
          await new Promise((seguir) => setImmediate(seguir));
          const sinResponder = recibidas.find((p) => !respondidas.has(p.idPeticion));
          if (!sinResponder) break;
          respondidas.add(sinResponder.idPeticion);
          t.responder(respuestaPrevis(sinResponder));
          await new Promise((seguir) => setImmediate(seguir));
        }
        if (ultima !== undefined) assert.notEqual(await ultima, null);
      } finally {
        cliente.terminar();
      }
    }),
    { numRuns: 100, seed: 5, endOnFailure: true },
  );
});
