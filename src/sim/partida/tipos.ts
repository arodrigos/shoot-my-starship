import type { EstadoAleatorio } from "@/sim/aleatorio";
import type { EstadoRobot } from "@/sim/armas/minirobot";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { Mascara } from "@/sim/terreno/mascara";
import type { EstadoUniverso } from "@/sim/universo/tipos";

// nucleo-n-naves: de 2 a 4 naves (hot-seat de hasta 4 jugadores, ver brief).
// Un entero no negativo, índice dentro de `naves`/`ordenTurno` -- ya no hay
// un literal 0 | 1 que lo acote, así que quien construye un EstadoPartida es
// responsable de que todo IdNave que viaje en él sea un índice válido de
// `naves` (comprobado en los tests de invariantes, no en tiempo de
// ejecución: el núcleo no revalida en cada llamada lo que ya construyó él
// mismo).
export type IdNave = number;

export interface EstadoNave {
  readonly x: number;
  // 0-100. Nunca negativa (criterio nucleo-5): resolverImpacto la deja
  // siempre en Math.max(0, ...).
  readonly integridad: number;
  // Opcional y aditivo (colocacion-naves, nav-1): en el modo de suelo plano
  // de siempre, la altura de una nave se sigue derivando en el momento con
  // alturaSuperficie(mascara, x) y este campo no existe. En el modo de
  // espacio abierto (naves flotando entre planetas) la posición vertical no
  // se puede derivar de ninguna columna del terreno -- no hay "suelo" bajo
  // una nave en vacío -- así que viaja aquí, fija, hasta que algo la mueva
  // explícitamente (un empuje de arma).
  readonly y?: number;
  // escudo-y-propulsores: turnos propios que le quedan al escudo. Ausente (no
  // 0) mientras no lo haya tenido activo, para que las partidas sin escudo
  // serialicen igual que antes. Baja al empezar cada turno del dueño.
  readonly escudoTurnosRestantes?: number;
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
  // pantalla-completa (pan-5): más planetas cuanto más área; ausente = 1.
  readonly factorPlanetas?: number;
}

// ganador nullable (nucleo-n-naves): con más de dos naves, un disparo de
// area puede dejar a la vez sin vida a las dos últimas que quedaban en pie
// -- empate real, no un literal de conveniencia. Con dos naves el camino de
// siempre sigue produciendo ganador salvo que ambas caigan a la vez: entonces
// es empate real también con dos naves (muerte-subita), sin desempate.
export type ResultadoPartida =
  | { readonly tipo: "en-curso" }
  | { readonly tipo: "terminada"; readonly ganador: IdNave | null };

// modos-y-presupuesto: "barra-libre" es el comportamiento de siempre (todas
// las armas disponibles, ningún descuento); "presupuesto" activa el guardián
// de saldo en avanzar(). Tipo literal, no boolean, para que un tercer modo
// futuro no obligue a renombrar un flag.
export type ModoJuego = "barra-libre" | "presupuesto";

