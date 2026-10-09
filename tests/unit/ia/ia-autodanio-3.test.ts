import { test } from "node:test";
import assert from "node:assert/strict";
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE } from "@/sim/ia/personalidades";
import { medirEnSemillas, SEMILLAS_MINIMAS_EN_BANDA } from "../../utils/medirIA";

// ia-autodanio-3: umbral duro -- al 5% o por debajo, contra el jugador
// patrón, en al menos 200 partidas sembradas (docs/jugador-patron.md detalla
// quién es). Mismo harness que publica npm run medir:ia (medirIA.ts): el
// informe y este test miden exactamente lo mismo, nunca dos implementaciones
// que puedan divergir.
// 60 partidas por semilla maestra (300 por personalidad): el umbral es una tasa
// agregada de disparos y cada semilla tiene cientos de ellos.
const PARTIDAS_POR_SEMILLA = 60;

test("ia-autodanio-3: la tasa de autoimpacto de cada personalidad queda en 5% o por debajo en ≥ 4 de 5 semillas", () => {
  for (const personalidad of [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA]) {
    const informes = medirEnSemillas(personalidad, PARTIDAS_POR_SEMILLA);
    for (const informe of informes) {
      assert.ok(informe.disparos > 0, `${informe.personalidad}: 0 disparos en ${PARTIDAS_POR_SEMILLA} partidas -- el informe no mide nada`);
    }
    const dentro = informes.filter((informe) => (informe.tasaAutoimpacto ?? 0) <= 0.05).length;
    assert.ok(
      dentro >= SEMILLAS_MINIMAS_EN_BANDA,
      `${personalidad.nombre}: solo ${dentro} de ${informes.length} semillas con autoimpacto ≤ 5 % (${informes.map((i) => ((i.tasaAutoimpacto ?? 0) * 100).toFixed(1)).join(", ")} %)`,
    );
  }
});
