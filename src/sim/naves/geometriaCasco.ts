// Geometría COMPARTIDA del casco (sin Phaser): vive en src/sim porque la zona
// de impacto es EXACTAMENTE la silueta que se dibuja (naves-silueta) y el
// núcleo la necesita con datos deterministas -- src/juego la lee, nunca al
// revés (comprobar-frontera-nucleo.mjs).
//
// ESCALA_DIBUJO_NAVE es la única palanca de tamaño: multiplica la caja base
// (46x44) de la que salen las cuatro siluetas. A 1,5 las naves miden la mitad
// que a la escala 3 de antes (petición de Adrián) y ya no hay un círculo de
// colisión aparte: lo que se ve es lo que cuenta.
export const ESCALA_DIBUJO_NAVE = 1.5;

const ANCHO_CASCO_BASE = 46;
const ALTO_CASCO_BASE = 44;
const LARGO_CANON_BASE = 30;

export const ANCHO_CASCO = ANCHO_CASCO_BASE * ESCALA_DIBUJO_NAVE;
export const ALTO_CASCO = ALTO_CASCO_BASE * ESCALA_DIBUJO_NAVE;
export const LARGO_CANON = LARGO_CANON_BASE * ESCALA_DIBUJO_NAVE;

export interface PuntoCasco {
  readonly x: number;
  readonly y: number;
}

export type VarianteNave = 0 | 1 | 2 | 3;

// Semisilueta superior (y negativa = arriba) de cada familia, del morro hacia
// la popa, en fracciones de ANCHO_CASCO y ALTO_CASCO con el morro hacia +x. El
// polígono completo es el morro, estos puntos y su reflejo vertical: las alas
// o aletas son simétricas por construcción y la tobera es el último tramo,
// estrecho, de la popa. De 10 a 16 vértices por silueta.
//   0 «caza»: alas en flecha y fuselaje medio.
//   1 «dardo»: fuselaje largo y fino con aletas mínimas.
//   2 «platillo»: cuerpo ancho y bajo, de morro romo pero en punta.
//   3 «ala delta»: alas anchas hacia atrás.
const SEMISILUETAS: Readonly<Record<VarianteNave, readonly (readonly [number, number])[]>> = {
  0: [
    [0.3, -0.1],
    [0.02, -0.17],
    [-0.14, -0.485],
    [-0.34, -0.485],
    [-0.3, -0.15],
    [-0.38, -0.09],
    [-0.5, -0.08],
  ],
  1: [
    [0.2, -0.045],
    [-0.08, -0.07],
    [-0.2, -0.136],
    [-0.36, -0.136],
    [-0.3, -0.06],
    [-0.38, -0.045],
    [-0.5, -0.035],
  ],
  2: [
    [0.35, -0.14],
    [0.05, -0.273],
    [-0.28, -0.273],
    [-0.36, -0.1],
    [-0.42, -0.075],
    [-0.52, -0.06],
  ],
  3: [
    [0.25, -0.08],
    [0.02, -0.12],
    [-0.3, -0.485],
    [-0.4, -0.485],
    [-0.34, -0.14],
    [-0.4, -0.09],
    [-0.5, -0.07],
  ],
};

const MORRO_X: Readonly<Record<VarianteNave, number>> = { 0: 0.543, 1: 0.63, 2: 0.567, 3: 0.63 };

export function puntosCascoVariante(variante: VarianteNave, dir: 1 | -1): readonly PuntoCasco[] {
  const semi = SEMISILUETAS[variante];
  const superior = semi.map(([x, y]) => ({ x: x * ANCHO_CASCO * dir, y: y * ALTO_CASCO }));
  const inferior = superior.map((p) => ({ x: p.x, y: -p.y })).reverse();
  return [{ x: MORRO_X[variante] * ANCHO_CASCO * dir, y: 0 }, ...superior, ...inferior];
}

// Atajo de la variante 0: es la silueta que usan los tests heredados.
export function puntosCasco(dir: 1 | -1): readonly PuntoCasco[] {
  return puntosCascoVariante(0, dir);
}

// Caja delimitadora de la silueta dibujada, sin deterioro (las abolladuras
// solo la meten hacia dentro). Lo usa el tamaño del proyectil.
export function cajaPuntos(puntos: readonly PuntoCasco[]): { readonly ancho: number; readonly alto: number } {
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  return { ancho: Math.max(...xs) - Math.min(...xs), alto: Math.max(...ys) - Math.min(...ys) };
}

export function cajaCasco(dir: 1 | -1, variante: VarianteNave = 0): { readonly ancho: number; readonly alto: number } {
  return cajaPuntos(puntosCascoVariante(variante, dir));
}

// Radio envolvente máximo de las cuatro siluetas desde el centro: solo sirve de
// descarte rápido y de holgura para colocar o separar naves, nunca como zona de
// impacto (esa es el polígono).
export const RADIO_ENVOLVENTE_NAVE_PX = Math.ceil(
  Math.max(
    ...([0, 1, 2, 3] as const).flatMap((v) => puntosCascoVariante(v, 1).map((p) => Math.hypot(p.x, p.y))),
  ),
);

// Mitad de la altura de la silueta más alta: cuánto sobresale una nave por
// encima y por debajo de su centro.
export const SEMIALTO_MAXIMO_NAVE_PX = Math.ceil(
  Math.max(...([0, 1, 2, 3] as const).flatMap((v) => puntosCascoVariante(v, 1).map((p) => Math.abs(p.y)))),
);

export type NivelDanio = "alta" | "media" | "baja";

// Umbrales elegidos para que los tres tramos sean anchos y no se puedan
// confundir por un punto de integridad de diferencia: >66 intacta, 34-66
// dañada, <=33 crítica.
export function nivelDanio(integridad: number): NivelDanio {
  if (integridad > 66) return "alta";
  if (integridad > 33) return "media";
  return "baja";
}

function abolladuraEntre(a: PuntoCasco, b: PuntoCasco, profundidad: number): PuntoCasco {
  const medioX = (a.x + b.x) / 2;
  const medioY = (a.y + b.y) / 2;
  return { x: medioX - medioX * profundidad, y: medioY - medioY * profundidad };
}

// Silueta con abolladuras según el tramo de daño. Vive en el núcleo para que
// el polígono dañado que se ve sea el que colisiona. Los vértices originales no
// se mueven (solo se inserta uno entre dos), así que la caja no cambia.
// Lomo del fuselaje (vértices 1-2) en «media»; en «baja» además el borde de
// salida del ala superior (vértices 4-5).
export function puntosCascoConDanio(dir: 1 | -1, nivel: NivelDanio, variante: VarianteNave = 0): PuntoCasco[] {
  const base = [...puntosCascoVariante(variante, dir)];
  if (nivel === "alta") return base;
  const lomo = abolladuraEntre(base[1], base[2], 0.3);
  if (nivel === "media") return [base[0], base[1], lomo, ...base.slice(2)];
  const cola = abolladuraEntre(base[4], base[5], 0.45);
  return [base[0], base[1], lomo, base[2], base[3], base[4], cola, ...base.slice(5)];
}
