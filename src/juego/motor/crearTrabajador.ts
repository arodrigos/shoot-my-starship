import type { TrabajadorLike } from "@/juego/motor/clienteSim";

// Aparte de clienteSim.ts porque `new URL(..., import.meta.url)` solo lo
// entiende el empaquetador: los tests de Node importan el cliente sin él.
export function crearTrabajadorSim(): (() => TrabajadorLike) | null {
  if (typeof Worker === "undefined") return null;
  return () => new Worker(new URL("./trabajadorSim.worker.ts", import.meta.url), { type: "module" }) as unknown as TrabajadorLike;
}
