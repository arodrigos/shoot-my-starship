import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { buscarEquipo } from "@/sim/equipo/catalogo";
import { colocarNaves } from "@/sim/naves/colocacion";
import { INTEGRIDAD_MAXIMA } from "@/sim/naves/vida";
import { avanzar } from "@/sim/partida/avanzar";
import { costeArma } from "@/sim/partida/economia";
import { avanzarRonda, conMuerteSubita, DRENAJE_BASE, drenajeDeRonda, RONDA_MUERTE_SUBITA } from "@/sim/partida/muerteSubita";
import type { EntradaDeTurno, EstadoPartida, IdNave, ParametrosMundo } from "@/sim/partida/tipos";
import { idsNavesVivas } from "@/sim/partida/tipos";
import { buscarEvento } from "@/sim/universo/catalogoEventos";
import { conUniverso } from "@/sim/universo/efectos";

const MUNDO: ParametrosMundo = { ancho: 1200, alto: 1600, gravedad: 0, deriva: 0, etiquetaDeriva: "" };
const LIMITE_DE_SEGURIDAD = 200;

// colocarNaves cuesta ~1 s: se coloca una vez por (semilla, naves) y el azar
// de fast-check varía las jugadas, no el escenario.
const colocaciones = new Map<string, ReturnType<typeof colocarNaves>>();
function colocar(semilla: number, naves: number): ReturnType<typeof colocarNaves> {
  const clave = `${semilla}:${naves}`;
  let hecha = colocaciones.get(clave);
  if (hecha === undefined) {
    hecha = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), naves, Array.from({ length: naves }, () => true));
    colocaciones.set(clave, hecha);
  }
  return hecha;
}

// Generador propio del test: la partida decide con el suyo y las jugadas
// «arbitrarias» no deben consumirlo.
function crearAzar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Una jugada cualquiera pero legal: arma de pago solo si el saldo llega, escudo
// y propulsores incluidos, para que el invariante se pruebe con todas las
// mecánicas encendidas y no solo con disparos.
function jugadaArbitraria(estado: EstadoPartida, azar: () => number): EntradaDeTurno {
  const tirador = estado.turno;
  const rivales = idsNavesVivas(estado).filter((id) => id !== tirador);
  const objetivoId = rivales[Math.floor(azar() * rivales.length)] as IdNave;
  const saldo = estado.modo === "presupuesto" ? (estado.saldos?.[tirador] ?? 0) : Infinity;
  const base = { anguloGrados: azar() * 360, potencia: 10 + azar() * 90, objetivoId };
  const eleccion = azar();
  if (eleccion < 0.1 && saldo >= buscarEquipo("escudo").coste && (estado.naves[tirador].escudoTurnosRestantes ?? 0) === 0) {
    return { ...base, accion: "escudo", arma: "escudo" };
  }
  if (eleccion < 0.2 && saldo >= buscarEquipo("propulsores").coste) return { ...base, accion: "propulsores", arma: "propulsores" };
  const asequibles = CATALOGO_ARMAS.filter((arma) => costeArma(arma) <= saldo);
  return { ...base, arma: asequibles[Math.floor(azar() * asequibles.length)].id };
}

function partida(semilla: number, naves: number, modo: "barra-libre" | "presupuesto"): EstadoPartida {
  const colocacion = colocar(semilla, naves);
  const base: EstadoPartida = {
    version: 1,
    mundo: MUNDO,
    mascara: colocacion.sistema.mascara,
    naves: colocacion.naves,
    ordenTurno: colocacion.naves.map((_, id) => id),
    turno: 0,
    numeroTurno: 0,
    aleatorio: colocacion.aleatorio,
    resultado: { tipo: "en-curso" },
    planetas: colocacion.sistema.planetas,
    modo,
    ...(modo === "presupuesto" ? { saldos: colocacion.naves.map(() => PRESUPUESTO_BASE) } : {}),
  };
  return conMuerteSubita(conUniverso(base));
}

