import type { TipoEventoHumor } from "@/sim/partida/eventos";

// Puente React/Phaser para el banner de reacción (humor-1, humor-2): el
// mismo patrón singleton pub/sub que src/juego/control/store.ts. `clave` es
// un contador que cambia en cada publicación, incluso si el texto coincide
// con el anterior -- así el HUD reinicia su temporizador de autodesaparición
// aunque dos eventos consecutivos del mismo tipo elijan la misma frase.
export interface EstadoReaccion {
  readonly texto: string | null;
  readonly tipoEvento: TipoEventoHumor | null;
  readonly clave: number;
}

let estado: EstadoReaccion = { texto: null, tipoEvento: null, clave: 0 };
const escuchas = new Set<() => void>();

function fijar(parcial: Partial<EstadoReaccion>): void {
  estado = { ...estado, ...parcial };
  for (const escucha of escuchas) escucha();
}

export function obtenerReaccion(): EstadoReaccion {
  return estado;
}

export function suscribirReaccion(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarReaccion(texto: string, tipoEvento: TipoEventoHumor): void {
  fijar({ texto, tipoEvento, clave: estado.clave + 1 });
}

export function limpiarReaccion(): void {
  fijar({ texto: null, tipoEvento: null });
}

// humor-6: mismo patrón que registrarManejadorDisparo/solicitarDisparo en
// store.ts -- el botón de repetición vive en React (ReaccionHUD) pero quien
// sabe cómo reproducir el vuelo exacto es la escena de Phaser.
type ManejadorRepeticion = () => void;
let manejadorRepeticion: ManejadorRepeticion | null = null;

export function registrarManejadorRepeticion(manejador: ManejadorRepeticion): () => void {
  manejadorRepeticion = manejador;
  return () => {
    if (manejadorRepeticion === manejador) manejadorRepeticion = null;
  };
}

export function solicitarRepeticion(): void {
  manejadorRepeticion?.();
}
