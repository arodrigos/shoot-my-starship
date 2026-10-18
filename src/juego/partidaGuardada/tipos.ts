import type { JugadorConfig, MemoriaIA } from "@/juego/jugadores";
import type { EstadisticasPartida } from "@/sim/partida/parteDeGuerra";
import type { EstadoPartida, ModoJuego } from "@/sim/partida/tipos";

export const VERSION_ESQUEMA = 1;
// Tope de la cadena guardada (pgn-2/pgn-5): localStorage suele dar ~5 M de
// caracteres por origen y la partida comparte cuota con el resto de claves.
export const MAX_CARACTERES_INSTANTANEA = 1_000_000;

export type SegundosRelojGuardado = 30 | 45 | 60;

// Lo que hace falta para volver a montar la partida tal cual estaba. La
// semilla del sistema o el id del mapa dicen de dónde salió el mundo, pero el
// mundo en sí viaja en `estado` (el terreno es destructible).
export interface ConfigGuardada {
  readonly jugadores: readonly JugadorConfig[];
  readonly modo: ModoJuego;
  readonly todosVemosTodo: boolean;
  readonly semillaSistema: number | null;
  readonly mapaId: string | null;
  readonly relojTurnoS: SegundosRelojGuardado | null;
  // Partida de siempre (atajo ?mapa= o un humano sin nombre): sin `jugadores`
  // explícitos en la escena, para que al reanudar conserve sus etiquetas.
  readonly clasica?: true;
}

// Estado de la cáscara que el núcleo no conoce: lo que una IA recuerda de sus
// disparos (una entrada por asiento, null en los humanos) y el parte de guerra.
export interface CascaraGuardada {
  readonly memoriasIA: readonly (MemoriaIA | null)[];
  readonly estadisticas: EstadisticasPartida;
  // El parte de guerra se lleva por asiento; `estadisticas` conserva la del
  // primero para lo ya guardado sin este campo. Ausente en instantáneas viejas.
  readonly estadisticasPorNave?: readonly EstadisticasPartida[];
}

// Los datos de una partida en memoria, sin codificar: es la entrada de
// crearInstantanea y lo que devuelve una lectura válida.
export interface DatosPartida {
  readonly estado: EstadoPartida;
  readonly config: ConfigGuardada;
  readonly cascara: CascaraGuardada;
}

export type MotivoDescarte =
  | "json"
  | "tamano"
  | "version"
  | "mascara"
  | "naves"
  | "turno"
  | "arma"
  | "nombre"
  | "terminada"
  | "datos"
  | "version-incompatible";

export type ResultadoLectura =
  | { readonly tipo: "valida"; readonly datos: DatosPartida; readonly deOtraVersion: boolean; readonly guardadaEn: number; readonly rotulo: Rotulo }
  | { readonly tipo: "descartada"; readonly motivo: MotivoDescarte };

// Lo que enseña la portada sin tener que decodificar la máscara.
export interface Rotulo {
  readonly ronda: number;
  readonly nombres: readonly string[];
}
