// Puente React/Phaser con los nombres de quienes juegan (multi-setup-partida):
// mismo patrón singleton pub/sub que integridadStore.ts. Aparte de él porque
// el nombre es un dato de la configuración de la partida, que no cambia, y
// la integridad cambia en cada disparo.
export interface Participante {
  readonly nombre: string;
  readonly esHumano: boolean;
}

export interface EstadoParticipantes {
  // null = partida de siempre (1 humano contra la IA elegida), cuyas
  // etiquetas "Tu nave" / nombre del rival conserva el HUD.
  readonly participantes: readonly Participante[] | null;
  // Nombre de quien ganó; null = empate o partida en curso.
  readonly ganador: string | null;
}

const ESTADO_INICIAL: EstadoParticipantes = { participantes: null, ganador: null };

let estado: EstadoParticipantes = ESTADO_INICIAL;
const escuchas = new Set<() => void>();

function fijar(parcial: Partial<EstadoParticipantes>): void {
  estado = { ...estado, ...parcial };
  for (const escucha of escuchas) escucha();
}

export function obtenerParticipantes(): EstadoParticipantes {
  return estado;
}

export function suscribirParticipantes(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarParticipantes(participantes: readonly Participante[] | null): void {
  fijar({ participantes, ganador: null });
}

export function publicarGanador(nombre: string | null): void {
  fijar({ ganador: nombre });
}

export function reiniciarParticipantes(): void {
  fijar(ESTADO_INICIAL);
}
