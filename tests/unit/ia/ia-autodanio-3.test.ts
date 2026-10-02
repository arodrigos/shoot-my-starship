import { test } from "node:test";
import assert from "node:assert/strict";
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE } from "@/sim/ia/personalidades";
import { medirPersonalidad, NUM_PARTIDAS_MEDICION_IA, SEMILLA_MAESTRA_MEDICION_IA } from "../../utils/medirIA";

// ia-autodanio-3: umbral duro -- al 5% o por debajo, contra el jugador
// patrón, en al menos 200 partidas sembradas (docs/jugador-patron.md detalla
// quién es). Mismo harness que publica npm run medir:ia (medirIA.ts): el
// informe y este test miden exactamente lo mismo, nunca dos implementaciones
// que puedan divergir.
test("ia-autodanio-3: la tasa de autoimpacto de cada personalidad queda en 5% o por debajo", () => {
  for (const personalidad of [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA]) {
    const informe = medirPersonalidad(personalidad, SEMILLA_MAESTRA_MEDICION_IA, NUM_PARTIDAS_MEDICION_IA);
    assert.ok(
      informe.disparos > 0,
      `${informe.personalidad}: 0 disparos en ${NUM_PARTIDAS_MEDICION_IA} partidas -- el informe no mide nada`,
    );
    assert.ok(
      (informe.tasaAutoimpacto ?? 0) <= 0.05,
      `${informe.personalidad}: tasa de autoimpacto ${((informe.tasaAutoimpacto ?? 0) * 100).toFixed(2)}% supera el 5%`,
    );
  }
});
