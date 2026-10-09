import { crearProyectil } from "@/sim/fisica/proyectil";
import { bordeDeSalida, simularVuelo } from "@/sim/fisica/vuelo";
import { POTENCIA_MAXIMA_PX_S, velocidadDesdePotencia } from "@/sim/balistica/potencia";
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

  const trazar = (solucion: SolucionBalistica, esMortero: boolean): IntentoBalistico & { readonly salioDePantalla: boolean } => {
    const v = velocidadDesdePotencia(solucion.potencia);
    const rad = anguloRad(solucion.anguloGrados);
    const inicial = crearProyectil(origenX, origenCanonY, v * Math.cos(rad), -v * Math.sin(rad));
    const { proyectil } = simularVuelo(inicial, gravedad, deriva, detenerse);
    return {
      solucion,
      esMortero,
      puntoDeImpacto: { x: proyectil.x, y: proyectil.y },
      viable: Math.abs(proyectil.x - objetivoX) <= TOLERANCIA_VIABLE_PX,
      salioDePantalla: bordeDeSalida(proyectil.x, proyectil.y, ancho, alto) !== null,
    };
  };

  return soluciones.map((solucion, indice) => {
    const esMortero = indice === indiceMortero;
    const intento = trazar(solucion, esMortero);
    if (!esMortero || !intento.salioDePantalla) return intento;
    // salida-pantalla: a potencia máxima el mortero asoma por encima del
    // borde y se pierde. Se baja la potencia hasta que el arco cabe: con
    // menos velocidad la raíz alta se acerca a 45° y su apex baja. Solo se
    // sustituye si se perdió por salir; un mortero tapado por un techo sigue
    // siendo no viable.
    for (const fraccion of FRACCIONES_POTENCIA_MORTERO) {
      const velocidad = POTENCIA_MAXIMA_PX_S * fraccion;
      const alta = (destinoX: number): SolucionBalistica | null => {
        const raices = resolverSolucionesBalisticas(origenX, origenCanonY, destinoX, alturaObjetivo, gravedad, velocidad);
        if (raices.length === 0) return null;
        return raices.reduce((a, b) => (Math.abs(a.anguloGrados - 90) <= Math.abs(b.anguloGrados - 90) ? a : b));
      };
      const primera = alta(objetivoX);
      if (!primera) break;
      let mejor = trazar(primera, true);
      if (mejor.salioDePantalla || !mejor.viable) continue;
      // El paso fijo de la integración desplaza el aterrizaje unos píxeles
      // respecto a la fórmula cerrada: se apunta a un destino corregido por
      // ese error para mantener la precisión del tiro a potencia máxima.
      for (let ronda = 0; ronda < 2 && mejor.viable; ronda++) {
        const corregida = alta(objetivoX - (mejor.puntoDeImpacto.x - objetivoX));
        if (!corregida) break;
        const candidato = trazar(corregida, true);
        if (candidato.salioDePantalla || Math.abs(candidato.puntoDeImpacto.x - objetivoX) >= Math.abs(mejor.puntoDeImpacto.x - objetivoX)) break;
        mejor = candidato;
      }
      return mejor;
    }
    return intento;
  });
}

// Fracciones de la potencia máxima que prueba el mortero cuando el arco a
// máxima se sale de la pantalla, de la más alta a la más baja. El paso es fino
// porque en un mundo bajo con montañas altas la ventana de potencias cuyo arco
// cabe entre la cima y el borde es de pocos puntos.
const FRACCIONES_POTENCIA_MORTERO: readonly number[] = Array.from({ length: 360 }, (_, i) => 0.95 - i * 0.0025);

// salida-pantalla: un tiro con el error de puntería ya aplicado puede salir
// de la pantalla (el mortero a poca altura de techo) y se pierde. La IA no
// gasta turnos así: baja la potencia, en pasos del 2 %, hasta que el vuelo
// queda dentro del encuadre. Devuelve la potencia (0-100) ya corregida.
export function potenciaSinSalirDePantalla(
  mascara: Mascara,
  origenX: number,
  anguloGrados: number,
  potencia: number,
  gravedad: number,
  deriva: number,
  ancho: number,
  alto: number,
): number {
  const origenCanonY = (alturaSuperficie(mascara, origenX) ?? alto - 1) - ALTURA_CANON_PX;
  const detenerse = detenerseEnSuelo(mascara, ancho, alto);
  const rad = anguloRad(anguloGrados);
  let actual = potencia;
  for (let intento = 0; intento < 40 && actual > 5; intento++) {
    const v = velocidadDesdePotencia(actual);
    const inicial = crearProyectil(origenX, origenCanonY, v * Math.cos(rad), -v * Math.sin(rad));
    const { proyectil } = simularVuelo(inicial, gravedad, deriva, detenerse);
    if (bordeDeSalida(proyectil.x, proyectil.y, ancho, alto) === null) return actual;
    actual *= 0.98;
  }
  return actual;
}
