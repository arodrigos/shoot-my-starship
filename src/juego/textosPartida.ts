import type { Controlador } from "@/juego/jugadores";

export interface DatosGanador {
  // null = empate.
  readonly ganador: string | null;
  readonly ganadorEsHumano: boolean;
  readonly humanos: number;
}

// Segunda persona solo cuando hay un único humano: con varios, «Has ganado»
// no diría a cuál de ellos se habla.
export function textoGanador({ ganador, ganadorEsHumano, humanos }: DatosGanador): string {
  if (ganador === null) return "Empate";
  if (ganadorEsHumano && humanos === 1) return "¡Has ganado!";
  return `Gana ${ganador}`;
}

export function contarHumanos(controladores: readonly Controlador[]): number {
  return controladores.filter((c) => c.tipo === "humano").length;
}

export function etiquetaMinirobot(nombre: string, esHumano: boolean, humanos: number): string {
  return esHumano && humanos === 1 ? "Tu minirobot" : `Minirobot de ${nombre}`;
}
