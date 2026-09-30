import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo } from "@/sim/armas/resolver";
import { siguientePerturbacionErratica } from "@/sim/fisica/comportamientoExtendido";
import { GRAVEDAD_REFERENCIA_PX_S2 } from "@/sim/fisica/proyectil";
import { crearEstadoAleatorio, siguienteAleatorio } from "@/sim/aleatorio";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import type { Arma } from "@/sim/armas/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;

const ARMA_ERRATICA: Arma = {
  id: "arma-erratica-vex-3",
  nombre: "Erratica de prueba",
  descripcion: "Solo para el test: no existe en el catálogo real.",
  comportamiento: { tipo: "erratico", magnitudPxS2: 400 },
  huella: { tipo: "circular", radio: 18, signo: "restar" },
  efecto: { tipo: "danio", radioEfectoPx: 40, danioMaximo: 15 },
  fiabilidad: 1,
};

function dispararErratico(semilla: number) {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const [solucion] = resolverSolucionesBalisticas(300, 900, 900, 900, 1);
  return resolverDisparo({
    mascara,
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(semilla),
    arma: ARMA_ERRATICA,
    origenX: 300,
    anguloGrados: solucion.anguloGrados,
    potencia: solucion.potencia,
    objetivoX: 900,
    objetivoY: 900,
    ancho: ANCHO,
    alto: ALTO,
  });
}

test("vex-3: siguientePerturbacionErratica es pura -- misma entrada, misma salida", () => {
  const estado = crearEstadoAleatorio(42);
  const a = siguientePerturbacionErratica(estado, 300);
  const b = siguientePerturbacionErratica(estado, 300);
  assert.deepEqual(a, b);
});

// vex-3: orden fijo por paso -- deriva sale de la PRIMERA tirada y gravedad
// extra de la SEGUNDA, encadenada al estado que deja la primera. Se
// reconstruye a mano con siguienteAleatorio para comprobar que
// siguientePerturbacionErratica no invierte el orden ni reutiliza una
// tirada para las dos magnitudes.
test("vex-3: deriva sale de la primera tirada y gravedad extra de la segunda, en ese orden", () => {
  const estado = crearEstadoAleatorio(7);
  const magnitud = 300;
  const pasoDeriva = siguienteAleatorio(estado);
  const pasoGravedad = siguienteAleatorio(pasoDeriva.estado);

  const perturbacion = siguientePerturbacionErratica(estado, magnitud);

  assert.equal(perturbacion.derivaPxS2, (pasoDeriva.valor * 2 - 1) * magnitud);
  assert.equal(perturbacion.gravedadExtra, ((pasoGravedad.valor * 2 - 1) * magnitud) / GRAVEDAD_REFERENCIA_PX_S2);
  assert.deepEqual(perturbacion.estado, pasoGravedad.estado);
});

test("vex-3: mismo estado inicial de PRNG produce la misma secuencia completa de vuelo", () => {
  const primero = dispararErratico(2026);
  const segundo = dispararErratico(2026);
  assert.deepEqual(primero.puntosDeImpacto, segundo.puntosDeImpacto);
  assert.deepEqual(primero.aleatorio, segundo.aleatorio);
  assert.equal(primero.danioObjetivo, segundo.danioObjetivo);
});

test("vex-3: 200 repeticiones con la misma semilla dan trayectorias idénticas punto a punto", () => {
  const referencia = dispararErratico(999);
  for (let i = 0; i < 200; i++) {
    const repeticion = dispararErratico(999);
    assert.deepEqual(repeticion.puntosDeImpacto, referencia.puntosDeImpacto);
  }
});

test("vex-3: cambiar la semilla de entrada cambia la trayectoria (la perturbación no es un no-op)", () => {
  const a = dispararErratico(1);
  const b = dispararErratico(2);
  assert.notDeepEqual(a.puntosDeImpacto, b.puntosDeImpacto);
});
