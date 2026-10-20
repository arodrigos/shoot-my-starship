import { after, mock, test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { BPM_TENSO, COMPAS_S, MAX_VOCES_MUSICA, crearProgramador } from "@/juego/audio/musica";
import {
  CIERRES_PARA_BAJAR,
  HISTERESIS_INICIAL,
  nivelTension,
  siguienteHisteresis,
  type EstadoHisteresis,
  type NivelTension,
  type SenalesTension,
} from "@/juego/audio/tension";

const SENALES_BASE: SenalesTension = { muerteSubita: false, integridadesVivas: [100, 80, 60], vivas: 3 };

// mus-1: los niveles previstos y sus límites.
test("mus-1: aviso de muerte súbita → 1; más una nave al 20 % → 2; más un duelo → 3", () => {
  assert.equal(nivelTension(SENALES_BASE), 0);
  assert.equal(nivelTension({ ...SENALES_BASE, muerteSubita: true }), 1);
  assert.equal(nivelTension({ ...SENALES_BASE, muerteSubita: true, integridadesVivas: [20, 100, 60] }), 2);
  assert.equal(nivelTension({ muerteSubita: true, integridadesVivas: [20, 100], vivas: 2 }), 3);
});

test("mus-1: el 25 % exacto cuenta como vida baja y una nave muerta no", () => {
  assert.equal(nivelTension({ ...SENALES_BASE, integridadesVivas: [25, 100, 60] }), 1);
  assert.equal(nivelTension({ ...SENALES_BASE, integridadesVivas: [0, 100, 60] }), 0);
  assert.equal(nivelTension({ ...SENALES_BASE, integridadesVivas: [26, 100, 60] }), 0);
});

const senales = fc.record({
  muerteSubita: fc.boolean(),
  integridadesVivas: fc.array(fc.double({ min: 0, max: 100, noNaN: true }), { maxLength: 4 }),
  vivas: fc.integer({ min: 0, max: 4 }),
});

test("invariante: nivelTension es un entero en [0,3] y añadir una señal nunca lo baja", () => {
  fc.assert(
    fc.property(senales, (s) => {
      const nivel = nivelTension(s);
      assert.ok(Number.isInteger(nivel) && nivel >= 0 && nivel <= 3);
      assert.ok(nivelTension({ ...s, muerteSubita: true }) >= nivel);
      assert.ok(nivelTension({ ...s, integridadesVivas: [...s.integridadesVivas, 10] }) >= nivel);
      // Quedar en duelo es una señal más, pero solo si antes no lo estaba.
      if (s.vivas !== 2) assert.ok(nivelTension({ ...s, vivas: 2 }) >= nivel);
    }),
  );
});

function aplicarSecuencia(niveles: readonly NivelTension[]): NivelTension[] {
  let estado: EstadoHisteresis = HISTERESIS_INICIAL;
  return niveles.map((nivel) => {
    estado = siguienteHisteresis(estado, nivel);
    return estado.aplicado;
  });
}

test("mus-1-niveles: 3,3,1,1,1 mantiene 3 en el primer turno con 1 y baja a 1 en el segundo", () => {
  assert.deepEqual(aplicarSecuencia([3, 3, 1, 1, 1]), [3, 3, 3, 1, 1]);
  assert.equal(CIERRES_PARA_BAJAR, 2);
});

test("invariante: el nivel aplicado solo baja tras 2 cierres seguidos con nivel menor", () => {
  const nivel = fc.constantFrom<NivelTension>(0, 1, 2, 3);
  fc.assert(
    fc.property(fc.array(nivel, { minLength: 1, maxLength: 40 }), (secuencia) => {
      const aplicados = aplicarSecuencia(secuencia);
      secuencia.forEach((crudo, i) => {
        const antes = i === 0 ? HISTERESIS_INICIAL.aplicado : aplicados[i - 1];
        if (crudo > antes) assert.equal(aplicados[i], crudo, "sube de inmediato");
        if (aplicados[i] < antes) {
          assert.ok(i >= 1 && secuencia[i - 1] < antes && crudo < antes, "bajó sin dos cierres menores seguidos");
          assert.equal(aplicados[i], crudo);
        }
      });
    }),
  );
});

interface NodoFalso {
  readonly tipo: "salida-ctx" | "ganancia" | "fuente" | "filtro";
  destino: NodoFalso | null;
  asignaciones: number[];
  objetivos: { v: number; t: number; tau: number }[];
  picos: number[];
  inicio: number;
  fin: number;
  cae: boolean;
  gain?: unknown;
  frequency?: unknown;
}

// AudioContext falso con reloj manual: guarda cada nodo, a dónde conecta y
// qué se le hizo a su ganancia, para comprobar rutas y fundidos sin oír.
class ContextoFalso {
  currentTime = 0;
  sampleRate = 8000;
  state = "running";
  destination: NodoFalso = nodo("salida-ctx");
  nodos: NodoFalso[] = [];
  resume = () => Promise.resolve();
  createGain() {
    const n = nodo("ganancia");
    n.gain = {
      set value(v: number) {
        n.asignaciones.push(v);
      },
      setValueAtTime() {},
      linearRampToValueAtTime: (v: number) => n.picos.push(v),
      exponentialRampToValueAtTime() {},
      cancelScheduledValues() {},
      setTargetAtTime: (v: number, t: number, tau: number) => n.objetivos.push({ v, t, tau }),
    };
    return this.registrar(n);
  }
  createOscillator() {
    const n = nodo("fuente");
    n.frequency = {
      value: 0,
      exponentialRampToValueAtTime: () => {
        n.cae = true;
      },
    };
    return this.registrar(n);
  }
  createBufferSource() {
    return this.registrar(nodo("fuente"));
  }
  createBiquadFilter() {
    const n = nodo("filtro");
    n.frequency = { value: 0 };
    return this.registrar(n);
  }
  createBuffer(_canales: number, frames: number) {
    return { getChannelData: () => new Float32Array(frames) };
  }
  private registrar(n: NodoFalso) {
    this.nodos.push(n);
    return n;
  }
}

function nodo(tipo: NodoFalso["tipo"]): NodoFalso & { connect(d: NodoFalso): NodoFalso; start(t: number): void; stop(t?: number): void } {
  const n = {
    tipo,
    destino: null as NodoFalso | null,
    asignaciones: [] as number[],
    objetivos: [] as { v: number; t: number; tau: number }[],
    picos: [] as number[],
    inicio: -1,
    fin: -1,
    cae: false,
    connect(d: NodoFalso) {
      n.destino = d;
      return d;
    },
    start(t: number) {
      n.inicio = t;
    },
    stop(t?: number) {
      if (t !== undefined) n.fin = t;
    },
  };
  return n;
}

// Los programadores arrancan un setInterval real: sin pararlos al final el
// proceso de test no termina.
const creados: ReturnType<typeof crearProgramador>[] = [];
after(() => {
  for (const programador of creados) programador.detener();
});

function crear(): { contexto: ContextoFalso; programador: ReturnType<typeof crearProgramador> } {
  const contexto = new ContextoFalso();
  const programador = crearProgramador(contexto as unknown as AudioContext);
  creados.push(programador);
  return { contexto, programador };
}

function correr(contexto: ContextoFalso, programador: ReturnType<typeof crearProgramador>, desde: number, hasta: number, paso = 0.025): void {
  for (let t = desde; t <= hasta; t += paso) {
    contexto.currentTime = t;
    programador.pasada();
  }
}

// Origen del reloj del programador: iniciar() empieza el compás 0 50 ms después.
const ORIGEN_S = 0.05;

test("mus-2: pedido el nivel 3 entra en menos de un compás con capas, bajo y tempo 100", () => {
  const { contexto, programador } = crear();
  programador.iniciar();
  correr(contexto, programador, 0, 1);
  assert.equal(programador.estado().nivelTension, 0);
  programador.fijarNivel(3);
  correr(contexto, programador, 1, 1 + COMPAS_S);
  const e = programador.estado();
  assert.equal(e.nivelTension, 3);
  assert.ok(e.capas.percusion > 0 && e.capas.bajo > 0);
  assert.equal(e.bpm, BPM_TENSO);
});

test("mus-2: el nivel 1 solo trae percusión y el 2 añade el bajo", () => {
  const { contexto, programador } = crear();
  programador.iniciar();
  programador.fijarNivel(1);
  correr(contexto, programador, 0, COMPAS_S * 2);
  assert.ok(programador.estado().capas.percusion > 0);
  assert.equal(programador.estado().capas.bajo, 0);
  assert.equal(programador.estado().bpm, 90);
  programador.fijarNivel(2);
  correr(contexto, programador, COMPAS_S * 2, COMPAS_S * 4);
  assert.ok(programador.estado().capas.bajo > 0);
});

test("invariante: el cambio de tempo empieza en una frontera de compás y la primera nota del tempo nuevo cae exactamente en ella", () => {
  fc.assert(
    fc.property(fc.double({ min: 0, max: 20, noNaN: true }), (instante) => {
      const { contexto, programador } = crear();
      programador.iniciar();
      correr(contexto, programador, 0, instante);
      programador.fijarNivel(3);
      correr(contexto, programador, instante, instante + COMPAS_S * 2);
      const objetivos = contexto.nodos.flatMap((n) => n.objetivos).filter((o) => o.v > 0);
      assert.ok(objetivos.length > 0, "las capas reciben su fundido");
      const frontera = objetivos[0].t;
      const compases = (frontera - ORIGEN_S) / COMPAS_S;
      assert.ok(Math.abs(compases - Math.round(compases)) < 1e-9, "la frontera es un múltiplo del compás a 90 BPM");
      const bombos = contexto.nodos.filter((n) => n.tipo === "fuente" && n.cae).map((n) => n.inicio);
      assert.equal(Math.min(...bombos), frontera, "el primer bombo del tempo nuevo cae en la frontera");
      // El segundo compás dura lo que dura a 100 BPM: 0,9 del de 90.
      assert.ok(bombos.some((b) => Math.abs(b - (frontera + COMPAS_S * 0.9)) < 1e-9));
    }),
    { numRuns: 25 },
  );
});

test("invariante: ninguna capa recibe gain.value y todas las rutas terminan en la misma salida", () => {
  fc.assert(
    fc.property(fc.array(fc.constantFrom<NivelTension>(0, 1, 2, 3), { minLength: 1, maxLength: 6 }), (niveles) => {
      const { contexto, programador } = crear();
      programador.iniciar();
      let t = 0;
      for (const nivel of niveles) {
        programador.fijarNivel(nivel);
        correr(contexto, programador, t, t + COMPAS_S);
        t += COMPAS_S;
      }
      const ganancias = contexto.nodos.filter((n) => n.tipo === "ganancia");
      const salida = ganancias[0];
      assert.equal(salida.destino, contexto.destination);
      const capas = ganancias.slice(1, 3);
      for (const capa of capas) {
        assert.deepEqual(capa.asignaciones, [], "las capas solo usan setValueAtTime/setTargetAtTime");
        assert.equal(capa.destino, salida);
        for (const o of capa.objetivos) assert.equal(o.tau, 0.5);
      }
      for (const fuente of contexto.nodos.filter((n) => n.tipo === "fuente")) {
        let actual: NodoFalso | null = fuente;
        for (let i = 0; i < 6 && actual && actual !== contexto.destination; i += 1) actual = actual.destino;
        assert.equal(actual, contexto.destination, "toda fuente llega a destination");
        let paso: NodoFalso | null = fuente;
        const visto = new Set<NodoFalso>();
        while (paso) {
          visto.add(paso);
          paso = paso.destino;
        }
        assert.ok(visto.has(salida), "pasando por la salida común");
      }
    }),
    { numRuns: 20 },
  );
});

test("mus-3: con nivel 3, atenuar(0.35) baja la salida común y las capas no tienen otro camino a destination", () => {
  const { contexto, programador } = crear();
  programador.iniciar();
  programador.fijarNivel(3);
  correr(contexto, programador, 0, COMPAS_S * 2);
  contexto.currentTime = 3;
  programador.atenuar(0.35);
  const salida = contexto.nodos.filter((n) => n.tipo === "ganancia")[0];
  const ultimo = salida.objetivos[salida.objetivos.length - 1];
  assert.ok(Math.abs(ultimo.v - 0.06 * 0.35) < 1e-9);
  for (const capa of contexto.nodos.filter((n) => n.tipo === "ganancia").slice(1, 3)) assert.equal(capa.destino, salida);
});

function picoDelBus(nivel: NivelTension): { pico: number; voces: number } {
  const { contexto, programador } = crear();
  programador.iniciar();
  programador.fijarNivel(nivel);
  const fin = COMPAS_S * 26;
  correr(contexto, programador, 0, fin);
  // Solo el tramo estable: se descarta el compás en que entran las capas.
  const desde = COMPAS_S * 2;
  const notas = contexto.nodos.filter((n) => n.tipo === "fuente" && n.inicio >= desde && n.inicio <= desde + COMPAS_S * 24);
  const gananciaDe = new Map<NodoFalso, number>();
  // Cada fuente cuelga de su ganancia (o de un filtro y luego la ganancia): se recorre el grafo hacia atrás.
  for (const g of contexto.nodos.filter((n) => n.tipo === "ganancia" && n.picos.length > 0)) {
    for (const f of contexto.nodos) {
      let actual: NodoFalso | null = f.destino;
      while (actual && actual !== g && actual.tipo === "filtro") actual = actual.destino;
      if (actual === g && f.tipo !== "ganancia") gananciaDe.set(f, g.picos[0]);
    }
  }
  let pico = 0;
  let voces = 0;
  for (const nota of notas) {
    const vivas = notas.filter((o) => o.inicio <= nota.inicio && o.fin > nota.inicio);
    pico = Math.max(pico, vivas.reduce((suma, o) => suma + (gananciaDe.get(o) ?? 0), 0));
    voces = Math.max(voces, vivas.length);
  }
  return { pico, voces };
}

test("mus-4: con las capas a tope el pico del bus no pasa de +3 dB ni de MAX_VOCES_MUSICA", () => {
  const base = picoDelBus(0);
  const tenso = picoDelBus(3);
  assert.ok(base.pico > 0 && tenso.pico > 0);
  assert.ok(tenso.pico <= base.pico * 1.41, `pico ${tenso.pico} contra ${base.pico}`);
  assert.ok(tenso.voces <= MAX_VOCES_MUSICA, `${tenso.voces} voces`);
});

test("invariante: con la música parada no se programa ninguna nota de ninguna capa", () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    fc.assert(
      fc.property(fc.constantFrom<NivelTension>(0, 1, 2, 3), (nivel) => {
        const { contexto, programador } = crear();
        programador.iniciar();
        programador.detener();
        programador.fijarNivel(nivel);
        const antes = programador.estado().notasProgramadas;
        mock.timers.tick(3000);
        assert.equal(programador.estado().notasProgramadas, antes);
        assert.equal(contexto.nodos.filter((n) => n.tipo === "fuente").length, 0);
      }),
    );
  } finally {
    mock.timers.reset();
  }
});
