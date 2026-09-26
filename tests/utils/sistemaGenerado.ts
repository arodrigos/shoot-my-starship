import { createHash } from "node:crypto";
import type { SistemaGenerado } from "@/sim/sistema/generador";

// Tamaño de mundo de referencia para los tests de generador-sistema: el
// mismo 1920x1080 que ya usa el juego (src/juego/constantes.ts), sin
// importarlo -- la rejilla de emplazamiento del generador solo da su
// garantía de "cero solapes por construcción" a partir de un tamaño mínimo
// de mundo, y 1920x1080 es el tamaño real que va a usar el producto.
export const MUNDO_ANCHO = 1920;
export const MUNDO_ALTO = 1080;

// Hash de todo lo que un sistema generado decide: la máscara pintada
// (bit a bit) y los metadatos de planetas/anillos/asteroides. Comparar esto
// entre dos ejecuciones es "misma semilla -> sistema bit-idéntico" (sis-1)
// hecho comprobación exacta en vez de aproximada.
export function hashSistema(sistema: SistemaGenerado): string {
  const hash = createHash("sha256");
  hash.update(Buffer.from(sistema.mascara.datos));
  hash.update(JSON.stringify({ planetas: sistema.planetas, anillos: sistema.anillos, asteroides: sistema.asteroides }));
  return hash.digest("hex");
}
