import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { GRAVEDAD_REFERENCIA_PX_S2 } from "@/sim/fisica/proyectil";
import { PASO_FIJO_MS } from "@/sim/tiempo";
import type { ComportamientoDeVuelo } from "@/sim/armas/tipos";

// vuelo-extensible (vex-2): cimiento de mosca, granada de espoleta y mina
// adherente -- funciones puras, sin Phaser ni terreno, para que el
// resolutor del núcleo y el animador del cliente consuman EXACTAMENTE esta
// definición en vez de que cada uno reconstruya su propia perturbación, su
// propio temporizador o su propia condición de adherencia por separado.

export interface PerturbacionErratica {
  readonly derivaPxS2: number;
  readonly gravedadExtra: number;
  readonly estado: EstadoAleatorio;
  // mos-2 (fix, iteración 21): velocidad lateral "de mosca" hilvanada entre
  // pasos -- la memoria real de la restitución (ver comentario de
  // DECAIMIENTO_VELOCIDAD_ERRATICA más abajo). El llamante la devuelve tal
  // cual en la siguiente llamada; no se deriva del EstadoAleatorio.
  readonly velocidadLateralXPxS: number;
  readonly velocidadLateralYPxS: number;
}

// vex-3: dos tiradas del MISMO EstadoAleatorio hilvanado del disparo, en
// orden fijo (deriva antes que gravedad) -- nunca azar sin hilvanar (nucleo-4).
// La magnitud declarada en el catálogo (arma.comportamiento.magnitudPxS2)
// fija la amplitud máxima del zigzag; el signo y la fracción exacta salen
// del PRNG, disfrazados de deriva/gravedad extra de ESE paso -- el mismo
// truco que ya usa la gravedad de N cuerpos para no bifurcar
// integrarPasoProyectil.
// arma-mosca (mos-3): único punto que decide "¿este comportamiento necesita
// insumo de perturbación?" -- el cliente (AnimadorProyectil vía Partida.ts)
// consulta esto en vez de ramificar sobre `comportamiento.tipo === "erratico"`
// por su cuenta (comprobar-vuelo-unica-definicion.mjs lo exige: cualquier
// rama sobre un tipo de vuelo-extensible tiene que pasar por el núcleo).
export function insumoPerturbacionErratica(
  comportamiento: ComportamientoDeVuelo,
  aleatorio: EstadoAleatorio,
): { readonly magnitudPxS2: number; readonly aleatorio: EstadoAleatorio } | undefined {
  return comportamiento.tipo === "erratico" ? { magnitudPxS2: comportamiento.magnitudPxS2, aleatorio } : undefined;
}

// mos-2 (fix, iteración 21): la versión original dibujaba dos valores
// independientes por paso y los trataba como ACELERACIÓN lateral --
// integrada dos veces (aceleración -> velocidad -> posición), eso es un
// paseo aleatorio de segundo orden que se ALEJA de la trayectoria de
// referencia en vez de revolotear a su alrededor (hallazgo del Gatekeeper,
// con medición sobre el lote de 200 semillas de mos-2.test.ts: media de
// 1.91 cruces/vuelo, muy por debajo del "al menos 3" del criterio).
//
// La corrección hilvana una velocidad lateral propia (un Ornstein-Uhlenbeck
// discreto) en vez de dos aceleraciones sueltas: cada paso, la velocidad
// anterior se encoge por DECAIMIENTO_VELOCIDAD_ERRATICA (negativo y cercano
// a -1, para que tienda a invertir el signo de un paso a otro, como el
// aleteo real de una mosca) y se le suma ruido nuevo del PRNG. La
// aceleración que se le pide a integrarPasoProyectil es justo la que hace
// falta para que la velocidad del proyectil telescope hasta esa nueva
// velocidad objetivo -- una sola integración neta sobre la velocidad, nunca
// dos sobre la aceleración, así que la posición ya no explota con el tiempo
// de vuelo. GANANCIA_RUIDO_ERRATICA solo reescala la amplitud resultante, no
// el patrón de cruces (comprobado a mano sobre el mismo lote de 200
// semillas, con magnitudPxS2 de 90 a 1600, igual que ya documentaba el test
// para la fórmula anterior).
const DECAIMIENTO_VELOCIDAD_ERRATICA = -0.95;
const GANANCIA_RUIDO_ERRATICA = 4;
const PASO_FIJO_S = PASO_FIJO_MS / 1000;

export function siguientePerturbacionErratica(
  estado: EstadoAleatorio,
  magnitudPxS2: number,
  velocidadLateralXPxS = 0,
  velocidadLateralYPxS = 0,
): PerturbacionErratica {
  const pasoDeriva = siguienteAleatorio(estado);
  const pasoGravedad = siguienteAleatorio(pasoDeriva.estado);
  const ruidoX = (pasoDeriva.valor * 2 - 1) * magnitudPxS2 * GANANCIA_RUIDO_ERRATICA;
  const ruidoY = (pasoGravedad.valor * 2 - 1) * magnitudPxS2 * GANANCIA_RUIDO_ERRATICA;
  const nuevaVelocidadX = velocidadLateralXPxS * DECAIMIENTO_VELOCIDAD_ERRATICA + ruidoX;
  const nuevaVelocidadY = velocidadLateralYPxS * DECAIMIENTO_VELOCIDAD_ERRATICA + ruidoY;
  return {
    derivaPxS2: (nuevaVelocidadX - velocidadLateralXPxS) / PASO_FIJO_S,
    gravedadExtra: (nuevaVelocidadY - velocidadLateralYPxS) / PASO_FIJO_S / GRAVEDAD_REFERENCIA_PX_S2,
    estado: pasoGravedad.estado,
    velocidadLateralXPxS: nuevaVelocidadX,
    velocidadLateralYPxS: nuevaVelocidadY,
  };
}

// vex-1/vex-4: convierte la duración declarada en el catálogo (segundos) al
// PASO DE SIMULACIÓN fijo que de verdad cuenta la mecha -- nunca tiempo
// real, para que el mismo disparo produzca la misma detonación sea cual sea
// el reparto de fotogramas del cliente que reproduce la animación
// (nucleo-1).
export function pasosDeMecha(segundosHastaDetonar: number): number {
  return Math.round((segundosHastaDetonar * 1000) / PASO_FIJO_MS);
}

// vex-2: la condición de adherencia -- función pura sobre datos del
// catálogo, para que ningún llamante (núcleo o cliente) tenga que comparar
// el id del arma para saber si un impacto se queda pegado en vez de
// detonar al contacto.
export function esComportamientoAdherente(comportamiento: ComportamientoDeVuelo): boolean {
  return comportamiento.tipo === "adherente-con-mecha";
}
