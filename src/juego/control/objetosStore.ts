// eventos-objetos (obj-3): puente React/Phaser de los objetos de evento vivos.
// Mismo patrón pub/sub que robotsStore.ts. Los objetos se dibujan en el lienzo,
// pero su leyenda vive también en el HUD para poder leerla a 360 px y
// comprobarla sin depender de píxeles.
export interface ObjetoVisible {
  readonly id: number;
  readonly tipo: "corazon" | "tormenta";
  readonly texto: string;
}

let objetos: readonly ObjetoVisible[] = [];
const escuchas = new Set<() => void>();

export function obtenerObjetos(): readonly ObjetoVisible[] {
  return objetos;
}

export function suscribirObjetos(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarObjetos(nuevos: readonly ObjetoVisible[]): void {
  objetos = nuevos;
  for (const escucha of escuchas) escucha();
}
