import type { EstadoAleatorio } from "@/sim/aleatorio";
import type { IdNave } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

export type TipoEvento =
  | "loteria"
  | "vitaminas"
  | "virus"
  | "reparacion"
  | "terremoto"
  | "gravedad-x2"
  | "gravedad-mitad"
  | "viento-solar"
  | "agujero-negro";

// Tipos que dejan un efecto vivo en el estado. Los demás (lotería, reparación,
// terremoto) son instantáneos y no se quedan.
export type TipoEfecto = "vitaminas" | "virus" | "gravedad-x2" | "gravedad-mitad" | "viento-solar" | "agujero-negro";

// El evento ya sorteado: tipo y afectado se fijan al programarlo, no al
// dispararlo, para que el pronóstico que ve el jugador nunca pueda mentir.
export interface EventoProgramado {
  readonly enTurnos: number;
  readonly tipo: TipoEvento;
  readonly afectado: IdNave;
}

export interface EfectoActivo {
  readonly tipo: TipoEfecto;
  // Solo los efectos de nave (vitaminas, virus) lo llevan; los globales afectan al mundo.
  readonly nave?: IdNave;
  readonly turnosRestantes: number;
  // Lo que el viento solar sumó a mundo.deriva, para devolverlo exacto al expirar.
  readonly derivaAnadida?: number;
}

// Estado serializable del universo. Con su propio generador: el azar de los
// eventos no puede mover el de la partida, o activar/desactivar eventos
// cambiaría cada disparo y la previsualización dejaría de coincidir.
export interface EstadoUniverso {
  readonly aleatorio: EstadoAleatorio;
  readonly proximo: EventoProgramado;
  readonly efectos: readonly EfectoActivo[];
  // La reparación necesita saber qué píxeles de planeta existieron.
  readonly mascaraInicial: Mascara;
}

export type FasePartida = "normal" | "muerte-subita";
