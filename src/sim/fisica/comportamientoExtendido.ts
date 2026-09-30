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
}

// vex-3: dos tiradas del MISMO EstadoAleatorio hilvanado del disparo, en
// orden fijo (deriva antes que gravedad) -- nunca Math.random (nucleo-4).
// La magnitud declarada en el catálogo (arma.comportamiento.magnitudPxS2)
// fija la amplitud máxima del zigzag; el signo y la fracción exacta salen
// del PRNG, disfrazados de deriva/gravedad extra de ESE paso -- el mismo
// truco que ya usa la gravedad de N cuerpos para no bifurcar
// integrarPasoProyectil.
export function siguientePerturbacionErratica(estado: EstadoAleatorio, magnitudPxS2: number): PerturbacionErratica {
  const pasoDeriva = siguienteAleatorio(estado);
  const pasoGravedad = siguienteAleatorio(pasoDeriva.estado);
  return {
    derivaPxS2: (pasoDeriva.valor * 2 - 1) * magnitudPxS2,
    gravedadExtra: ((pasoGravedad.valor * 2 - 1) * magnitudPxS2) / GRAVEDAD_REFERENCIA_PX_S2,
    estado: pasoGravedad.estado,
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
