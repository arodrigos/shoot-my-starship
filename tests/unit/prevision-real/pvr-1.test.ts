import { test } from "node:test";
import assert from "node:assert/strict";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { crearGeneradorAleatorio } from "@/sim/aleatorio";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { ALTURA_CANON_PX, alturaSuperficie, detenerseEnSuelo } from "@/sim/armas/resolver";
import { calcularPrevisualizacion, PASOS_PREVISUALIZACION } from "@/sim/armas/previsualizacion";
import type { Planeta, RegistroPlanetas } from "@/sim/gravedad/planetas";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 2400;
const ALTO = 1400;
const ORIGEN_X = 300;
const ORIGEN_Y = 1300;
const GRAVEDAD = 1;
const DERIVA = 0;

// Sistemas deterministas con 0 a 3 planetas alineados, variados por índice de
// combinación -- "varios planetas alineados" es, literalmente, el caso que el
// criterio pvr-1 exige cubrir, porque es donde una gravedad uniforme falsa
// diverge más de la curva real.
function sistemaDePlanetas(indice: number, azar: () => number): RegistroPlanetas {
  const cantidad = indice % 4;
  const planetas: Planeta[] = [];
  for (let i = 0; i < cantidad; i++) {
    planetas.push({
      id: i + 1,
      cx: 500 + i * 500 + azar() * 200,
      cy: 300 + azar() * 500,
      radio: 80 + azar() * 60,
      densidad: 0.5 + azar() * 1.5,
      pixelesVivos: Math.round((80 + azar() * 60) ** 2 * 3),
    });
  }
  return planetas;
}

// Reconstruye el vuelo real EXACTAMENTE como resolver.ts lo hace para un
// disparo de verdad (misma fórmula de inicial, mismo detenerseEnSuelo, mismos
// planetas), para comparar la previsualización contra algo independiente de
// su propia implementación, no contra sí misma.
function volarDeVerdad(mascara: ReturnType<typeof crearMascaraPlana>, anguloGrados: number, potencia: number, planetas: RegistroPlanetas) {
  // Mismo origen que resolverDisparo (y que calcularPrevisualizacion sin
  // origenY explícito): la altura de apoyo se LEE de la máscara, nunca se da
  // por supuesta -- si se diera por supuesta aquí, este test compararía la
  // previsualización contra un vuelo que no es el que el núcleo resolvería.
  const origenY = alturaSuperficie(mascara, ORIGEN_X) ?? ALTO - 1;
  const rad = (anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(potencia);
  const inicial = crearProyectil(ORIGEN_X, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  const detenerse = detenerseEnSuelo(mascara, ANCHO, ALTO);
  return simularVuelo(inicial, GRAVEDAD, DERIVA, detenerse, { planetas, grabarTrayectoria: true });
}

test("pvr-1 (camino crítico): la previsualización coincide, punto a punto y dentro de 1px, con los primeros pasos del vuelo real -- 200 combinaciones deterministas de ángulo, potencia y sistemas multipozo", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, ORIGEN_Y);
  const azar = crearGeneradorAleatorio(20261001);

  for (let i = 0; i < 200; i++) {
    const anguloGrados = 15 + azar() * 150;
    const potencia = 10 + azar() * 90;
    const planetas = sistemaDePlanetas(i, azar);

    const real = volarDeVerdad(mascara, anguloGrados, potencia, planetas);
    const previsualizacion = calcularPrevisualizacion({
      mascara,
      gravedad: GRAVEDAD,
      deriva: DERIVA,
      ancho: ANCHO,
      alto: ALTO,
      planetas,
      origenX: ORIGEN_X,
      anguloGrados,
      potencia,
      comportamiento: { tipo: "impacto-simple" },
    });

    assert.ok(previsualizacion.length > 0, `combinación ${i}: la previsualización no debe venir vacía`);
    assert.ok(
      previsualizacion.length <= PASOS_PREVISUALIZACION + 1,
      `combinación ${i}: la previsualización no puede superar el presupuesto de pasos declarado`,
    );
    assert.ok(real.trayectoria && previsualizacion.length <= real.trayectoria.length, `combinación ${i}: no puede haber más puntos que el propio vuelo real`);

    for (let j = 0; j < previsualizacion.length; j++) {
      const esperado = real.trayectoria![j];
      const obtenido = previsualizacion[j];
      assert.ok(
        Math.abs(obtenido.x - esperado.x) <= 1 && Math.abs(obtenido.y - esperado.y) <= 1,
        `combinación ${i}, paso ${j}: previsualización (${obtenido.x}, ${obtenido.y}) diverge del vuelo real (${esperado.x}, ${esperado.y})`,
      );
    }
  }
});

test("pvr-1: el láser (instantaneo) se previsualiza en línea recta, con gravedad y planetas anulados igual que el disparo real", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, ORIGEN_Y);
  const planetas: RegistroPlanetas = [{ id: 1, cx: 1000, cy: 700, radio: 150, densidad: 2, pixelesVivos: 60000 }];

  const previsualizacion = calcularPrevisualizacion({
    mascara,
    gravedad: GRAVEDAD,
    deriva: DERIVA,
    ancho: ANCHO,
    alto: ALTO,
    planetas,
    origenX: ORIGEN_X,
    anguloGrados: 30,
    potencia: 80,
    comportamiento: { tipo: "instantaneo" },
  });

  assert.ok(previsualizacion.length >= 2, "el láser debe dejar al menos un tramo dibujado");
  const [p0, p1] = previsualizacion;
  const anguloTrazado = Math.atan2(p0.y - p1.y, p1.x - p0.x);
  const anguloEsperado = (30 * Math.PI) / 180;
  assert.ok(
    Math.abs(anguloTrazado - anguloEsperado) < 0.01,
    `el láser debe previsualizarse en línea recta al ángulo disparado, no curvado por un planeta cercano (obtenido ${anguloTrazado}, esperado ${anguloEsperado})`,
  );
});
