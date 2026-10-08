import type { EstadoProyectil } from "@/sim/fisica/proyectil";
import type { IdNave } from "@/sim/partida/tipos";
import { distanciaACasco, poligonoDeNave, primerCorteSegmentoPoligono, type NavePosicion } from "@/sim/naves/contacto";

export type { NavePosicion } from "@/sim/naves/contacto";

// Una nave viva es un CUERPO DE COLISIÓN con la forma exacta de su silueta
// dibujada (naves-silueta): el paso del proyectil se cruza contra los lados del
// polígono. La gracia del casco propio vive aquí, en datos.
//
// Gracia del casco propio: el proyectil recién salido del cañón ignora el
// casco de quien dispara hasta haber salido entero de su silueta dibujada y
// estar a esta holgura de ella. Sin gracia, todo disparo detona en la cara del
// tirador; sin la reapertura posterior, el autoimpacto por curva de gravedad
// (el chiste característico del género) sería imposible.
export const GRACIA_CASCO_PROPIO_PX = 6;

export interface ImpactoNave {
  readonly nave: IdNave;
  readonly x: number;
  readonly y: number;
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
        const punto = primerCorteSegmentoPoligono(
          anterior.x - nave.x,
          anterior.y - nave.y,
          actual.x - nave.x,
          actual.y - nave.y,
          poligonoDeNave(nave),
        );
        if (punto) {
          return { nave: nave.id, x: punto.x + nave.x, y: punto.y + nave.y };
        }
      }

      if (graciaCascoPropioActiva && propia) {
        if (distanciaACasco(actual.x, actual.y, propia) >= GRACIA_CASCO_PROPIO_PX) {
          graciaCascoPropioActiva = false;
        }
      }

      return null;
    },
  };
}
