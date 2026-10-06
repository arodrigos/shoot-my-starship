import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import fc from "fast-check";
import {
  COMPASES_POR_CICLO,
  COMPAS_S,
  MAX_VOCES_MUSICA,
  crearProgramador,
  notasDeCompas,
  sanearPreferenciaMusica,
} from "@/juego/audio/musica";
import { crearEstadoAleatorio, siguienteAleatorio } from "@/sim/aleatorio";

interface NotaAgendada {
  readonly inicio: number;
  readonly fin: number;
}

// AudioContext falso con reloj manual: registra cada oscilador que se agenda
// para poder contar cuántos viven a la vez sin depender de tiempo real.
class ContextoFalso {
  static construcciones = 0;
  currentTime = 0;
  state: "running" | "suspended" = "suspended";
  destination = {};
  agendadas: NotaAgendada[] = [];
  constructor() {
    ContextoFalso.construcciones += 1;
  }
  resume(): Promise<void> {
    this.state = "running";
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = "suspended";
    return Promise.resolve();
  }
  createGain() {
    const param = {
      value: 0,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
      cancelScheduledValues() {},
    };
    return { gain: param, connect: (destino: unknown) => destino };
  }
  createOscillator() {
    const nota = { inicio: 0, fin: 0 };
    const agendadas = this.agendadas;
    return {
      type: "sine",
      frequency: { value: 0 },
      connect: (destino: unknown) => destino,
      start(t: number) {
        nota.inicio = t;
        agendadas.push(nota);
      },
      stop(t?: number) {
        if (t !== undefined) nota.fin = t;
      },
    };
  }
}

function simular(segundos: number, paso: number): ContextoFalso {
  const contexto = new ContextoFalso();
  contexto.state = "running";
  const programador = crearProgramador(contexto as unknown as AudioContext);
  programador.iniciar();
  for (let t = 0; t <= segundos; t += paso) {
    contexto.currentTime = t;
    programador.pasada();
  }
  programador.detener();
  return contexto;
}

function maximoSimultaneo(agendadas: readonly NotaAgendada[]): number {
  return Math.max(0, ...agendadas.map((a) => agendadas.filter((b) => b.inicio <= a.inicio && b.fin > a.inicio).length));
}

// mus-3: el periodo mínimo de repetición exacta de la secuencia de notas.
test("mus-3: la secuencia de notas no repite exactamente un fragmento en menos de 60 s", () => {
  const compases = Array.from({ length: COMPASES_POR_CICLO * 3 }, (_v, i) => JSON.stringify(notasDeCompas(i)));
  let periodo = 1;
  while (!compases.every((c, i) => i + periodo >= compases.length || c === compases[i + periodo])) periodo += 1;
  assert.ok(periodo * COMPAS_S >= 60, `periodo de ${periodo * COMPAS_S} s`);
  // Y la composición es determinista: el mismo compás da siempre las mismas notas.
  assert.deepEqual(notasDeCompas(5), notasDeCompas(5));
});

// mus-2 + invariante de voces: en 60 s simulados nunca hay más de 8 vivas.
test("mus-2: en 60 s simulados las voces vivas son siempre ≤ 8", () => {
  const contexto = simular(60, 0.025);
  assert.ok(contexto.agendadas.length > 60, "la música tiene que programar notas");
  assert.ok(maximoSimultaneo(contexto.agendadas) <= MAX_VOCES_MUSICA);
});

test("invariante: con cualquier paso de reloj las voces vivas son ≤ 8", () => {
  fc.assert(
    fc.property(fc.double({ min: 0.005, max: 0.5, noNaN: true }), fc.integer({ min: 5, max: 90 }), (paso, segundos) => {
      const contexto = simular(segundos, paso);
      assert.ok(maximoSimultaneo(contexto.agendadas) <= MAX_VOCES_MUSICA);
    }),
    { numRuns: 40 },
  );
});

