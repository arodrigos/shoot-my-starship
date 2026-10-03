// naves-siluetas: el "deterioro visible según la integridad" que pide el
// diseño no puede ser solo un desvanecido de alfa (lo que ya hacía
// actualizarIntegridad) -- nve-1 exige que la silueta cambie de FORMA
// perceptible entre los tres tramos, no solo de opacidad. Esta forma vive
// en src/juego (es puro dibujo, no física) y parte siempre de la misma
// puntosCasco() de src/sim: la abolladura es un vértice adicional empujado
// hacia el centro del casco, nunca un polígono nuevo desde cero, para que
// el "chapa abollada" del diseño se lea como daño sobre la MISMA nave, no
// como una nave distinta.
import { ALTO_CASCO, ANCHO_CASCO, puntosCascoVariante, type PuntoCasco, type VarianteNave } from "@/sim/naves/geometriaCasco";

export type NivelDanio = "alta" | "media" | "baja";

// Umbrales elegidos para que los tres tramos sean anchos y no se puedan
// confundir por un punto de integridad de diferencia: >66 intacta, 34-66
// dañada, <=33 crítica -- los mismos cortes que ya usa el criterio en
// lenguaje llano ("alta, media y baja").
export function nivelDanio(integridad: number): NivelDanio {
  if (integridad > 66) return "alta";
  if (integridad > 33) return "media";
  return "baja";
}

// Empuja el punto medio de dos vértices consecutivos hacia el centro del
// casco (0,0) una fracción de la distancia -- una abolladura, no un pico
// hacia fuera, porque "chapa abollada" es concava por definición.
function abolladuraEntre(a: PuntoCasco, b: PuntoCasco, profundidad: number): PuntoCasco {
  const medioX = (a.x + b.x) / 2;
  const medioY = (a.y + b.y) / 2;
  return {
    x: medioX - medioX * profundidad,
    y: medioY - medioY * profundidad,
  };
}

// Silueta base + abolladuras según el tramo de daño. `puntosCasco` da
// siempre los mismos 5 vértices [morro-inferior, morro-superior, cabina,
// aleta-superior, aleta-inferior]; aquí se insertan vértices de abolladura
// entre ellos, nunca se mueven los originales, así que la caja delimitadora
// (cajaCasco, de la que dependen esc-1/esc-2/esc-6) no cambia y el tamaño
// legible del bloque escala-legible sigue intacto.
export function puntosCascoConDanio(dir: 1 | -1, nivel: NivelDanio, variante: VarianteNave = 0): PuntoCasco[] {
  const base = puntosCascoVariante(variante, dir) as PuntoCasco[];
  if (nivel === "alta") {
    return [...base];
  }

  const profundidadMedia = 0.16;
  const abolladuraSuperior = abolladuraEntre(base[1], base[2], profundidadMedia);
  const conAbolladuraMedia = [base[0], base[1], abolladuraSuperior, base[2], base[3], base[4]];

  if (nivel === "media") {
    return conAbolladuraMedia;
  }

  // baja: una segunda abolladura, más profunda, en la aleta de cola --
  // dos golpes visibles en vez de uno, y más marcados que en "media".
  const profundidadBaja = 0.28;
  const abolladuraCola = abolladuraEntre(base[3], base[4], profundidadBaja);
  return [base[0], base[1], abolladuraSuperior, base[2], base[3], abolladuraCola, base[4]];
}

// Hash FNV-1a de 32 bits sobre las coordenadas redondeadas (evitan que un
// error de coma flotante de última cifra cuente como "forma distinta"): es
// una función pura de los puntos que se van a dibujar, así que dos tramos
// con la misma silueta dan siempre el mismo hash y dos siluetas distintas
// casi nunca colisionan -- suficiente para que el e2e de nve-1 compruebe
// "cambia de forma" sin tener que leer píxeles del canvas.
export function hashPuntos(puntos: readonly PuntoCasco[]): number {
  let hash = 0x811c9dc5;
  for (const punto of puntos) {
    for (const valor of [Math.round(punto.x * 100), Math.round(punto.y * 100)]) {
      hash ^= valor & 0xffffffff;
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return hash >>> 0;
}

// Punto de anclaje de la tobera (motor trasero): siempre en el extremo
// opuesto a la dirección en la que mira la nave, sobre el eje horizontal --
// ni puntosCasco ni cajaCasco lo necesitan, así que vive aquí en vez de en
// geometriaCasco.
export function anclaTobera(dir: 1 | -1): PuntoCasco {
  return { x: -0.58 * ANCHO_CASCO * dir, y: 0.05 * ALTO_CASCO };
}
