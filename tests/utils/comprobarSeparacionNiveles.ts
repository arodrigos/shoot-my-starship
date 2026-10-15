import assert from "node:assert/strict";
import { aplicarNivel, NIVELES_IA, type NivelIA } from "@/sim/ia/nivel";
import type { Personalidad } from "@/sim/ia/tipos";
import { medirEnSemillas } from "./medirIA";

// niv-3: mismas semillas y mismas 100 partidas por semilla que ia-3; el
// estadístico es la media de victorias de las 5 semillas (una sola varía del
// 25 % al 84 % según el mapa). Un fichero de test por personalidad para que el
// runner los reparta entre procesos: cada medida son ~95 s de CPU.
const PARTIDAS_POR_SEMILLA = 100;
export const SEPARACION_MINIMA_PUNTOS = 8;

function media(personalidad: Personalidad, n: NivelIA): number {
  const tasas = medirEnSemillas(aplicarNivel(personalidad, n), PARTIDAS_POR_SEMILLA).map((i) => i.tasaVictoria * 100);
  return tasas.reduce((a, b) => a + b, 0) / tasas.length;
}

export function comprobarSeparacionNiveles(personalidad: Personalidad): void {
  const [facil, normal, dificil] = NIVELES_IA.map((n) => media(personalidad, n)) as [number, number, number];
  console.log(`niv-3: ${personalidad.nombre} fácil ${facil.toFixed(1)} / normal ${normal.toFixed(1)} / difícil ${dificil.toFixed(1)} %`);
  assert.ok(facil + SEPARACION_MINIMA_PUNTOS <= normal, `${personalidad.nombre}: fácil ${facil.toFixed(1)} no queda 8 puntos bajo normal ${normal.toFixed(1)}`);
  assert.ok(normal + SEPARACION_MINIMA_PUNTOS <= dificil, `${personalidad.nombre}: normal ${normal.toFixed(1)} no queda 8 puntos bajo difícil ${dificil.toFixed(1)}`);
}
