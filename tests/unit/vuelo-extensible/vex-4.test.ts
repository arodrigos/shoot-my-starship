import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo, detenerseEnSuelo, crearDetenerseConMecha, ALTURA_CANON_PX } from "@/sim/armas/resolver";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { solucionTensa } from "../../utils/solucionTensa";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import type { Arma } from "@/sim/armas/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const ORIGEN_X = 300;
const OBJETIVO_X = 900;
const OBJETIVO_Y = 900;
const GRAVEDAD = 1;

function armaMecha(segundosHastaDetonar: number): Arma {
  return {
    id: "arma-mecha-vex-4",
    nombre: "Mecha de prueba",
    descripcion: "Solo para el test: no existe en el catálogo real.",
    comportamiento: { tipo: "mecha", segundosHastaDetonar },
    huella: { tipo: "circular", radio: 18, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 40, danioMaximo: 15 },
    fiabilidad: 1,
  };
}

function dispararMecha(segundosHastaDetonar: number) {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const solucion = solucionTensa(ORIGEN_X, 900, OBJETIVO_X, OBJETIVO_Y, GRAVEDAD);
  return resolverDisparo({
    mascara,
    gravedad: GRAVEDAD,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: armaMecha(segundosHastaDetonar),
    origenX: ORIGEN_X,
    anguloGrados: solucion.anguloGrados,
    potencia: solucion.potencia,
    objetivoX: OBJETIVO_X,
    objetivoY: OBJETIVO_Y,
    ancho: ANCHO,
    alto: ALTO,
  });
}

// vex-4: pasosNaturales es el número de pasos que este mismo disparo (sin
// ninguna mecha) tarda en tocar el suelo plano -- referencia para construir
// los tres regímenes (expira antes, después, y justo en el límite) sin
// adivinar un número de segundos a ciegas.
function pasosNaturalesDeAterrizaje(): number {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const solucion = solucionTensa(ORIGEN_X, 900, OBJETIVO_X, OBJETIVO_Y, GRAVEDAD);
  const rad = (solucion.anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(solucion.potencia);
  const inicial = crearProyectil(ORIGEN_X, 900 - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  const detenerse = detenerseEnSuelo(mascara, ANCHO, ALTO);
  return simularVuelo(inicial, GRAVEDAD, 0, detenerse).pasos;
}

test("vex-4: la mecha que expira pronto detona en el aire, antes de tocar el suelo", () => {
  const resultado = dispararMecha(0.05); // 3 pasos a 60 Hz
  assert.equal(resultado.proyectilPerdido, false);
  assert.equal(resultado.puntosDeImpacto.length, 1);
  // En 3 pasos con esta balística el proyectil sigue muy por encima de la
  // línea de suelo (y=900): detona en el aire, no al contacto.
  assert.equal(resultado.puntosDeImpacto[0].y < 900, true);
});

test("vex-4: la mecha que expira tarde deja ganar el contacto con el suelo", () => {
  const conMecha = dispararMecha(10); // 600 pasos: mucho más que cualquier vuelo balístico corto
  const sinMecha = resolverDisparo({
    mascara: crearMascaraPlana(ANCHO, ALTO, 900),
    gravedad: GRAVEDAD,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: {
      id: "arma-impacto-simple-vex-4",
      nombre: "Referencia sin mecha",
      descripcion: "Solo para el test.",
      comportamiento: { tipo: "impacto-simple" },
      huella: { tipo: "circular", radio: 18, signo: "restar" },
      efecto: { tipo: "danio", radioEfectoPx: 40, danioMaximo: 15 },
      fiabilidad: 1,
    },
    origenX: ORIGEN_X,
    anguloGrados: solucionTensa(ORIGEN_X, 900, OBJETIVO_X, OBJETIVO_Y, GRAVEDAD).anguloGrados,
    potencia: solucionTensa(ORIGEN_X, 900, OBJETIVO_X, OBJETIVO_Y, GRAVEDAD).potencia,
    objetivoX: OBJETIVO_X,
    objetivoY: OBJETIVO_Y,
    ancho: ANCHO,
    alto: ALTO,
  });
  assert.deepEqual(conMecha.puntosDeImpacto, sinMecha.puntosDeImpacto);
});

test("vex-4: crearDetenerseConMecha detona en el paso exacto, ni antes ni uno tarde", () => {
  const pasosNaturales = pasosNaturalesDeAterrizaje();
  assert.equal(pasosNaturales > 5, true, "el fixture necesita un vuelo de más de 5 pasos para poder cortarlo antes");

  let llamadasBase = 0;
  const detenerseBase = () => {
    llamadasBase++;
    return llamadasBase > pasosNaturales;
  };

  // Justo un paso antes del aterrizaje natural: la mecha tiene que ganar.
  llamadasBase = 0;
  const detenerseAntes = crearDetenerseConMecha(detenerseBase, pasosNaturales - 1);
  let pasos = 0;
  while (!detenerseAntes(crearProyectil(0, 0, 0, 0))) pasos++;
  assert.equal(pasos, pasosNaturales - 1);

  // Exactamente en el paso del aterrizaje: empatan, y detenerseBase (mirado
  // primero) es indistinguible de la mecha en ese mismo paso.
  llamadasBase = 0;
  const detenerseEmpate = crearDetenerseConMecha(detenerseBase, pasosNaturales);
  pasos = 0;
  while (!detenerseEmpate(crearProyectil(0, 0, 0, 0))) pasos++;
  assert.equal(pasos, pasosNaturales);
});

test("vex-4: ningún régimen de mecha deja el disparo sin resolver (siempre síncrono, sin proyectil pendiente)", () => {
  for (const segundos of [0.01, 0.5, 1, 2, 5, 8, 10, 20]) {
    const resultado = dispararMecha(segundos);
    // resolverDisparo es una función pura y síncrona: si esto retorna, no
    // hay ningún proyectil "vivo" que pueda sobrevivir al turno -- no existe
    // ningún campo en ResultadoDisparo que represente un estado a medias.
    assert.equal(resultado.proyectilPerdido, false);
    assert.equal(resultado.puntosDeImpacto.length, 1);
    assert.equal(Number.isFinite(resultado.puntosDeImpacto[0].x), true);
    assert.equal(Number.isFinite(resultado.puntosDeImpacto[0].y), true);
  }
});
