// Puente React/Phaser del aviso «no se puede guardar»: mismo patrón pub/sub
// que el resto de stores. Se muestra 4 s y la escena lo pide una sola vez por
// partida (el guardador ya lo garantiza).
export const AVISO_SIN_GUARDADO_MS = 4000;

let visible = false;
let temporizador: ReturnType<typeof setTimeout> | null = null;
const escuchas = new Set<() => void>();

function fijar(valor: boolean): void {
  visible = valor;
  for (const escucha of escuchas) escucha();
}

export function avisoSinGuardadoVisible(): boolean {
  return visible;
}

export function suscribirAvisoSinGuardado(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function mostrarAvisoSinGuardado(): void {
  if (temporizador !== null) clearTimeout(temporizador);
  fijar(true);
  temporizador = setTimeout(() => {
    temporizador = null;
    fijar(false);
  }, AVISO_SIN_GUARDADO_MS);
}

export function reiniciarAvisoSinGuardado(): void {
  if (temporizador !== null) clearTimeout(temporizador);
  temporizador = null;
  fijar(false);
}
