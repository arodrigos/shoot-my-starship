import type { IdNave } from "@/sim/partida/tipos";
import {
  nivelDanio,
  puntosCascoConDanio,
  type PuntoCasco,
  type VarianteNave,
} from "@/sim/naves/geometriaCasco";

export interface NavePosicion {
  readonly id: IdNave;
  readonly x: number;
  readonly y: number;
  // Con la integridad la silueta lleva sus abolladuras (y colisiona con ellas);
  // sin dato se toma la nave intacta.
  readonly integridad?: number;
}

// Única regla de hacia dónde mira cada nave: la cáscara (Partida.ts) la lee de
// aquí en vez de repetirla, porque las dos copias ya se separaron una vez y el
// asiento 2 se medía contra la silueta reflejada de la que se veía.
export function direccionDeNave(id: IdNave): 1 | -1 {
  return id % 2 === 0 ? 1 : -1;
}

// La variante de silueta por id: vive aquí y no en Nave.ts para que la zona de
// impacto compare siempre contra la MISMA silueta que se dibuja.
export function varianteDeNave(id: IdNave): VarianteNave {
  return id as VarianteNave;
}

// Ray casting estándar (par/impar de cruces con los lados del polígono):
// única implementación, compartida con la cáscara y con verificar:siluetas,
// para que «qué cae dentro de la silueta dibujada» no tenga dos respuestas.
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

// El polígono (en coordenadas locales de la nave) que se dibuja y que colisiona.
export function poligonoDeNave(nave: NavePosicion): readonly PuntoCasco[] {
  return puntosCascoConDanio(direccionDeNave(nave.id), nivelDanio(nave.integridad ?? 100), varianteDeNave(nave.id));
}

function distanciaPuntoSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Distancia de un punto (coordenadas locales) al polígono: 0 si cae dentro.
export function distanciaAPoligono(x: number, y: number, puntos: readonly PuntoCasco[]): number {
  if (dentroDelPoligono(x, y, puntos)) return 0;
  let minima = Infinity;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    minima = Math.min(minima, distanciaPuntoSegmento(x, y, puntos[j].x, puntos[j].y, puntos[i].x, puntos[i].y));
  }
  return minima;
}

// Distancia de una detonación a la silueta que se DIBUJA (0 si cae dentro): es
// la medida del daño por área. El daño máximo es para quien está dentro y cae a
// 0 al llegar al radio de efecto, sin suelos ni atajos.
export function distanciaACasco(x: number, y: number, nave: NavePosicion): number {
  return distanciaAPoligono(x - nave.x, y - nave.y, poligonoDeNave(nave));
}

// Primer corte (el más cercano al origen del segmento) del segmento
// a→b con los lados del polígono, o el propio origen si ya está dentro. Se
// cruza el SEGMENTO entero, no solo su extremo, para que un proyectil rápido
// no atraviese un ala fina sin tocarla (túnel).
export function primerCorteSegmentoPoligono(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  puntos: readonly PuntoCasco[],
): { readonly x: number; readonly y: number } | null {
  if (dentroDelPoligono(ax, ay, puntos)) return { x: ax, y: ay };
  const dx = bx - ax;
  const dy = by - ay;
  let mejorT = Infinity;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const ex = puntos[i].x - puntos[j].x;
    const ey = puntos[i].y - puntos[j].y;
    const den = dx * ey - dy * ex;
    if (den === 0) continue;
    const wx = puntos[j].x - ax;
    const wy = puntos[j].y - ay;
    const t = (wx * ey - wy * ex) / den;
    const u = (wx * dy - wy * dx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < mejorT) mejorT = t;
  }
  return mejorT === Infinity ? null : { x: ax + mejorT * dx, y: ay + mejorT * dy };
}