// ms-1 (invariante 1) y ms-3: la partida real, con escudo, propulsores,
// eventos, armas gratis, robot y compra al usar, siempre termina dentro de la
// cota y nunca cura una vez empezada la muerte súbita.
test("ms-1: toda partida termina antes de la ronda RONDA_MUERTE_SUBITA + 9 y no hay curas en muerte súbita", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 2, max: 4 }), fc.constantFrom("barra-libre" as const, "presupuesto" as const), fc.integer(), (semilla, naves, modo, azarSemilla) => {
      const azar = crearAzar(azarSemilla);
      let estado = partida(semilla, naves, modo);
      while (estado.resultado.tipo === "en-curso" && estado.numeroTurno < LIMITE_DE_SEGURIDAD) {
        const entrada = jugadaArbitraria(estado, azar);
        const turno = avanzar(estado, entrada);
        estado = turno.estado;
        if (estado.muerteSubita === true) {
          const curas = turno.eventos.filter((evento) => evento.tipo === "evento-universo" && evento.perdido !== true && buscarEvento(evento.evento).curativo);
          assert.deepEqual(curas, [], "ningún evento curativo ocurre en muerte súbita");
          assert.equal(estado.universo?.objetos?.some((objeto) => objeto.tipo === "corazon") ?? false, false, "los corazones se disuelven");
        }
      }
      assert.equal(estado.resultado.tipo, "terminada");
      assert.ok(estado.numeroTurno <= naves * (RONDA_MUERTE_SUBITA + 8) + 1, `terminó en el turno ${estado.numeroTurno}`);
      const vivas = idsNavesVivas(estado);
      assert.ok(vivas.length <= 1);
      if (estado.resultado.tipo === "terminada") assert.equal(estado.resultado.ganador, vivas.length === 1 ? vivas[0] : null);
    }),
    { numRuns: 16, seed: 20261007 },
  );
});

// Invariante 2: el drenaje de la ronda r es DRENAJE_BASE × (r − 13) para toda ronda ≥ 14,
// se aplica a todas las vivas a la vez y el escudo no lo frena.
test("ms-1: el drenaje es DRENAJE_BASE × (r − RONDA_MUERTE_SUBITA + 1), igual para todas las vivas y sin pasar por el escudo", () => {
  fc.assert(
    fc.property(fc.integer({ min: RONDA_MUERTE_SUBITA - 1, max: 40 }), fc.array(fc.integer({ min: 1, max: INTEGRIDAD_MAXIMA }), { minLength: 2, maxLength: 4 }), fc.boolean(), (ronda, integridades, escudo) => {
      const base = partida(1, 2, "barra-libre");
      const naves = integridades.map((integridad, id) => ({ x: 100 * id, y: 100, integridad, ...(escudo ? { escudoTurnosRestantes: 2 } : {}) }));
      const fase = avanzarRonda({ ...base, ronda: ronda - 1, naves }, naves);
      const danio = DRENAJE_BASE * (ronda - RONDA_MUERTE_SUBITA + 1);
      assert.equal(fase.ronda, ronda);
      assert.equal(drenajeDeRonda(ronda), danio);
      fase.naves.forEach((nave, id) => assert.equal(nave.integridad, Math.max(0, integridades[id] - danio)));
    }),
  );
});

test("ms-1: antes de la ronda 14 el drenaje es 0 y la ronda 13 avisa", () => {
  assert.equal(drenajeDeRonda(RONDA_MUERTE_SUBITA - 1), 0);
  const base = partida(1, 2, "barra-libre");
  const fase = avanzarRonda({ ...base, ronda: RONDA_MUERTE_SUBITA - 2 }, base.naves);
  assert.deepEqual(fase.eventos, [{ tipo: "muerte-subita", fase: "aviso", ronda: RONDA_MUERTE_SUBITA - 1, danio: 0 }]);
});
