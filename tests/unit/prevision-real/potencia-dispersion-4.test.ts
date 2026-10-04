import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularBandaPrevisualizacion } from "@/sim/armas/previsualizacion";
import { dispersionPorPotenciaGrados } from "@/sim/balistica/dispersionPotencia";
import type { Planeta, RegistroPlanetas } from "@/sim/gravedad/planetas";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 2400;
const ALTO = 1400;
const ORIGEN_X = 300;
const ORIGEN_Y = 1300;
const GRAVEDAD = 1;
const DERIVA = 0;

const PLANETAS: RegistroPlanetas = [
  { id: 1, cx: 900, cy: 900, radio: 140, densidad: 3, pixelesVivos: 60_000 } as Planeta,
];

// potencia-dispersion-4 (diferencial, no bloqueante): las DOS trayectorias
// extremas salen del resolver de vuelo real con la MISMA gravedad -- cerca
// de un pozo se curvan de forma DISTINTA entre sí, no en paralelo como haría
// un cono recto geométrico.
test("potencia-dispersion-4: los dos extremos de la banda se curvan de forma distinta cerca de un pozo de gravedad", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, ORIGEN_Y);
  const banda = calcularBandaPrevisualizacion({
    mascara,
    gravedad: GRAVEDAD,
    deriva: DERIVA,
    ancho: ANCHO,
    alto: ALTO,
    planetas: PLANETAS,
    origenX: ORIGEN_X,
    anguloGrados: 55,
    potencia: 95,
    comportamiento: { tipo: "impacto-simple" },
  });

  assert.ok(banda.amplitudGrados > 0, "a potencia 95% la amplitud debe ser perceptible");
  assert.equal(banda.amplitudGrados, dispersionPorPotenciaGrados(95));
  assert.ok(banda.extremoMenor.length > 2 && banda.extremoMayor.length > 2);

  // Si los dos extremos fueran un cono recto (geometría pura, sin
  // gravedad), la separación entre ellos crecería de forma estrictamente
  // lineal con la distancia recorrida. Con gravedad real y un pozo cerca,
  // la separación entre el paso 1 y el último no puede ser simplemente
  // proporcional al número de pasos -- se mide que NO lo es, comparando la
  // razón de separación en dos tramos iguales del trazado.
  const n = Math.min(banda.extremoMenor.length, banda.extremoMayor.length);
  const separacionEn = (i: number) => Math.hypot(banda.extremoMenor[i].x - banda.extremoMayor[i].x, banda.extremoMenor[i].y - banda.extremoMayor[i].y);
  const separacionInicial = separacionEn(Math.floor(n / 3));
  const separacionFinal = separacionEn(n - 1);
  assert.ok(separacionFinal > 0, "los dos extremos deben separarse de verdad, no colapsar en el mismo trazo");

  const razonLineal = (n - 1) / Math.floor(n / 3);
  const razonSeparacion = separacionFinal / Math.max(1e-6, separacionInicial);
  assert.notEqual(
    Math.round(razonSeparacion * 100),
    Math.round(razonLineal * 100),
    "la separación entre extremos no debe crecer de forma puramente lineal (eso sería un cono recto, no física real)",
  );
});

test("potencia-dispersion-3/4: capturas a potencia 30% y 95% -- el ancho de la banda crece con la potencia", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, ORIGEN_Y);
  const parametrosComunes = {
    mascara,
    gravedad: GRAVEDAD,
    deriva: DERIVA,
    ancho: ANCHO,
    alto: ALTO,
    planetas: PLANETAS,
    origenX: ORIGEN_X,
    anguloGrados: 55,
    comportamiento: { tipo: "impacto-simple" as const },
  };
  const bandaBaja = calcularBandaPrevisualizacion({ ...parametrosComunes, potencia: 30 });
  const bandaAlta = calcularBandaPrevisualizacion({ ...parametrosComunes, potencia: 95 });

  assert.ok(bandaAlta.amplitudGrados > bandaBaja.amplitudGrados);

  const anchoFinal = (b: typeof bandaBaja) => {
    const n = Math.min(b.extremoMenor.length, b.extremoMayor.length);
    return Math.hypot(b.extremoMenor[n - 1].x - b.extremoMayor[n - 1].x, b.extremoMenor[n - 1].y - b.extremoMayor[n - 1].y);
  };
  assert.ok(
    anchoFinal(bandaAlta) > anchoFinal(bandaBaja),
    `el ancho de la banda a 95%% (${anchoFinal(bandaAlta)}px) debe ser mayor que a 30%% (${anchoFinal(bandaBaja)}px)`,
  );
});