test("invariante: cualquier valor guardado distinto de '0' y '1' lee la preferencia por defecto (activada) sin lanzar", () => {
  fc.assert(
    fc.property(fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined), fc.integer()), (bruto) => {
      fc.pre(bruto !== "0" && bruto !== "1");
      assert.equal(sanearPreferenciaMusica(bruto), true);
    }),
  );
  assert.equal(sanearPreferenciaMusica("0"), false);
  assert.equal(sanearPreferenciaMusica("1"), true);
});

// El generador usa su propio PRNG: generar música no puede mover la secuencia
// de la partida, que vive en EstadoAleatorio.
test("invariante: generar música no consume EstadoAleatorio", () => {
  const origen = readFileSync("src/juego/audio/musica.ts", "utf8");
  assert.doesNotMatch(origen, /^import .*(EstadoAleatorio|siguienteAleatorio|crearEstadoAleatorio)/m);
  fc.assert(
    fc.property(fc.integer(), fc.integer({ min: 1, max: 50 }), fc.integer({ min: 0, max: 100 }), (semilla, pasos, compases) => {
      const secuencia = (conMusica: boolean): number[] => {
        let estado = crearEstadoAleatorio(semilla);
        const valores: number[] = [];
        for (let i = 0; i < pasos; i += 1) {
          if (conMusica) notasDeCompas(compases + i);
          const paso = siguienteAleatorio(estado);
          valores.push(paso.valor);
          estado = paso.estado;
        }
        return valores;
      };
      assert.deepEqual(secuencia(true), secuencia(false));
    }),
  );
});

// Los dos invariantes que dependen de motor.ts comparten su estado global:
// se instalan los globales falsos antes de importarlo, y el de "sin gesto"
// va primero porque cualquier alternar posterior ya es un gesto.
const almacen = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => void almacen.set(k, v),
    },
  },
  AudioContext: ContextoFalso,
});

test("invariante: sin gesto del usuario no se construye ningún AudioContext ni se programa una nota", async () => {
  const motor = await import("@/juego/audio/motor");
  ContextoFalso.construcciones = 0;
  fc.assert(
    fc.property(fc.array(fc.constantFrom("pausa", "reanuda", "leer-estado", "leer-musica", "leer-silencio")), (eventos) => {
      for (const evento of eventos) {
        if (evento === "pausa") motor.pausarAudio();
        if (evento === "reanuda") motor.reanudarAudio();
        if (evento === "leer-estado") motor.estadoMusica();
        if (evento === "leer-musica") motor.musicaActivada();
        if (evento === "leer-silencio") motor.sonidoSilenciado();
      }
      assert.equal(ContextoFalso.construcciones, 0);
      assert.deepEqual(motor.estadoMusica(), { estado: "esperando-gesto", notasProgramadas: 0, vocesActivas: 0 });
    }),
  );
  // Con el gesto (desbloquearAudio solo se llama desde uno) sí se crea.
  motor.desbloquearAudio();
  assert.equal(ContextoFalso.construcciones, 1);
  assert.equal(motor.estadoMusica().estado, "sonando");
});

test("invariante: pulsar un control no cambia el estado del otro", async () => {
  const motor = await import("@/juego/audio/motor");
  fc.assert(
    fc.property(fc.array(fc.constantFrom("musica", "efectos"), { maxLength: 30 }), (pulsaciones) => {
      for (const pulsacion of pulsaciones) {
        const musicaAntes = motor.musicaActivada();
        const silencioAntes = motor.sonidoSilenciado();
        if (pulsacion === "musica") {
          motor.alternarMusica();
          assert.equal(motor.musicaActivada(), !musicaAntes);
          assert.equal(motor.sonidoSilenciado(), silencioAntes);
        } else {
          motor.alternarSonido();
          assert.equal(motor.sonidoSilenciado(), !silencioAntes);
          assert.equal(motor.musicaActivada(), musicaAntes);
        }
      }
    }),
  );
  assert.equal(almacen.get("banda-sonora:activada"), motor.musicaActivada() ? "1" : "0");
});

// El temporizador del programador mantendría vivo el proceso de node.
after(async () => {
  const motor = await import("@/juego/audio/motor");
  if (motor.musicaActivada()) motor.alternarMusica();
});
