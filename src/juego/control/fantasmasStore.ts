// desplazamiento-tras-impacto (des-3): puente React/Phaser de la marca
// «Estaba aquí». Mismo patrón pub/sub que roceStore.ts. La marca se dibuja en
// el lienzo, pero el aviso textual vive en el HUD para que se lea y se pueda
// comprobar sin depender de píxeles.
export interface FantasmaNave {
  readonly nave: number;
  readonly texto: string;
}

let fantasmas: readonly FantasmaNave[] = [];
const escuchas = new Set<() => void>();

export function obtenerFantasmas(): readonly FantasmaNave[] {
  return fantasmas;
}

export function suscribirFantasmas(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarFantasmas(nuevos: readonly FantasmaNave[]): void {
  fantasmas = nuevos;
  for (const escucha of escuchas) escucha();
}
