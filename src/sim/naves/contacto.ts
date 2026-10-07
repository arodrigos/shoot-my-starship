import type { EstadoProyectil } from "@/sim/fisica/proyectil";
import type { IdNave } from "@/sim/partida/tipos";
import { puntosCascoVariante, type PuntoCasco, type VarianteNave } from "@/sim/naves/geometriaCasco";
import { RADIO_CASCO_NAVE_PX, type NavePosicion } from "@/sim/naves/impacto";

// contacto-honesto (con-1): dirección de dibujo de cada nave, fija por id --
// Partida.ts crea siempre la nave 0 con mirarHaciaMasX=true y la 1 con
// false, así que el núcleo puede reproducir esa misma convención sin
// depender de Phaser para saber qué mitad de la silueta (puntosCasco) le
// toca comparar.
export function direccionDeNave(id: IdNave): 1 | -1 {
  return id === 0 ? 1 : -1;
}

// arte-siluetas-3: la variante de silueta por id -- hoy coincide con el id
// porque el núcleo sigue siendo 0 | 1 (nucleo-n-naves generaliza esto),
// pero vive aquí y no en Nave.ts para que el roce (comprobarRocePaso, más
// abajo) compare siempre contra la MISMA silueta que se dibuja, nunca
// contra la de la variante 0 por defecto.
export function varianteDeNave(id: IdNave): VarianteNave {
  return id as VarianteNave;
}

// Ray casting estándar (par/impar de cruces con los lados del polígono):
// única implementación, compartida con src/juego/naves/opacidadCasco.ts
// (esc-5), para que "qué cae dentro de la silueta dibujada" no tenga dos
// respuestas posibles según quién pregunte.
export function dentroDelPoligono(x: number, y: number, puntos: readonly PuntoCasco[]): boolean {
  let dentro = false;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const pi = puntos[i];
    const pj = puntos[j];
    const cruza = pi.y > y !== pj.y > y && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

// con-1: el punto del segmento [x0,y0]-[x1,y1] más cercano a (cx, cy) --
// la proyección clampada a [0,1], no el punto final del paso, porque un
// vuelo rápido puede pasar de largo por delante de la nave en un único
// paso de integración sin que ninguno de sus dos extremos sea el punto de
// aproximación mínima real.
function puntoMasCercanoDelSegmento(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
): { readonly x: number; readonly y: number } {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const largo2 = dx * dx + dy * dy;
  if (largo2 === 0) {
    return { x: x0, y: y0 };
  }
  const t = Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / largo2));
  return { x: x0 + t * dx, y: y0 + t * dy };
}

export interface RoceNave {
  readonly nave: IdNave;
  readonly x: number;
  readonly y: number;
}

// con-1: el núcleo de la clasificación impacto/roce/fallo -- pura y
// determinista (mismos argumentos, mismo resultado, siempre). "Roce" es el
// paso cuya aproximación mínima a una nave queda FUERA de RADIO_CASCO_NAVE_PX
// (eso ya lo decide RastreadorImpactoNaves.comprobarPaso, que sigue exacto)
// pero DENTRO de la silueta dibujada (puntosCasco, esc-1) -- la mentira
// visual de la opción B hecha honesta en el resultado del turno, sin tocar
// nunca la integridad (con-3).
export function comprobarRocePaso(
  anterior: EstadoProyectil,
  actual: EstadoProyectil,
  naves: readonly NavePosicion[],
): RoceNave | null {
  for (const nave of naves) {
    const cercano = puntoMasCercanoDelSegmento(anterior.x, anterior.y, actual.x, actual.y, nave.x, nave.y);
    const localX = cercano.x - nave.x;
    const localY = cercano.y - nave.y;
    if (Math.hypot(localX, localY) <= RADIO_CASCO_NAVE_PX) {
      continue; // eso es impacto (o gracia de casco propio), no roce
    }
    if (dentroDelPoligono(localX, localY, puntosCascoVariante(varianteDeNave(nave.id), direccionDeNave(nave.id)))) {
      return { nave: nave.id, x: cercano.x, y: cercano.y };
    }
  }
  return null;
}

function distanciaPuntoSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Distancia de una detonación a la silueta que se DIBUJA (0 si cae dentro):
// es la medida del daño por área. Con el casco a escala 3 el contorno llega a
// ~100 u del centro, y medir al centro hacía que una explosión pegada al casco
// visible no contara como impacto (sil-2: lo que se ve como impacto, cuenta).
export function distanciaACasco(x: number, y: number, nave: NavePosicion): number {
  const puntos = puntosCascoVariante(varianteDeNave(nave.id), direccionDeNave(nave.id));
  const localX = x - nave.x;
  const localY = y - nave.y;
  if (dentroDelPoligono(localX, localY, puntos)) return 0;
  let minima = Infinity;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    minima = Math.min(minima, distanciaPuntoSegmento(localX, localY, puntos[j].x, puntos[j].y, puntos[i].x, puntos[i].y));
  }
  return minima;
}
