import type { RectCss } from "@/juego/camara/zonasOcupadas";

export type AnclajeAvisos = "arriba" | "sobre-consola";

export const TOP_CAPA_AVISOS_PX = 130;
export const HUECO_SOBRE_CONSOLA_PX = 8;
export const ANCHO_CAPA_AVISOS_PX = 340;

export interface ViewportCss {
  readonly ancho: number;
  readonly alto: number;
}

// Rectángulo de la capa de avisos (centrada, min(92vw, 340px) de ancho) en cada
// anclaje, acotado al viewport. null si «sobre-consola» no cabe encima de la
// zona: entonces no es una opción, en vez de dejar la capa sobre la consola.
export function rectanguloCapa(anclaje: AnclajeAvisos, consola: RectCss | null, viewport: ViewportCss, altoCapa: number): RectCss | null {
  const ancho = Math.min(viewport.ancho * 0.92, ANCHO_CAPA_AVISOS_PX);
  const x = (viewport.ancho - ancho) / 2;
  if (anclaje === "arriba") {
    const y = Math.max(0, Math.min(TOP_CAPA_AVISOS_PX, viewport.alto - altoCapa));
    return { x, y, ancho, alto: altoCapa };
  }
  if (consola === null) return null;
  const y = consola.y - HUECO_SOBRE_CONSOLA_PX - altoCapa;
  return y < 0 ? null : { x, y, ancho, alto: altoCapa };
}

function solape(a: RectCss, b: RectCss): number {
  const w = Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function solapeTotal(capa: RectCss, naves: readonly RectCss[]): number {
  return naves.reduce((suma, n) => suma + solape(capa, n), 0);
}

// Elige el anclaje que no pisa ninguna nave; si los dos la pisan, el de menos
// área; en el empate, «arriba» (el sitio de siempre). Pura y determinista.
export function elegirAnclajeAvisos(navesCss: readonly RectCss[], consola: RectCss | null, viewport: ViewportCss, altoCapa: number): AnclajeAvisos {
  const arriba = rectanguloCapa("arriba", consola, viewport, altoCapa);
  const sobre = rectanguloCapa("sobre-consola", consola, viewport, altoCapa);
  if (sobre === null || arriba === null) return "arriba";
  return solapeTotal(sobre, navesCss) < solapeTotal(arriba, navesCss) ? "sobre-consola" : "arriba";
}

// true si, en ese anclaje, la capa pisaría alguna nave: entonces los avisos
// pasan por encima sin recoger toques.
export function anclajePisaNaves(anclaje: AnclajeAvisos, navesCss: readonly RectCss[], consola: RectCss | null, viewport: ViewportCss, altoCapa: number): boolean {
  const capa = rectanguloCapa(anclaje, consola, viewport, altoCapa);
  return capa !== null && solapeTotal(capa, navesCss) > 0;
}
