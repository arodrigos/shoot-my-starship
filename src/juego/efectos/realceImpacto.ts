import { DANIO_REFERENCIA_ESCALA_MAXIMA } from "@/juego/efectos/ExplosionPorCapas";

// realce-impacto (rlc-1): mismo criterio de referencia que escalaDeDanio en
// ExplosionPorCapas.ts -- 60 es el daño máximo real del catálogo, así que es
// la escala natural para que la sacudida y el destello sean proporcionales
// al daño, no inventados. Puras y exportadas para que el unitario las ejerza
// sin un Phaser.Scene de por medio (mismo motivo que escalaDeDanio).
export const DURACION_SACUDIDA_IMPACTO_MS = 260;
export const DURACION_DESTELLO_DANIO_MS = 220;

const AMPLITUD_SACUDIDA_MINIMA = 0.004;
const AMPLITUD_SACUDIDA_MAXIMA = 0.02;

const INTENSIDAD_DESTELLO_MINIMA = 0.2;
const INTENSIDAD_DESTELLO_MAXIMA = 0.75;

function fraccionDanio(danio: number): number {
  return Math.max(0, Math.min(1, danio / DANIO_REFERENCIA_ESCALA_MAXIMA));
}

// Monótona y con tope duro (rlc-1): dos daños distintos dan amplitudes
// distintas salvo que ambos ya toquen el tope, y ningún daño, por grande que
// sea, supera AMPLITUD_SACUDIDA_MAXIMA.
export function amplitudSacudida(danio: number): number {
  return AMPLITUD_SACUDIDA_MINIMA + fraccionDanio(danio) * (AMPLITUD_SACUDIDA_MAXIMA - AMPLITUD_SACUDIDA_MINIMA);
}

// Mismo contrato que amplitudSacudida, para el destello de daño sobre la
// nave alcanzada -- proporcional al daño real y acotado, nunca fijo.
export function intensidadDestelloDanio(danio: number): number {
  return INTENSIDAD_DESTELLO_MINIMA + fraccionDanio(danio) * (INTENSIDAD_DESTELLO_MAXIMA - INTENSIDAD_DESTELLO_MINIMA);
}
