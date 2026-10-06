import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { radioEfectoDeArma, type Detonacion } from "@/sim/partida/detonaciones";

// Referencias derivadas del catálogo vigente y no de un número escrito a
// mano: la constante anterior (60) citaba un arma que ya no existe, y la
// escala dejaba de llegar a 1 con el arma más fuerte real.
export const DANIO_REFERENCIA_ESCALA_MAXIMA = Math.max(
  ...CATALOGO_ARMAS.map((arma) => (arma.efecto.tipo === "empuje" ? 0 : arma.efecto.danioMaximo)),
);
export const RADIO_REFERENCIA_ESCALA_MAXIMA = Math.max(...CATALOGO_ARMAS.map((arma) => radioEfectoDeArma(arma)));

export const ESCALA_MINIMA = 0.35;

// Pura y exportada para ejercerla sin un Phaser.Scene: dos daños distintos
// tienen que dar dos escalas distintas, nunca la misma.
export function escalaDeDanio(danio: number): number {
  const fraccion = Math.max(0, Math.min(1, danio / DANIO_REFERENCIA_ESCALA_MAXIMA));
  return ESCALA_MINIMA + fraccion * (1 - ESCALA_MINIMA);
}

// Una detonación que daña a una nave crece sobre la misma sobre el vacío o un
// planeta, y más cuanto más daño: con el Pepinazo el término de radio gana
// siempre a escalaDeDanio, así que sin este factor el daño no se veía nunca.
export const REALCE_MINIMO_SOBRE_NAVE = 1.1;
export const REALCE_EXTRA_POR_DANIO = 0.3;

export function factorRealceNave(danio: number): number {
  if (danio <= 0) return 1;
  const fraccion = Math.min(1, danio / DANIO_REFERENCIA_ESCALA_MAXIMA);
  return REALCE_MINIMO_SOBRE_NAVE + REALCE_EXTRA_POR_DANIO * fraccion;
}

export function escalaPorRadio(radioEfectoU: number): number {
  const fraccion = Math.max(0, Math.min(1, radioEfectoU / RADIO_REFERENCIA_ESCALA_MAXIMA));
  return ESCALA_MINIMA + fraccion * (1 - ESCALA_MINIMA);
}

// Presupuesto global de partículas vivas: lo que cuenta es el aguante del
// móvil, así que depende del ancho CSS del viewport y no del dispositivo.
export const ANCHO_VIEWPORT_MOVIL_CSS = 600;
export const TECHO_PARTICULAS_MOVIL = 120;
export const TECHO_PARTICULAS_ESCRITORIO = 240;

export function techoGlobalDeParticulas(anchoViewportCss: number): number {
  return anchoViewportCss < ANCHO_VIEWPORT_MOVIL_CSS ? TECHO_PARTICULAS_MOVIL : TECHO_PARTICULAS_ESCRITORIO;
}

export const RADIO_MINIMO_DESTELLO_CSS = 8;
export const TRAZO_MINIMO_ONDA_CSS = 2;
export const DURACION_DESTELLO_REDUCIDO_MS = 150;
export const DURACION_ANILLO_REDUCIDO_MS = 400;
// Cuánto vive cada capa de partículas: el presupuesto las cuenta hasta ahí.
export const DURACION_ESCOMBROS_MS = 900;
export const DURACION_HUMO_MS = 1500;

// Cuenta partículas vivas con el reloj que le pasan (el de la escena en
// juego, uno inventado en el test): sin temporizadores reales no hay nada
// que dependa de cuándo corra el navegador (issue #151).
export class PresupuestoParticulas {
  private readonly reservas: { readonly venceEnMs: number; readonly cantidad: number }[] = [];

  constructor(private readonly techo: number) {}

  vivas(ahoraMs: number): number {
    let total = 0;
    for (let i = this.reservas.length - 1; i >= 0; i--) {
      if (this.reservas[i].venceEnMs <= ahoraMs) {
        this.reservas.splice(i, 1);
      } else {
        total += this.reservas[i].cantidad;
      }
    }
    return total;
  }

  // Concede como mucho lo que cabe: reduce, nunca rechaza (el destello y la
  // onda no dependen de este presupuesto).
  reservar(ahoraMs: number, pedidas: number, duracionMs: number): number {
    const concedidas = Math.max(0, Math.min(pedidas, this.techo - this.vivas(ahoraMs)));
    if (concedidas > 0) this.reservas.push({ venceEnMs: ahoraMs + duracionMs, cantidad: concedidas });
    return concedidas;
  }
}

export interface EntradaPlanExplosion {
  readonly detonacion: Detonacion;
  // Cuántos píxeles CSS ocupa una unidad de mundo en este viewport.
  readonly cssPorUnidad: number;
  readonly movimientoReducido: boolean;
  readonly particulasConcedibles: (pedidas: number, duracionMs: number) => number;
  readonly cantidadMaxEscombros: number;
  readonly cantidadMaxHumo: number;
}

export interface PlanExplosion {
  readonly escala: number;
  readonly radioOnda: number;
  readonly radioDestello: number;
  readonly trazoOnda: number;
  readonly duracionDestelloMs: number;
  readonly duracionOndaMs: number;
  readonly escombros: number;
  readonly humo: number;
  // Una detonación que daña a una nave se distingue de una sobre el vacío.
  readonly realce: boolean;
  readonly sacudida: boolean;
}

export function planificarExplosion(entrada: EntradaPlanExplosion): PlanExplosion {
  const { detonacion, cssPorUnidad, movimientoReducido } = entrada;
  const realce = detonacion.sobre === "nave" && detonacion.danioAplicado > 0;
  const escalaBase = Math.max(escalaPorRadio(detonacion.radioEfectoU), escalaDeDanio(detonacion.danioAplicado));
  const escala = realce ? escalaBase * factorRealceNave(detonacion.danioAplicado) : escalaBase;
  const radioMinimoDestello = RADIO_MINIMO_DESTELLO_CSS / cssPorUnidad;
  const trazoOnda = TRAZO_MINIMO_ONDA_CSS / cssPorUnidad;

  if (movimientoReducido) {
    return {
      escala,
      radioOnda: detonacion.radioEfectoU,
      radioDestello: radioMinimoDestello,
      trazoOnda,
      duracionDestelloMs: DURACION_DESTELLO_REDUCIDO_MS,
      duracionOndaMs: DURACION_ANILLO_REDUCIDO_MS,
      escombros: 0,
      humo: 0,
      realce,
      sacudida: false,
    };
  }

  // El realce de nave puede llevar la escala por encima de 1; la cantidad de
  // partículas no, porque su techo en REGISTRO_EFECTOS es duro (pre-1).
  const pedidosEscombros = Math.min(entrada.cantidadMaxEscombros, Math.round(entrada.cantidadMaxEscombros * escala));
  const pedidosHumo = Math.min(entrada.cantidadMaxHumo, Math.round(entrada.cantidadMaxHumo * escala));
  const escombros = entrada.particulasConcedibles(pedidosEscombros, DURACION_ESCOMBROS_MS);
  const humo = entrada.particulasConcedibles(pedidosHumo, DURACION_HUMO_MS);
  return {
    escala,
    radioOnda: detonacion.radioEfectoU,
    radioDestello: Math.max(radioMinimoDestello, 16 + 34 * escala),
    trazoOnda,
    duracionDestelloMs: 150,
    duracionOndaMs: 500,
    escombros,
    humo,
    realce,
    sacudida: true,
  };
}
