import type { Personalidad } from "@/sim/ia/tipos";
import type { IdNave } from "@/sim/partida/tipos";
import type { UltimoIntentoIA } from "@/sim/ia/decidir";

export const MAX_NOMBRE_JUGADOR = 16;
export const MIN_NAVES = 2;
export const MAX_NAVES = 4;

// Quién ocupa cada asiento al empezar la partida. Los humanos van siempre
// primero y las IA después: así la nave 0 sigue siendo la de un humano, que
// es lo que dan por hecho el atajo ?mapa= y los e2e de 1 jugador contra IA.
export interface JugadorConfig {
  readonly nombre: string;
  readonly tipo: "humano" | "ia";
  // Solo para tipo "ia".
  readonly personalidadId?: string;
}

// Lo que la escena sabe de cada asiento una vez resuelto: la personalidad ya
// no es un id suelto sino el objeto que consume crearFuenteIA.
export interface Controlador {
  readonly tipo: "humano" | "ia";
  readonly nombre: string;
  readonly personalidad: Personalidad | null;
}

// Contadores por nave de IA que antes eran campos sueltos de la escena (ver
// Partida.ts): cada IA aprende solo de sus propios disparos.
export interface MemoriaIA {
  ultimoIntento: UltimoIntentoIA | null;
  usosPorArma: Record<string, number>;
  fallosConsecutivos: number;
  turnosSeguidosSinDanio: number;
  turnosSeguidosDanioInsuficiente: number;
}

export function memoriaIAInicial(): MemoriaIA {
  return {
    ultimoIntento: null,
    usosPorArma: {},
    fallosConsecutivos: 0,
    turnosSeguidosSinDanio: 0,
    turnosSeguidosDanioInsuficiente: 0,
  };
}

// El nombre es el único texto libre que entra el usuario y acaba en el HUD,
// en el anuncio de ganador y en localStorage. Se acota por puntos de código
// (no por unidades UTF-16, que partirían un emoji por la mitad) y se le
// quitan los caracteres de control; el escapado de HTML no es cosa de esta
// función: React pinta todo como texto y nada inyecta HTML en bruto.
export function sanearNombre(texto: string, respaldo: string): string {
  const limpio = texto.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const acotado = Array.from(limpio).slice(0, MAX_NOMBRE_JUGADOR).join("").trim();
  return acotado.length > 0 ? acotado : respaldo;
}

export function nombreDeNave(controladores: readonly Controlador[], id: IdNave): string {
  return controladores[id]?.nombre ?? `Nave ${id + 1}`;
}
