import { AIRE, ESCOMBRO, esSolido, obtenerMaterial, type Mascara } from "@/sim/terreno/mascara";

// crateres-y-escombros: lo que se DIBUJA en cada píxel, derivado SIEMPRE de
// la máscara real y de nada más (crt-2) -- nunca un rastro aparte que pueda
// desincronizarse de la colisión real. "aire" y "escombro" son una lectura
// directa del material; "borde-quemado" es el único tipo inventado por este
// módulo, y se calcula geométricamente (cercanía a aire) en vez de
// guardarse como estado, así que no hay nada que persistir ni que
// sincronizar tras una huella nueva.
export type TipoVisualPixel = "aire" | "roca" | "borde-quemado" | "escombro";

// Ancho de la banda quemada alrededor de un cráter, en píxeles de MUNDO.
// Deliberadamente pequeño: solo tiene que leerse como "borde", no comerse
// el planeta entero, y cuanto más grande, más caro el barrido de pintarCompleta
// (ver el test de presupuesto de este mismo bloque).
export const ANCHO_BORDE_QUEMADO_PX = 3;

// Un sólido "está en el borde" si algún vecino dentro del radio declarado es
// aire -- geometría pura sobre la máscara, sin tabla de distancias ni
// estado que mantener entre huellas.
function tieneVecinoDeAire(mascara: Mascara, x: number, y: number, radio: number): boolean {
  const radioCuadrado = radio * radio;
  for (let dy = -radio; dy <= radio; dy++) {
    const limiteX = Math.floor(Math.sqrt(Math.max(0, radioCuadrado - dy * dy)));
    for (let dx = -limiteX; dx <= limiteX; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (!esSolido(mascara, x + dx, y + dy)) {
        return true;
      }
    }
  }
  return false;
}

export function clasificarPixelVisual(
  mascara: Mascara,
  x: number,
  y: number,
  anchoBorde: number = ANCHO_BORDE_QUEMADO_PX,
): TipoVisualPixel {
  const material = obtenerMaterial(mascara, x, y);
  if (material === AIRE) {
    return "aire";
  }
  if (material === ESCOMBRO) {
    return "escombro";
  }
  return tieneVecinoDeAire(mascara, x, y, anchoBorde) ? "borde-quemado" : "roca";
}
