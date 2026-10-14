import type { Controlador } from "@/juego/jugadores";
import { NOMBRE_TU_NAVE } from "@/contenido/resumenesPartida";

// Nombre corto de cada rival de IA, el mismo que leen las pestañas de
// vida: el resumen no debe cortarlos con «…» (#229).
export const NOMBRES_CORTOS_RIVAL: Readonly<Record<string, string>> = {
  "la-contable": "La Contable",
  "almirante-bisagra": "Bisagra",
  chispa: "Chispa",
};

// Con un único humano en la partida el texto le habla a él: «Tu nave», «Te
// desplazaron» (#230). Con varios humanos cada uno es un nombre propio.
export function esHumanoLocalUnico(controladores: readonly Controlador[], id: number): boolean {
  return controladores[id]?.tipo === "humano" && controladores.filter((controlador) => controlador.tipo === "humano").length === 1;
}

export function nombreEnResumen(controladores: readonly Controlador[], id: number): string {
  const controlador = controladores[id];
  if (!controlador) return `Nave ${id + 1}`;
  if (esHumanoLocalUnico(controladores, id)) return NOMBRE_TU_NAVE;
  const idPersonalidad = controlador.personalidad?.id;
  return (idPersonalidad !== undefined ? NOMBRES_CORTOS_RIVAL[idPersonalidad] : undefined) ?? controlador.nombre;
}

// Rótulo de la marca «Estaba aquí» (des-3).
export function textoDesplazamiento(nombre: string, esYo: boolean): string {
  return esYo ? "Te desplazaron: estabas aquí." : `Estaba aquí: ${nombre} fue desplazada de este punto.`;
}
