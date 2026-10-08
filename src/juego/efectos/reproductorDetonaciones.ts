import type { Detonacion } from "@/sim/partida/detonaciones";
import type { DatosExplosionPorCapas } from "@/juego/efectos/ExplosionPorCapas";

// Lo único que el reproductor necesita de ExplosionPorCapas: así el property
// test de mrb-2 lo ejercita con un espía, sin Phaser.
export interface FuenteExplosiones {
  reproducir(detonacion: Detonacion, cssPorUnidad: number, movimientoReducido: boolean): DatosExplosionPorCapas;
}

// mrb-2: una explosión por detonación, en el orden en que las declara el
// núcleo y sea cual sea su origen (vuelo, submunición, Minirobot, objeto o
// evento). La escena no filtra por arma: lo que no se reproduce aquí es una
// detonación invisible, justo el fallo que pidió corregir Adrián con el robot.
// La marca 'explosion' se pide una sola vez tras lanzarlas todas, para que el
// medidor de frames mida el coste del lote entero.
export function reproducirDetonaciones(
  detonaciones: readonly Detonacion[],
  fuente: FuenteExplosiones,
  cssPorUnidad: number,
  movimientoReducido: boolean,
  marcar: (nombre: "explosion") => void,
): DatosExplosionPorCapas[] {
  const lanzadas = detonaciones.map((detonacion) => fuente.reproducir(detonacion, cssPorUnidad, movimientoReducido));
  if (lanzadas.length > 0) marcar("explosion");
  return lanzadas;
}
