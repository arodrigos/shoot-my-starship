import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularPrevisualizacion,
  DISTANCIA_MINIMA_OCULTA_IMPACTO_PX,
  PASOS_PREVISUALIZACION_ERRATICO,
} from "@/sim/armas/previsualizacion";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { ALTURA_CANON_PX, alturaSuperficie, detenerseEnSuelo } from "@/sim/armas/resolver";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 2400;
const ALTO = 1400;
const ORIGEN_X = 300;
const ALTURA_SUELO = 700;
const GRAVEDAD = 1;
const DERIVA = 0;

// pvr-2 (camino crítico): un tiro corto y plano que aterriza muy pronto --
// dentro de la ventana de previsualización -- nunca debe dejar su último
// punto dibujado cerca del impacto real (distancia euclídea al punto de
// contacto de verdad, no solo a la línea de suelo).
test("pvr-2 (camino crítico): un impacto que cae dentro de la ventana de previsualización se oculta a más de la distancia declarada", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO);
  const anguloGrados = 35;
  const potencia = 15;

  const previsualizacion = calcularPrevisualizacion({
    mascara,
    gravedad: GRAVEDAD,
    deriva: DERIVA,
    ancho: ANCHO,
    alto: ALTO,
    origenX: ORIGEN_X,
    anguloGrados,
    potencia,
    comportamiento: { tipo: "impacto-simple" },
  });

  const origenY = alturaSuperficie(mascara, ORIGEN_X) ?? ALTO - 1;
  const rad = (anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(potencia);
  const inicial = crearProyectil(ORIGEN_X, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  const real = simularVuelo(inicial, GRAVEDAD, DERIVA, detenerseEnSuelo(mascara, ANCHO, ALTO));
  const impactoReal = real.proyectil;

  const ultimo = previsualizacion[previsualizacion.length - 1];
  const distancia = Math.hypot(ultimo.x - impactoReal.x, ultimo.y - impactoReal.y);
  assert.ok(
    distancia >= DISTANCIA_MINIMA_OCULTA_IMPACTO_PX,
    `el último punto dibujado (${ultimo.x}, ${ultimo.y}) está a ${distancia}px del impacto real (${impactoReal.x}, ${impactoReal.y}), menos que la distancia mínima declarada`,
  );
});

// pvr-2: la granada de espoleta puede detonar en el aire, por temporizador,
// sin tocar nunca el suelo -- ese airburst es un contacto real tanto como el
// terreno, y también debe ocultarse si cae dentro de la ventana.
test("pvr-2: un airburst de la granada de espoleta (detonación por temporizador, nunca llega a tierra) también se oculta", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 100_000);

  const previsualizacion = calcularPrevisualizacion({
    mascara,
    gravedad: GRAVEDAD,
    deriva: DERIVA,
    ancho: ANCHO,
    alto: ALTO,
    origenX: ORIGEN_X,
    anguloGrados: 45,
    potencia: 50,
    comportamiento: { tipo: "mecha", segundosHastaDetonar: 0.3 },
  });

  assert.ok(previsualizacion.length >= 2, "debe quedar al menos un tramo dibujado antes del corte");
});

// pvr-2: para la mosca, la previsualización no debe alargarse más allá del
// tramo de pocos pasos donde la perturbación aún no ha desviado el tiro de
// forma apreciable -- un tramo mucho más corto que el del resto de armas.
test("pvr-2: la previsualización de la mosca (erratico) se corta mucho antes que la del resto de armas", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO);

  const previsualizacionBalistica = calcularPrevisualizacion({
    mascara,
    gravedad: GRAVEDAD,
    deriva: DERIVA,
    ancho: ANCHO,
    alto: ALTO,
    origenX: ORIGEN_X,
    anguloGrados: 45,
    potencia: 90,
    comportamiento: { tipo: "impacto-simple" },
  });

  const previsualizacionMosca = calcularPrevisualizacion({
    mascara,
    gravedad: GRAVEDAD,
    deriva: DERIVA,
    ancho: ANCHO,
    alto: ALTO,
    origenX: ORIGEN_X,
    anguloGrados: 45,
    potencia: 90,
    comportamiento: { tipo: "erratico", magnitudPxS2: 90 },
    aleatorio: crearEstadoAleatorio(7),
  });

  assert.ok(
    previsualizacionMosca.length <= PASOS_PREVISUALIZACION_ERRATICO + 1,
    `la previsualización de la mosca no puede superar su propio presupuesto corto de pasos (obtenido ${previsualizacionMosca.length})`,
  );
  assert.ok(
    previsualizacionMosca.length < previsualizacionBalistica.length,
    "la previsualización de la mosca debe ser estrictamente más corta que la de un arma balística normal en la misma trayectoria",
  );
});

// pvr-2: sin el EstadoAleatorio hilvanado real, la mosca sigue mostrando algo
// honesto -- el tramo balístico inicial, nunca una curva inventada aparte.
test("pvr-2: sin `aleatorio`, la previsualización de la mosca sigue siendo un prefijo de la parábola sin perturbar", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO);

  const previsualizacionSinAzar = calcularPrevisualizacion({
    mascara,
    gravedad: GRAVEDAD,
    deriva: DERIVA,
    ancho: ANCHO,
    alto: ALTO,
    origenX: ORIGEN_X,
    anguloGrados: 45,
    potencia: 90,
    comportamiento: { tipo: "erratico", magnitudPxS2: 90 },
  });

  assert.ok(previsualizacionSinAzar.length > 0, "debe seguir dibujando algo incluso sin aleatorio hilvanado");
  assert.ok(previsualizacionSinAzar.length <= PASOS_PREVISUALIZACION_ERRATICO + 1);
});
