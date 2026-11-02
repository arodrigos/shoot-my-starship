// Los sonidos son datos: arrays de 21 parámetros en el orden del diseñador de
// ZzFX 1.4.0 (volumen, aleatoriedad, frecuencia, ataque, sostenido, liberación,
// forma, curva, deslizamiento, delta, salto de tono, tiempo de salto,
// repetición, ruido, modulación, bitCrush, retardo, volumen sostenido, caída,
// trémolo, filtro). Cambiar un timbre es editar una línea, sin tocar lógica.
import { construirMuestras, type ParametrosZzfx } from "@/juego/audio/zzfx";

export type SuperficieImpacto = "planeta" | "nave" | "escudo" | "rebote";

export const SONIDO_DISPARO_POR_ARMA: Readonly<Record<string, ParametrosZzfx>> = {
  // Retumba: grave, con ruido y caída larga.
  "pepinazo-cortesia": [1, 0.05, 70, 0, 0.04, 0.175, 3, 1.4, -2, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.8, 0.05, 0, 0],
  "zanjadora-manolita": [0.9, 0.05, 140, 0, 0.025, 0.125, 2, 1, -4, 0, 0, 0, 0, 0.3, 0, 0, 0, 0.7, 0.03, 0, 600],
  "vertedero-portatil": [0.9, 0.1, 90, 0.02, 0.05, 0.15, 4, 1, 1, 0, 0, 0, 0, 1.2, 0, 0, 0, 0.8, 0.05, 0, 400],
  // Chisporrotea: repeticiones rápidas y ruido.
  "racimo-de-tuppers": [0.8, 0.2, 520, 0, 0.02, 0.1, 4, 1, 0, 0, 0, 0, 0.05, 0.3, 0, 0, 0, 1, 0, 0.6, 0],
  "pelota-de-chatarra": [0.8, 0.1, 260, 0, 0.015, 0.075, 1, 1, 6, 0, 0, 0, 0, 0.1, 0, 0, 0, 1, 0, 0, 0],
  "graviton-segunda-mano": [0.8, 0, 180, 0.08, 0.075, 0.15, 0, 1, 0, 0.5, 0, 0, 0, 0, 40, 0, 0, 0.9, 0.1, 0, 0],
  despedida: [0.9, 0.05, 330, 0, 0.01, 0.15, 2, 1, -8, 0, 0, 0, 0, 0, 0, 0.2, 0, 1, 0, 0, 0],
  "barrena-planetaria": [0.8, 0.05, 110, 0.05, 0.075, 0.1, 2, 1, 0, 0, 0, 0, 0.03, 0.2, 0, 0, 0, 0.9, 0.05, 0.4, 0],
  // Zumba: onda sostenida con vibrato.
  "rayo-laser": [0.7, 0, 880, 0, 0.075, 0.06, 0, 1, -10, 0, 0, 0, 0, 0, 12, 0, 0, 1, 0, 0.3, 0],
  "mosca-cojonera": [0.6, 0.3, 700, 0.02, 0.1, 0.075, 0, 1, 0, 0, 0, 0, 0.04, 0, 60, 0, 0, 0.9, 0, 0.8, 0],
  "gancho-pegajoso": [0.8, 0.05, 200, 0, 0.025, 0.1, 3, 1, 12, 0, 0, 0, 0, 0.1, 0, 0, 0.025, 0.8, 0, 0, 0],
  "minirobot-saltaplanetas": [0.7, 0.05, 440, 0, 0.025, 0.125, 1, 1, 0, 0, 220, 0.06, 0, 0, 0, 0, 0, 1, 0, 0, 0],
};

// Un arma sin entrada (por ejemplo, una futura) suena a un disparo genérico en
// vez de callar.
export const SONIDO_DISPARO_POR_DEFECTO: ParametrosZzfx = [0.8, 0.1, 400, 0, 0.02, 0.075, 2, 1, -3, 0, 0, 0, 0, 0.05, 0, 0, 0, 1, 0, 0, 0];

export const SONIDO_IMPACTO_POR_SUPERFICIE: Readonly<Record<SuperficieImpacto, ParametrosZzfx>> = {
  planeta: [1, 0.1, 60, 0, 0.025, 0.2, 4, 1, -1, 0, 0, 0, 0, 1.5, 0, 0, 0, 0.8, 0.05, 0, 500],
  nave: [1, 0.1, 160, 0, 0.015, 0.15, 2, 1.5, -5, 0, 0, 0, 0, 0.8, 0, 0.1, 0, 0.8, 0.02, 0, 0],
  escudo: [0.8, 0.05, 900, 0, 0.05, 0.175, 0, 1, 0, 0, 0, 0, 0.08, 0, 30, 0, 0.02, 0.8, 0, 0.5, 0],
  rebote: [0.6, 0.1, 500, 0, 0.005, 0.06, 1, 1, 15, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
};

export const SONIDO_TICTAC_MECHA: ParametrosZzfx = [0.5, 0, 1100, 0, 0.005, 0.015, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
export const SONIDO_TICTAC_MINA: ParametrosZzfx = [0.5, 0, 700, 0, 0.005, 0.015, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];

// Función pura: de qué está hecho lo que golpea el proyectil. `detonacion`
// false es un roce (el proyectil sigue o rebota sin explotar).
export function superficieDeImpacto(datos: { readonly impactoNave?: number; readonly detonacion: boolean }, escudoTurnosObjetivo: number): SuperficieImpacto {
  if (!datos.detonacion) return "rebote";
  if (datos.impactoNave === undefined) return "planeta";
  return escudoTurnosObjetivo > 0 ? "escudo" : "nave";
}

export function clavesSonidos(): readonly (readonly [string, ParametrosZzfx])[] {
  return [
    ...Object.entries(SONIDO_DISPARO_POR_ARMA).map(([id, p]) => [`disparo:${id}`, p] as const),
    ["disparo:", SONIDO_DISPARO_POR_DEFECTO] as const,
    ...Object.entries(SONIDO_IMPACTO_POR_SUPERFICIE).map(([id, p]) => [`impacto:${id}`, p] as const),
    ["tictac-mecha:", SONIDO_TICTAC_MECHA] as const,
    ["tictac-mina:", SONIDO_TICTAC_MINA] as const,
  ];
}

// Generador pseudoaleatorio con semilla (mulberry32): el azar de ZzFX solo
// afina el tono y debe ser reproducible, nunca Math.random.
export function crearAleatorio(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function precalcularMuestras(frecuenciaMuestreo?: number): Map<string, Float32Array<ArrayBuffer>> {
  const mapa = new Map<string, Float32Array<ArrayBuffer>>();
  for (const [clave, parametros] of clavesSonidos()) {
    mapa.set(clave, construirMuestras(parametros, crearAleatorio(1), frecuenciaMuestreo));
  }
  return mapa;
}
