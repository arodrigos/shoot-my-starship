import type { MotivoParadaPropulsores } from "@/sim/equipo/propulsores";
import { ANCHO_CASCO } from "@/sim/naves/geometriaCasco";

// Por debajo de esta distancia al origen, la ruta de propulsores no es un
// movimiento: la nave apunta contra la superficie y no llegaría a salir.
export const DISTANCIA_MINIMA_PROPULSORES = 12;

// El casco se dibuja con el morro hacia +x, así que su ancho es lo que mide la
// nave de punta a punta: un vuelo que no lo supera la deja casi donde estaba.
export const LARGO_NAVE_U = ANCHO_CASCO;

export type ClaseVueloPropulsores = "bloqueado" | "corto" | "normal";

// Una sola condición para la escena y los tests: el bloqueo exige chocar contra
// algo (como antes), el aviso de vuelo corto mira solo cuánto se desplaza la
// nave y nunca impide lanzar.
export function clasificarVueloPropulsores(motivo: MotivoParadaPropulsores, desplazamiento: number): ClaseVueloPropulsores {
  if (motivo === "obstaculo" && desplazamiento < DISTANCIA_MINIMA_PROPULSORES) return "bloqueado";
  return desplazamiento <= LARGO_NAVE_U ? "corto" : "normal";
}
