import type { EstadoParticipantes } from "@/juego/control/participantesStore";

// Anuncios para lectores de pantalla: puente entre los stores de la partida y
// la región aria-live de AnunciosHUD. Singleton pub/sub, como el resto de
// stores de control. Todo vive en memoria: el historial solo existe para
// __debug.anuncios() y no se persiste ni sale del dispositivo.
export interface Anuncio {
  readonly texto: string;
  readonly enMs: number;
}

export const MAXIMO_ANUNCIOS = 20;

export interface EstadoAnuncios {
  // Último texto; "secuencia" cambia aunque el texto se repita, para que la
  // región pueda vaciarse y rellenarse y el lector lo vuelva a leer.
  readonly texto: string;
  readonly secuencia: number;
}

let estado: EstadoAnuncios = { texto: "", secuencia: 0 };
let historial: Anuncio[] = [];
let ahora: () => number = () => performance.now();
const escuchas = new Set<() => void>();

export function obtenerAnuncio(): EstadoAnuncios {
  return estado;
}

export function suscribirAnuncios(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function obtenerHistorialAnuncios(): readonly Anuncio[] {
  return historial;
}

export function anunciar(texto: string): void {
  if (texto === "") return;
  historial = [...historial, { texto, enMs: Math.round(ahora()) }].slice(-MAXIMO_ANUNCIOS);
  estado = { texto, secuencia: estado.secuencia + 1 };
  for (const escucha of escuchas) escucha();
}

// Cada partida empieza con la región vacía y sin historial.
export function reiniciarAnuncios(): void {
  historial = [];
  estado = { texto: "", secuencia: estado.secuencia + 1 };
  for (const escucha of escuchas) escucha();
}

// Solo para pruebas.
export function inyectarRelojAnuncios(fuente: (() => number) | null): void {
  ahora = fuente ?? (() => performance.now());
}

type DatosTurno = Pick<EstadoParticipantes, "participantes" | "rivalesIA" | "humanos"> & { readonly nombreRival: string };

// «Tu turno» solo cuando hay un único humano y le toca a él: con varios, no
// diría a cuál se habla. Nunca devuelve una cadena vacía, ni con nombres
// vacíos o participantes sin publicar.
export function textoAnuncioTurno(turno: number, { participantes, rivalesIA, humanos, nombreRival }: DatosTurno): string {
  const participante = participantes?.[turno];
  const esHumano = participante ? participante.esHumano : turno === 0;
  if (esHumano && humanos === 1) return "Tu turno";
  const nombre = rivalesIA[turno]?.nombreCorto ?? participante?.nombre ?? (turno === 1 ? nombreRival : "");
  return `Turno de ${nombre.trim() === "" ? `nave ${turno + 1}` : nombre.trim()}`;
}
