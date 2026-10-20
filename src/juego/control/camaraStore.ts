// Puente React/Phaser de la cámara (camara-gestos): si «Ver todo» se muestra y
// si falta la ayuda del gesto. Singleton pub/sub como relevoStore.ts. El gesto
// vive en la escena; aquí solo está lo que el DOM necesita saber.
export interface EstadoCamaraHud {
  readonly manual: boolean;
  readonly ayudaVisible: boolean;
}

const ESTADO_INICIAL: EstadoCamaraHud = { manual: false, ayudaVisible: true };

let estado: EstadoCamaraHud = ESTADO_INICIAL;
let manejadorVerTodo: (() => void) | null = null;
const escuchas = new Set<() => void>();

function fijar(nuevo: EstadoCamaraHud): void {
  if (nuevo.manual === estado.manual && nuevo.ayudaVisible === estado.ayudaVisible) return;
  estado = nuevo;
  for (const escucha of escuchas) escucha();
}

export function obtenerCamaraHud(): EstadoCamaraHud {
  return estado;
}

export function suscribirCamaraHud(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarCamaraManual(manual: boolean): void {
  fijar({ ...estado, manual });
}

// La ayuda sale una vez por partida: se rearma al montar la escena.
export function reiniciarCamaraHud(): void {
  fijar(ESTADO_INICIAL);
}

export function cerrarAyudaCamara(): void {
  fijar({ ...estado, ayudaVisible: false });
}

export function registrarManejadorVerTodo(manejador: () => void): () => void {
  manejadorVerTodo = manejador;
  return () => {
    if (manejadorVerTodo === manejador) manejadorVerTodo = null;
  };
}

export function pedirVerTodo(): void {
  manejadorVerTodo?.();
}
