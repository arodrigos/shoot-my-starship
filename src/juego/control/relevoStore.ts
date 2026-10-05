// Puente React/Phaser para la pantalla de relevo del hot-seat (relevo-turno):
// mismo patrón singleton pub/sub que resultadoTurnoStore.ts. Aparte de
// EstadoControl porque el relevo no es un ajuste de disparo: es una pausa
// que tapa el juego mientras el dispositivo cambia de manos.
export interface ResumenRelevo {
  readonly tirador: string;
  // null cuando el turno no tuvo arma que nombrar (proyectil perdido).
  readonly arma: string | null;
  readonly danio: number;
  readonly fallo: boolean;
}

export interface EstadoRelevo {
  readonly activo: boolean;
  // A quién le toca; null mientras no hay relevo.
  readonly jugador: string | null;
  readonly resumen: ResumenRelevo | null;
  readonly broma: string | null;
}

const ESTADO_INICIAL: EstadoRelevo = { activo: false, jugador: null, resumen: null, broma: null };

let estado: EstadoRelevo = ESTADO_INICIAL;
let manejadorConfirmar: (() => void) | null = null;
const escuchas = new Set<() => void>();

function fijar(nuevo: EstadoRelevo): void {
  estado = nuevo;
  for (const escucha of escuchas) escucha();
}

export function obtenerRelevo(): EstadoRelevo {
  return estado;
}

export function suscribirRelevo(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarRelevo(jugador: string, resumen: ResumenRelevo | null, broma: string | null): void {
  fijar({ activo: true, jugador, resumen, broma });
}

export function cerrarRelevo(): void {
  if (estado.activo) fijar(ESTADO_INICIAL);
}

// La escena decide qué pasa al confirmar (devolver el turno al jugador);
// el HUD solo notifica el toque, igual que con el disparo.
export function registrarManejadorRelevo(manejador: () => void): () => void {
  manejadorConfirmar = manejador;
  return () => {
    if (manejadorConfirmar === manejador) manejadorConfirmar = null;
  };
}

export function confirmarRelevo(): void {
  if (!estado.activo) return;
  manejadorConfirmar?.();
}

// Singleton de módulo: una partida nueva no debe heredar un relevo abierto.
export function reiniciarRelevo(): void {
  fijar(ESTADO_INICIAL);
}
