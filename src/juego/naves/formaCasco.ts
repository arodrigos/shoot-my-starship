// Forma del casco con deterioro (nve-1). La silueta y sus abolladuras viven
// en src/sim (naves-silueta: la zona de impacto es la silueta dibujada y
// debe poder calcularse sin Phaser); aquí solo se reexportan y quedan los
// auxiliares de dibujo.
import { ANCHO_CASCO, type PuntoCasco } from "@/sim/naves/geometriaCasco";

export { nivelDanio, puntosCascoConDanio, type NivelDanio } from "@/sim/naves/geometriaCasco";

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

// Punto de anclaje de la tobera: la popa de la silueta, sobre el eje
// horizontal y un poco hacia dentro para que la llama quede en el polígono.
export function anclaTobera(dir: 1 | -1): PuntoCasco {
  return { x: -0.47 * ANCHO_CASCO * dir, y: 0 };
}