// Serializable de punta a punta (criterio nucleo-2): nada de funciones, ni
// referencias a objetos de render, ni el generador aleatorio en forma de
// closure -- por eso `aleatorio` es EstadoAleatorio (un número que
// evoluciona) y no un GeneradorAleatorio.
// mascara viaja en el estado (y no se regenera desde la semilla) porque el
// terreno es destructible: tras el primer impacto, la semilla ya no basta
// para reconstruirlo (balistica-armas).
// `planetas` es opcional a propósito (nucleo-gravedad): ausente, una partida
// se comporta exactamente como antes de este bloque (gravedad uniforme,
// ningún registro que mantener). Presente, avanzar() lo recalcula al cerrar
// cada turno desde la máscara resultante -- nunca dentro del vuelo (grav-4)
// -- y viaja en el propio EstadoPartida para que serializarEstado no
// necesite saber nada especial de él (grav-9): son solo números.
export interface EstadoPartida {
  readonly version: 1;
  readonly mundo: ParametrosMundo;
  readonly mascara: Mascara;
  // nucleo-n-naves: de 2 a 4 naves. Deja de ser una tupla literal porque el
  // tamaño ya no es parte del tipo -- lo comprueban los tests de
  // invariantes (nucleo-n-naves-1), no el compilador.
  readonly naves: readonly EstadoNave[];
  // nucleo-n-naves: el orden de turno es explícito y fijo durante toda la
  // partida (el asiento en que se sentó cada jugador, nunca se reordena) --
  // avanzar() salta las ids eliminadas al calcular el siguiente turno en vez
  // de que cada llamante tenga que saber quién sigue viva.
  readonly ordenTurno: readonly IdNave[];
  readonly turno: IdNave;
  readonly numeroTurno: number;
  readonly aleatorio: EstadoAleatorio;
  readonly resultado: ResultadoPartida;
  readonly planetas?: RegistroPlanetas;
  // modos-y-presupuesto / nucleo-n-naves-3: ausente se comporta exactamente
  // como antes (ninguna partida previa a este bloque declara modo). Pasa de
  // ser el saldo escalar de la nave 0 a un array paralelo a `naves`: la
  // posición `i` es el saldo de `naves[i]`, o undefined si esa nave no
  // participa del presupuesto. economia-rectificada: todos los asientos
  // llevan saldo, también las IAs, y cada arma de pago se cobra al usarla.
  readonly modo?: ModoJuego;
  readonly saldos?: readonly (number | undefined)[];
  // minirobot: robots posados en un planeta que se mueven al empezar el turno
  // de su dueño. Ausente (no vacío) mientras no haya ninguno, para que las
  // partidas sin robots serialicen exactamente igual que antes.
  readonly robots?: readonly EstadoRobot[];
  // eventos-universo: calendario y efectos vivos. Ausente = partida sin eventos
  // (toda la simulación masiva), que serializa exactamente igual que antes.
  readonly universo?: EstadoUniverso;
  // muerte-subita: ronda en curso (1 al empezar). Ausente = partida sin cierre
  // forzoso. `muerteSubita` pasa a true al empezar RONDA_MUERTE_SUBITA y es lo
  // que lee la disponibilidad de eventos curativos.
  readonly ronda?: number;
  readonly muerteSubita?: boolean;
}

// El arma es un identificador de texto y nada más: el catálogo declarativo
// (nombre, huella, daño, trayectoria...) es el bloque balistica-armas. Aquí
// solo hace falta que el dato exista y viaje en los eventos, para que ese
// bloque no tenga que tocar la forma de EntradaDeTurno.
// escudo-y-propulsores: el turno es exactamente una acción. Ausente = disparo,
// que es lo que ya declaraban todas las entradas anteriores a este bloque; con
// 'escudo' o 'propulsores', `arma` lleva el id del equipo y no se busca en el
// catálogo de armas.
export type AccionDeTurno = "disparo" | "escudo" | "propulsores";

export interface EntradaDeTurno {
  readonly accion?: AccionDeTurno;
  readonly arma: string;
  // 0 = horizontal hacia +x, 180 = horizontal hacia -x, 90 = vertical. El
  // rango exacto que expone el control (control-apuntado) es decisión de
  // ese bloque; el núcleo solo integra el ángulo que le llega.
  readonly anguloGrados: number;
  readonly potencia: number;
  // nucleo-n-naves: con dos naves el objetivo era siempre "la otra" --
  // calculada con la función que este bloque retira. Con hasta 4, quien
  // decide el turno (jugador o IA) tiene que decir a quién apunta
  // (nucleo-n-naves-5). Es la intención del turno (broma, realce, proxy de
  // la IA): el daño lo decide el punto de impacto real, contra todas las
  // naves vivas. Tiene que ser una nave viva distinta del tirador:
  // avanzar() lanza si no lo es.
  readonly objetivoId: IdNave;
}

// nucleo-n-naves: ids (en el orden de `ordenTurno`) de las naves con
// integridad > 0. Vive aquí, no en avanzar(), porque fuente.ts (la IA)
// necesita la misma lista para elegir entre varios rivales.
export function idsNavesVivas(estado: EstadoPartida): readonly IdNave[] {
  return estado.ordenTurno.filter((id) => estado.naves[id].integridad > 0);
}

// nucleo-n-naves: la siguiente id en `ordenTurno` tras `desde` que esté
// viva, dando una vuelta completa como máximo -- nunca vuelve a `desde` si
// hay alguna otra nave viva distinta.
export function siguienteTurno(estado: EstadoPartida, desde: IdNave): IdNave {
  const orden = estado.ordenTurno;
  const indiceActual = orden.indexOf(desde);
  for (let paso = 1; paso <= orden.length; paso += 1) {
    const candidato = orden[(indiceActual + paso) % orden.length];
    if (estado.naves[candidato].integridad > 0 || candidato === desde) {
      return candidato;
    }
  }
  return desde;
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
