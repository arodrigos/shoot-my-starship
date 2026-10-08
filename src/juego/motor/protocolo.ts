// Protocolo entre el hilo principal y el trabajador de simulación. Solo datos
// planos (structuredClone): sin clases, funciones ni referencias compartidas.
// Lo que en el núcleo es una función (rastreador de impactos, descartar,
// fuente de turno) se reconstruye DENTRO del trabajador a partir del estado.
import type { Mascara } from "@/sim/terreno/mascara";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { EstadoAleatorio } from "@/sim/aleatorio";
import type { BandaPrevisualizacion } from "@/sim/armas/previsualizacion";
import type { avanzar } from "@/sim/partida/avanzar";
import type { EntradaDeTurno, EstadoPartida, IdNave } from "@/sim/partida/tipos";
import type { Personalidad } from "@/sim/ia/tipos";
import type { UltimoIntentoIA } from "@/sim/ia/decidir";

interface Cabecera {
  readonly idPeticion: number;
  readonly idPartida: number;
}

export interface PeticionPrevisualizar extends Cabecera {
  readonly tipo: "previsualizar";
  readonly mascara: Mascara;
  readonly gravedad: number;
  readonly deriva: number;
  readonly ancho: number;
  readonly alto: number;
  readonly planetas?: RegistroPlanetas;
  // Naves vivas con casco rastreable (modo espacial); ausente en terreno llano.
  readonly navesVivas?: readonly { readonly id: IdNave; readonly x: number; readonly y: number }[];
  readonly tirador: IdNave;
  readonly origenX: number;
  readonly origenY: number;
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly armaId: string;
  readonly aleatorio: EstadoAleatorio;
}

export interface PeticionResolverDisparo extends Cabecera {
  readonly tipo: "resolverDisparo";
  readonly estado: EstadoPartida;
  readonly entrada: EntradaDeTurno;
}

export interface PeticionDecidirIA extends Cabecera {
  readonly tipo: "decidirIA";
  readonly estado: EstadoPartida;
  readonly personalidad: Personalidad;
  readonly ultimoIntento: UltimoIntentoIA | null;
  readonly usosPorArma: Readonly<Record<string, number>>;
  readonly danioRecibidoDesdeSuTurno: boolean;
}

export type Peticion = PeticionPrevisualizar | PeticionResolverDisparo | PeticionDecidirIA;
export type TipoPeticion = Peticion["tipo"];

export interface ResultadoPrevisualizar {
  readonly banda: BandaPrevisualizacion;
  // Coste del cálculo medido dentro del trabajador: es lo que se compara con
  // el presupuesto de la mira (superaPresupuestoComputo).
  readonly duracionMs: number;
}

export interface ResultadoDecidirIA {
  readonly entrada: EntradaDeTurno;
  readonly estado: EstadoPartida;
}

export type ResultadoResolver = ReturnType<typeof avanzar>;

export type Respuesta =
  | (Cabecera & { readonly tipo: "previsualizar"; readonly resultado: ResultadoPrevisualizar })
  | (Cabecera & { readonly tipo: "resolverDisparo"; readonly resultado: ResultadoResolver })
  | (Cabecera & { readonly tipo: "decidirIA"; readonly resultado: ResultadoDecidirIA })
  | (Cabecera & { readonly tipo: "error"; readonly mensaje: string });

export const TIEMPO_LIMITE_PETICION_MS = 10_000;

const TIPOS: readonly string[] = ["previsualizar", "resolverDisparo", "decidirIA"];

// El trabajador es del mismo origen, pero un mensaje mal formado no debe
// colgar la partida esperando: se rechaza por su discriminante.
export function esPeticion(valor: unknown): valor is Peticion {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<string, unknown>;
  return typeof v.tipo === "string" && TIPOS.includes(v.tipo) && typeof v.idPeticion === "number" && typeof v.idPartida === "number";
}
