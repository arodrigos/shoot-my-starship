import type { Arma } from "@/sim/armas/tipos";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { familiaVisualDe, puntosSilueta, type FamiliaVisual, type PuntoProyectil } from "@/juego/proyectiles/geometriaProyectil";

// Definición ÚNICA del aspecto de cada arma (arm-1): el selector pinta el
// trazado SVG con trazadoSvg() y Phaser hornea los mismos vértices con
// hornearArmas.ts. Sin Phaser ni DOM, para poder comprobar en Node que las
// dos vistas salen de la misma entrada.
export type TipoEstela = "llama" | "humo" | "ninguna";

export interface PaletaArma {
  readonly cuerpo: number;
  readonly borde: number;
  readonly brillo: number;
  readonly estela: number;
}

export interface AspectoArma {
  readonly armaId: string;
  readonly familia: FamiliaVisual;
  readonly puntos: readonly PuntoProyectil[];
  readonly paleta: PaletaArma;
  readonly estela: TipoEstela;
  // rad/s de giro propio ADEMÁS del rumbo; 0 en lo que no rueda.
  readonly giroRadS: number;
}

// Giro de las armas que ruedan: 720°/s, bien por encima de los 90°/s que
// exige arm-2 y todavía legible a 60 fps (12° por frame).
export const GIRO_RODANTE_RAD_S = 4 * Math.PI;

// Presupuesto global de partículas vivas (invariante del bloque): el mismo
// 120/240 del diseño, partido por el ancho CSS del lienzo.
export const ANCHO_VIEWPORT_ESTRECHO_PX = 600;
export function presupuestoParticulas(anchoCssPx: number): number {
  return anchoCssPx < ANCHO_VIEWPORT_ESTRECHO_PX ? 120 : 240;
}

// Tono base por familia (grados HSL). Dentro de la familia, cada arma se
// desplaza en el tono según su posición en el catálogo, así dos armas de la
// misma familia (siete "bomba") no comparten color además de no compartir
// silueta.
const TONO_FAMILIA: Readonly<Record<FamiliaVisual, number>> = {
  bomba: 28,
  capsula: 195,
  racimo: 290,
  chatarra: 75,
  orbe: 255,
  flecha: 340,
  broca: 160,
  haz: 55,
};
const PASO_TONO_EN_FAMILIA = 22;

const ESTELA_POR_FAMILIA: Readonly<Record<FamiliaVisual, TipoEstela>> = {
  bomba: "llama",
  capsula: "llama",
  racimo: "humo",
  chatarra: "humo",
  orbe: "ninguna",
  flecha: "llama",
  broca: "humo",
  haz: "ninguna",
};

function hslAHex(h: number, s: number, l: number): number {
  const tono = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const canal = (n: number): number => {
    const k = (n + tono / 30) % 12;
    const valor = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(valor * 255);
  };
  return (canal(0) << 16) | (canal(8) << 8) | canal(4);
}

function paletaDe(tono: number): PaletaArma {
  return {
    cuerpo: hslAHex(tono, 0.62, 0.55),
    borde: hslAHex(tono, 0.55, 0.2),
    brillo: hslAHex(tono, 0.7, 0.82),
    estela: hslAHex(tono + 12, 0.9, 0.62),
  };
}

function construir(): ReadonlyMap<string, AspectoArma> {
  const vistas = new Map<FamiliaVisual, number>();
  const mapa = new Map<string, AspectoArma>();
  for (const arma of CATALOGO_ARMAS) {
    const familia = familiaVisualDe(arma);
    const orden = vistas.get(familia) ?? 0;
    vistas.set(familia, orden + 1);
    mapa.set(arma.id, {
      armaId: arma.id,
      familia,
      puntos: puntosSilueta(arma),
      paleta: paletaDe(TONO_FAMILIA[familia] + orden * PASO_TONO_EN_FAMILIA),
      estela: ESTELA_POR_FAMILIA[familia],
      giroRadS: familia === "chatarra" ? GIRO_RODANTE_RAD_S : 0,
    });
  }
  return mapa;
}

const ASPECTOS = construir();

export function aspectosDelCatalogo(): readonly AspectoArma[] {
  return [...ASPECTOS.values()];
}

// Un arma fuera del catálogo (un fixture) cae al aspecto de la primera, igual
// que ya hacía el animador con CATALOGO_ARMAS[0].
export function aspectoDeArma(arma: Pick<Arma, "id"> | undefined): AspectoArma {
  return (arma && ASPECTOS.get(arma.id)) ?? (ASPECTOS.get(CATALOGO_ARMAS[0].id) as AspectoArma);
}

export function aspectoDeId(armaId: string): AspectoArma {
  return aspectoDeArma({ id: armaId });
}

export function nombreTextura(armaId: string): string {
  return `arma-${armaId}`;
}

export function colorCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

// Trazado SVG de un contorno cerrado, con decimales fijos para que dos
// llamadas con la misma entrada den la misma cadena.
export function trazadoSvg(puntos: readonly PuntoProyectil[]): string {
  return puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z";
}

export function trazadoDeArma(armaId: string): string {
  return trazadoSvg(aspectoDeId(armaId).puntos);
}

// Mitad de la caja que contiene la silueta (centrada en el origen): el
// horneado y el viewBox del icono usan el mismo valor.
export function radioEnvolvente(puntos: readonly PuntoProyectil[]): number {
  return Math.max(...puntos.map((p) => Math.hypot(p.x, p.y)));
}
