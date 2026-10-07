// eventos-universo: puente React/Phaser del pronóstico galáctico y del cartel
// del evento que acaba de ocurrir. Mismo patrón pub/sub que robotsStore.ts.
export interface CartelEvento {
  // Cambia con cada evento, aunque el texto se repita, para que el HUD
  // reinicie su cuenta de 2,5 s.
  readonly clave: number;
  readonly texto: string;
}

export interface EstadoUniversoVisible {
  readonly pronostico: string | null;
  readonly cartel: CartelEvento | null;
  // muerte-subita: el aviso de la ronda previa y el drenaje en curso; vive aquí
  // y no en el pronóstico porque debe verse también sin eventos del universo.
  readonly muerteSubita: string | null;
}

let estado: EstadoUniversoVisible = { pronostico: null, cartel: null, muerteSubita: null };
const escuchas = new Set<() => void>();

export function obtenerUniverso(): EstadoUniversoVisible {
  return estado;
}

export function suscribirUniverso(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

function emitir(nuevo: EstadoUniversoVisible): void {
  estado = nuevo;
  for (const escucha of escuchas) escucha();
}

export function publicarPronostico(pronostico: string | null): void {
  if (pronostico === estado.pronostico) return;
  emitir({ ...estado, pronostico });
}

export function publicarMuerteSubita(texto: string | null): void {
  if (texto === estado.muerteSubita) return;
  emitir({ ...estado, muerteSubita: texto });
}

export function publicarCartel(texto: string): void {
  emitir({ ...estado, cartel: { clave: (estado.cartel?.clave ?? 0) + 1, texto } });
}

export function reiniciarUniverso(): void {
  emitir({ pronostico: null, cartel: null, muerteSubita: null });
}
