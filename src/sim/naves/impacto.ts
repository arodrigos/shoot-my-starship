import type { EstadoProyectil } from "@/sim/fisica/proyectil";
import type { IdNave } from "@/sim/partida/tipos";

// impacto-naves: por primera vez una nave viva es un CUERPO DE COLISIÓN real,
// no un punto de referencia para medir distancia en X. El radio y la gracia
// viven aquí, en datos, porque son los dos números que gobiernan si acertar
// resulta satisfactorio o imposible (ver descripción del bloque en el diseño).
export const RADIO_CASCO_NAVE_PX = 22;
// Gracia del casco propio: el proyectil recién salido del cañón ignora el
// casco de quien dispara hasta haber estado, al menos una vez, más allá de
// RADIO_CASCO_NAVE_PX + esta holgura -- sin gracia, todo disparo detona en la
// cara del tirador; sin la reopacificación posterior, el autoimpacto por
// curva de gravedad (el chiste característico del género) sería imposible.
export const GRACIA_CASCO_PROPIO_PX = 6;

export interface NavePosicion {
  readonly id: IdNave;
  readonly x: number;
  readonly y: number;
}

export interface ImpactoNave {
  readonly nave: IdNave;
  readonly x: number;
  readonly y: number;
}

// Intersección segmento-círculo en forma cerrada: dado el segmento que va del
// paso anterior al paso actual de integración y el casco circular de una
// nave, devuelve el primer punto de corte (el más cercano al paso anterior),
// o null si el segmento no corta el círculo. Comprobar el SEGMENTO -- no solo
// el punto final de cada paso -- es lo único que evita que un proyectil que
// avanza más rápido que el diámetro del casco lo atraviese sin tocarlo
// (imp-2, "túnel a alta velocidad").
export function interseccionSegmentoCirculo(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  r: number,
): { readonly x: number; readonly y: number } | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;

  const a = dx * dx + dy * dy;
  if (a === 0) {
    return fx * fx + fy * fy <= r * r ? { x: x0, y: y0 } : null;
  }

  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const discriminante = b * b - 4 * a * c;
  if (discriminante < 0) {
    return null;
  }

  const raiz = Math.sqrt(discriminante);
  const t1 = (-b - raiz) / (2 * a);
  const t2 = (-b + raiz) / (2 * a);
  // El primer cruce en orden de avance p0 -> p1, dentro del propio paso.
  const t = t1 >= 0 && t1 <= 1 ? t1 : t2 >= 0 && t2 <= 1 ? t2 : null;
  if (t === null) {
    return null;
  }
  return { x: x0 + t * dx, y: y0 + t * dy };
}

export interface RastreadorImpactoNaves {
  // Se llama tras cada paso de integración, con el punto anterior y el
  // nuevo: el segmento que forman es lo que se comprueba contra el casco de
  // cada nave viva, nunca solo `actual`.
  comprobarPaso(anterior: EstadoProyectil, actual: EstadoProyectil): ImpactoNave | null;
}

// Un rastreador nuevo por disparo (estado propio: la gracia del casco
// propio solo se cierra una vez, y solo para ESTE vuelo). `naves` debe traer
// ya filtradas las naves vivas -- una nave con integridad <= 0 no es un
// cuerpo de colisión (imp-1: "nave viva colisionable").
export function crearRastreadorImpactoNaves(naves: readonly NavePosicion[], propiaId: IdNave): RastreadorImpactoNaves {
  let graciaCascoPropioActiva = true;
  const propia = naves.find((nave) => nave.id === propiaId) ?? null;

  return {
    comprobarPaso(anterior, actual) {
      for (const nave of naves) {
        if (nave.id === propiaId && graciaCascoPropioActiva) {
          continue;
        }
        const punto = interseccionSegmentoCirculo(anterior.x, anterior.y, actual.x, actual.y, nave.x, nave.y, RADIO_CASCO_NAVE_PX);
        if (punto) {
          return { nave: nave.id, x: punto.x, y: punto.y };
        }
      }

      if (graciaCascoPropioActiva && propia) {
        const distancia = Math.hypot(actual.x - propia.x, actual.y - propia.y);
        if (distancia > RADIO_CASCO_NAVE_PX + GRACIA_CASCO_PROPIO_PX) {
          graciaCascoPropioActiva = false;
        }
      }

      return null;
    },
  };
}
