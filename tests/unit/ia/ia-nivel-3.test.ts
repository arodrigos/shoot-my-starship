import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarNivel, NIVELES_IA, type NivelIA } from "@/sim/ia/nivel";
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE } from "@/sim/ia/personalidades";
import { medirEnSemillas } from "../../utils/medirIA";

// niv-3: los niveles se notan. Mismas semillas y mismas 100 partidas por
// semilla que ia-3; el estadístico es la media de victorias de las 5 semillas
// (una sola semilla varía del 25 % al 84 % según el mapa) y entre niveles
// consecutivos tiene que haber al menos 8 puntos. Determinista por semilla.
const PARTIDAS_POR_SEMILLA = 100;
const SEPARACION_MINIMA_PUNTOS = 8;

function media(personalidad: typeof LA_CONTABLE, n: NivelIA): number {
  const tasas = medirEnSemillas(aplicarNivel(personalidad, n), PARTIDAS_POR_SEMILLA).map((i) => i.tasaVictoria * 100);
  return tasas.reduce((a, b) => a + b, 0) / tasas.length;
}

test("niv-3: para cada personalidad, fácil < normal < difícil con ≥ 8 puntos entre niveles", () => {
  for (const personalidad of [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA]) {
    const [facil, normal, dificil] = NIVELES_IA.map((n) => media(personalidad, n)) as [number, number, number];
    console.log(`niv-3: ${personalidad.nombre} fácil ${facil.toFixed(1)} / normal ${normal.toFixed(1)} / difícil ${dificil.toFixed(1)} %`);
    assert.ok(facil + SEPARACION_MINIMA_PUNTOS <= normal, `${personalidad.nombre}: fácil ${facil.toFixed(1)} no queda 8 puntos bajo normal ${normal.toFixed(1)}`);
    assert.ok(normal + SEPARACION_MINIMA_PUNTOS <= dificil, `${personalidad.nombre}: normal ${normal.toFixed(1)} no queda 8 puntos bajo difícil ${dificil.toFixed(1)}`);
  }
});
