// eventos-universo: puente React/Phaser del pronóstico galáctico y del cartel
// del evento que acaba de ocurrir. Mismo patrón pub/sub que robotsStore.ts.
export interface CartelEvento {
  // Cambia con cada cartel, aunque el texto se repita, para que el HUD
  // reinicie su cuenta de 4 s.
  readonly clave: number;
  readonly titulo: string;
  // A quién afecta: el nombre con el color de su nave, o null para «Todos».
  readonly quien: { readonly nombre: string; readonly color: string } | null;
  readonly texto: string;
}

export type NuevoCartel = Omit<CartelEvento, "clave">;

export interface EstadoUniversoVisible {
  readonly pronostico: string | null;
  // El que se ve ahora: la cabeza de la cola.
  readonly cartel: CartelEvento | null;
  // muerte-subita: el aviso de la ronda previa y el drenaje en curso; vive aquí
  // y no en el pronóstico porque debe verse también sin eventos del universo.
  readonly muerteSubita: string | null;
}

const VACIO: EstadoUniversoVisible = { pronostico: null, cartel: null, muerteSubita: null };

let estado: EstadoUniversoVisible = VACIO;
// Carteles por mostrar, en el orden de los eventos; el primero es el visible.
let cola: readonly CartelEvento[] = [];
let ultimaClave = 0;
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

// Dos eventos en el mismo turno no se pisan: el segundo espera a que el HUD
// retire el primero.
export function publicarCartel(nuevo: NuevoCartel): void {
  ultimaClave += 1;
  cola = [...cola, { ...nuevo, clave: ultimaClave }];
  if (cola.length === 1) emitir({ ...estado, cartel: cola[0] });
}

export function retirarCartel(clave: number): void {
  if (cola[0]?.clave !== clave) return;
  cola = cola.slice(1);
  emitir({ ...estado, cartel: cola[0] ?? null });
}

export function reiniciarUniverso(): void {
  cola = [];
  emitir(VACIO);
}
