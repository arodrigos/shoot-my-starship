import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { resolverSolucionesBalisticas, type SolucionBalistica } from "@/sim/balistica/solucionador";
import { ALTURA_CANON_PX, alturaSuperficie, detenerseEnSuelo } from "@/sim/armas/resolver";
import type { Mascara } from "@/sim/terreno/mascara";

// Un disparo que aterriza más lejos de esto del objetivo se considera
// bloqueado por el terreno en vez de "casi exacto": la solución cerrada
// acierta a <=2px en terreno llano (armas-7), así que cualquier cosa por
// encima de un margen pequeño solo puede venir de haber tocado algo antes
// de llegar.
const TOLERANCIA_VIABLE_PX = 6;

export interface IntentoBalistico {
  readonly solucion: SolucionBalistica;
  // true si es la raíz de ángulo más cercano a 90° de las disponibles en
  // este intento (mortero/lobo alto); false si es la más rasante (tenso).
  // Con una sola raíz disponible no hay comparación posible: se marca como
  // "mortero" solo si su ángulo está más cerca de 90 que de 0/180.
  readonly esMortero: boolean;
  readonly puntoDeImpacto: { readonly x: number; readonly y: number };
  // false si el proyectil se detuvo por tocar algo que no es el objetivo
  // (el propio trazado lo descubre simulando el vuelo con la MISMA función
  // de parada que resolverDisparo, ia-2): la trayectoria elegida nunca
  // intersecta el obstáculo porque, si lo hiciera, no se marcaría viable.
  readonly viable: boolean;
}

function anguloRad(grados: number): number {
  return (grados * Math.PI) / 180;
}

// Traza cada raíz de la solución balística exacta contra el terreno real,
// con la misma integración y la misma condición de parada que usará el
// disparo de verdad (resolverDisparo): es la mitad "descarta lo bloqueado"
// de la IA de dos capas del diseño. objetivoY se toma de la superficie bajo
// el objetivo (no de su cañón) porque el proyectil impacta a nivel de
// terreno, no a la altura desde la que dispara.
export function trazarIntentos(
  mascara: Mascara,
  origenX: number,
  objetivoX: number,
  gravedad: number,
  deriva: number,
  ancho: number,
  alto: number,
): IntentoBalistico[] {
  const alturaOrigen = alturaSuperficie(mascara, origenX) ?? alto - 1;
  const alturaObjetivo = alturaSuperficie(mascara, objetivoX) ?? alto - 1;
  const origenCanonY = alturaOrigen - ALTURA_CANON_PX;

  const soluciones = resolverSolucionesBalisticas(origenX, origenCanonY, objetivoX, alturaObjetivo, gravedad);
  if (soluciones.length === 0) {
    return [];
  }

  const distanciasA90 = soluciones.map((s) => Math.abs(s.anguloGrados - 90));
  const indiceMortero = distanciasA90.indexOf(Math.min(...distanciasA90));
  const detenerse = detenerseEnSuelo(mascara, ancho, alto);

  return soluciones.map((solucion, indice) => {
    const v = velocidadDesdePotencia(solucion.potencia);
    const rad = anguloRad(solucion.anguloGrados);
    const inicial = crearProyectil(origenX, origenCanonY, v * Math.cos(rad), -v * Math.sin(rad));
    const { proyectil } = simularVuelo(inicial, gravedad, deriva, detenerse);
    const viable = Math.abs(proyectil.x - objetivoX) <= TOLERANCIA_VIABLE_PX;
    return {
      solucion,
      esMortero: indice === indiceMortero,
      puntoDeImpacto: { x: proyectil.x, y: proyectil.y },
      viable,
    };
  });
}
