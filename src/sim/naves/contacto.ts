import type { EstadoProyectil } from "@/sim/fisica/proyectil";
import type { IdNave } from "@/sim/partida/tipos";
import { puntosCasco, type PuntoCasco } from "@/sim/naves/geometriaCasco";
import { RADIO_CASCO_NAVE_PX, type NavePosicion } from "@/sim/naves/impacto";

// contacto-honesto (con-1): dirección de dibujo de cada nave, fija por id --
// Partida.ts crea siempre la nave 0 con mirarHaciaMasX=true y la 1 con
// false, así que el núcleo puede reproducir esa misma convención sin
// depender de Phaser para saber qué mitad de la silueta (puntosCasco) le
// toca comparar.
export function direccionDeNave(id: IdNave): 1 | -1 {
  return id === 0 ? 1 : -1;
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
    if (dentroDelPoligono(localX, localY, puntosCasco(direccionDeNave(nave.id)))) {
      return { nave: nave.id, x: cercano.x, y: cercano.y };
    }
  }
  return null;
}
