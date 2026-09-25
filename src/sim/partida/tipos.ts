import type { EstadoAleatorio } from "@/sim/aleatorio";
import type { Mascara } from "@/sim/terreno/mascara";

// Solo dos naves por ahora (un jugador contra la máquina, ver brief): el
// tipo es literal a propósito para que "turno de nadie" sea irrepresentable
// en vez de un número fuera de rango que hay que validar en tiempo de
// ejecución.
export type IdNave = 0 | 1;

export function naveContraria(id: IdNave): IdNave {
  return id === 0 ? 1 : 0;
}

export interface EstadoNave {
  readonly x: number;
  // 0-100. Nunca negativa (criterio nucleo-5): resolverImpacto la deja
  // siempre en Math.max(0, ...).
  readonly integridad: number;
}

// Parámetros de un mapa concreto (decisión de ambientación de esta
// iteración): gravedad y deriva son multiplicador/aceleración por mapa, no
// constantes cableadas -- lo comprobará armas-7 cuando el catálogo de
// armas exista. ancho/alto viajan aquí, no importados de src/juego, porque
// el núcleo no depende de la cáscara (nucleo-3): es la misma convención que
// ya usa generarMascara, que recibe el tamaño como parámetro.
export interface ParametrosMundo {
  readonly ancho: number;
  readonly alto: number;
  readonly gravedad: number;
  readonly deriva: number;
  readonly etiquetaDeriva: string;
}

export type ResultadoPartida =
  | { readonly tipo: "en-curso" }
  | { readonly tipo: "terminada"; readonly ganador: IdNave };

// Serializable de punta a punta (criterio nucleo-2): nada de funciones, ni
// referencias a objetos de render, ni el generador aleatorio en forma de
// closure -- por eso `aleatorio` es EstadoAleatorio (un número que
// evoluciona) y no un GeneradorAleatorio.
// mascara viaja en el estado (y no se regenera desde la semilla) porque el
// terreno es destructible: tras el primer impacto, la semilla ya no basta
// para reconstruirlo (balistica-armas).
export interface EstadoPartida {
  readonly version: 1;
  readonly mundo: ParametrosMundo;
  readonly mascara: Mascara;
  readonly naves: readonly [EstadoNave, EstadoNave];
  readonly turno: IdNave;
  readonly numeroTurno: number;
  readonly aleatorio: EstadoAleatorio;
  readonly resultado: ResultadoPartida;
}

// El arma es un identificador de texto y nada más: el catálogo declarativo
// (nombre, huella, daño, trayectoria...) es el bloque balistica-armas. Aquí
// solo hace falta que el dato exista y viaje en los eventos, para que ese
// bloque no tenga que tocar la forma de EntradaDeTurno.
export interface EntradaDeTurno {
  readonly arma: string;
  // 0 = horizontal hacia +x, 180 = horizontal hacia -x, 90 = vertical. El
  // rango exacto que expone el control (control-apuntado) es decisión de
  // ese bloque; el núcleo solo integra el ángulo que le llega.
  readonly anguloGrados: number;
  readonly potencia: number;
}

// Dado el estado ANTES de decidir, produce la entrada de este turno y el
// estado que corresponde después de decidir -- que puede diferir del de
// entrada solo en `aleatorio`, si la fuente ha consumido azar (una IA con
// error inyectado, o el generador de pruebas de este bloque). La implementa
// el jugador local, la IA, y --el día que llegue-- un jugador remoto: es la
// pieza que hace posible el multijugador sin tocar el resto del núcleo
// (criterio nucleo-6).
export type FuenteDeTurno = (estado: EstadoPartida) => {
  readonly entrada: EntradaDeTurno;
  readonly estado: EstadoPartida;
};
