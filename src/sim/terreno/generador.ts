import { createNoise2D } from "simplex-noise";
import { crearGeneradorAleatorio } from "@/sim/aleatorio";
import { crearMascaraVacia, SOLIDO, type Mascara } from "@/sim/terreno/mascara";

// Ruido simplex umbralizado: la misma pasada decide, píxel a píxel, si es
// sólido o no -- no hay paso intermedio de "generar el paisaje" y luego
// "calcular la máscara". Es indiferente a que la paleta final sea tierra o
// regolito de un mundo chatarra: cambiar de una a otra es cambiar el color
// con el que se pinta un SOLIDO, no este algoritmo.
const OCTAVAS = [
  { frecuencia: 0.6, amplitud: 1 },
  { frecuencia: 1.6, amplitud: 0.3 },
];

// Sin este sesgo el ruido puro no distingue arriba de abajo y el resultado
// sería una nube de motas en vez de un mundo con cielo arriba y masa abajo.
// El peso alto (>1) frente a la amplitud del ruido es a propósito: da una
// silueta de loma continua en vez de islas sueltas flotando sobre el vacío,
// que es indistinguible de un fallo del algoritmo a simple vista.
const PESO_PROFUNDIDAD = 1.1;
const UMBRAL = 0.05;

export function generarMascara(semilla: number, ancho: number, alto: number): Mascara {
  const aleatorio = crearGeneradorAleatorio(semilla);
  const ruido2D = createNoise2D(aleatorio);
  const mascara = crearMascaraVacia(ancho, alto);

  for (let y = 0; y < alto; y++) {
    // -1 arriba .. +1 abajo: es lo único que necesita el umbral para saber
    // "cuanto más abajo, más probable sólido".
    const profundidad = (y / alto) * 2 - 1;
    for (let x = 0; x < ancho; x++) {
      let valor = 0;
      for (const { frecuencia, amplitud } of OCTAVAS) {
        valor += ruido2D((x / ancho) * frecuencia, (y / alto) * frecuencia) * amplitud;
      }
      const densidad = valor + profundidad * PESO_PROFUNDIDAD;
      if (densidad > UMBRAL) {
        mascara.datos[y * ancho + x] = SOLIDO;
      }
    }
  }

  return mascara;
}
