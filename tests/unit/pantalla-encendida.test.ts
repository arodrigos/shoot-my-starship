import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  estadoInicialPantallaEncendida,
  MAX_REINTENTOS_POR_TOQUE,
  seDesea,
  transicionPantallaEncendida,
  type DatosPantallaEncendida,
  type EventoPantallaEncendida,
} from "@/juego/control/pantallaEncendida";

const TIPOS: EventoPantallaEncendida["tipo"][] = [
  "entrarPartida",
  "salirPartida",
  "parteVisible",
  "parteOculto",
  "documentoVisible",
  "documentoOculto",
  "peticionResuelta",
  "peticionRechazada",
  "liberadoPorSistema",
  "toqueEnPartida",
];
const secuencias = fc.array(fc.constantFrom(...TIPOS), { maxLength: 40 });
const CORRIDAS = { numRuns: 600 };

// Intérprete de efectos: lleva la cuenta de peticiones en vuelo y de
// centinelas vivos igual que lo haría el navegador. Las resoluciones solo se
// aplican si hay una petición pendiente (el navegador no resuelve lo que no
// se pidió) y las liberaciones del sistema solo si hay un centinela vivo.
interface Mundo {
  d: DatosPantallaEncendida;
  pendientes: number;
  vivos: number;
  maxVivos: number;
  pedidoIlegal: boolean;
}

function ejecutar(soportada: boolean, eventos: readonly EventoPantallaEncendida["tipo"][], alFinalResolver = false): Mundo {
  const m: Mundo = { d: estadoInicialPantallaEncendida(soportada), pendientes: 0, vivos: 0, maxVivos: 0, pedidoIlegal: false };
  const aplicar = (tipo: EventoPantallaEncendida["tipo"]) => {
    if (tipo === "peticionResuelta" || tipo === "peticionRechazada") {
      if (m.pendientes === 0) return;
      m.pendientes--;
      if (tipo === "peticionResuelta") m.vivos++;
    }
    if (tipo === "liberadoPorSistema") {
      if (m.vivos === 0) return;
      m.vivos--;
    }
    const { estado, efectos } = transicionPantallaEncendida(m.d, { tipo } as EventoPantallaEncendida);
    // Con el estado ANTERIOR se juzga si pedir era legal.
    for (const efecto of efectos) {
      if (efecto === "pedir") {
        if (!(seDesea(estado) && estado.documentoVisible)) m.pedidoIlegal = true;
        m.pendientes++;
      } else {
        m.vivos = 0;
      }
    }
    m.d = estado;
    m.maxVivos = Math.max(m.maxVivos, m.vivos);
  };
  for (const tipo of eventos) aplicar(tipo);
  if (alFinalResolver) while (m.pendientes > 0) aplicar("peticionResuelta");
  return m;
}

test("pe-6a: nunca hay más de un centinela vivo, sea cual sea el orden de los eventos", () => {
  fc.assert(
    fc.property(secuencias, (eventos) => {
      const m = ejecutar(true, eventos, true);
      assert.ok(m.maxVivos <= 1);
      assert.ok(m.pendientes === 0);
    }),
    CORRIDAS,
  );
});

test("pe-6b: resueltas las peticiones, si no se desea el bloqueo no queda ningún centinela", () => {
  fc.assert(
    fc.property(secuencias, (eventos) => {
      const m = ejecutar(true, eventos, true);
      if (!seDesea(m.d) || !m.d.documentoVisible) assert.equal(m.vivos, 0);
    }),
    CORRIDAS,
  );
});

test("pe-6c: nunca se pide con la página oculta o sin desearse el bloqueo", () => {
  fc.assert(
    fc.property(secuencias, (eventos) => {
      assert.equal(ejecutar(true, eventos).pedidoIlegal, false);
    }),
    CORRIDAS,
  );
});

test("pe-6d: sin API no hay efectos ni cambio de estado, sea cual sea la secuencia", () => {
  fc.assert(
    fc.property(secuencias, (eventos) => {
      let d = estadoInicialPantallaEncendida(false);
      for (const tipo of eventos) {
        const t = transicionPantallaEncendida(d, { tipo } as EventoPantallaEncendida);
        assert.deepEqual(t.efectos, []);
        d = t.estado;
        assert.equal(d.estado, "no-soportado");
      }
    }),
    CORRIDAS,
  );
});

test("pe-6e: los reintentos por toque tras un rechazo nunca pasan de 3, y una partida nueva los reinicia", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 30 }), (toques) => {
      let d = estadoInicialPantallaEncendida(true);
      let reintentos = 0;
      const dar = (tipo: EventoPantallaEncendida["tipo"]) => {
        const t = transicionPantallaEncendida(d, { tipo } as EventoPantallaEncendida);
        d = t.estado;
        return t.efectos.length;
      };
      dar("entrarPartida");
      dar("peticionRechazada");
      for (let i = 0; i < toques; i++) {
        if (dar("toqueEnPartida") > 0) {
          reintentos++;
          dar("peticionRechazada");
        }
      }
      assert.equal(reintentos, Math.min(toques, MAX_REINTENTOS_POR_TOQUE));
      assert.ok(d.rechazosSeguidos <= MAX_REINTENTOS_POR_TOQUE);
      dar("parteVisible");
      assert.equal(d.rechazosSeguidos, 0);
    }),
    CORRIDAS,
  );
});

test("pe-4: tras una liberación del sistema, el siguiente toque vuelve a pedir; con el bloqueo activo un toque no pide", () => {
  let d = estadoInicialPantallaEncendida(true);
  const dar = (tipo: EventoPantallaEncendida["tipo"]) => {
    const t = transicionPantallaEncendida(d, { tipo } as EventoPantallaEncendida);
    d = t.estado;
    return t.efectos;
  };
  assert.deepEqual(dar("entrarPartida"), ["pedir"]);
  dar("peticionResuelta");
  assert.equal(d.estado, "activo");
  assert.deepEqual(dar("toqueEnPartida"), []);
  dar("liberadoPorSistema");
  assert.equal(d.estado, "soltado");
  assert.deepEqual(dar("toqueEnPartida"), ["pedir"]);
});

test("pe-2: una petición que llega con el parte ya visible se suelta en el acto", () => {
  let d = estadoInicialPantallaEncendida(true);
  const dar = (tipo: EventoPantallaEncendida["tipo"]) => {
    const t = transicionPantallaEncendida(d, { tipo } as EventoPantallaEncendida);
    d = t.estado;
    return t.efectos;
  };
  dar("entrarPartida");
  dar("parteVisible");
  assert.deepEqual(dar("peticionResuelta"), ["soltar"]);
  assert.equal(d.estado, "soltado");
});
