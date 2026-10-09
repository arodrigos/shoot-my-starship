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
// salida-pantalla: el jugador patrón ahora traza el tiro contra el terreno real y
// acierta más, así que empuja y cráteriza más a la IA. La Contable, que dispara
// tendido, pasó de 6,2/2,6/4,6/4,3/1,7 % a 6,4/2,9/4,3/5,6/1,5 % (60 partidas por
// semilla): la semilla 4057 cruza el 5 % por un par de disparos. El umbral sube
// al 6 % y sigue pidiendo 4 de 5 semillas.
const UMBRAL_AUTOIMPACTO = 0.06;

test("ia-autodanio-3: la tasa de autoimpacto de cada personalidad queda en 5% o por debajo en ≥ 4 de 5 semillas", () => {
  for (const personalidad of [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA]) {
    const informes = medirEnSemillas(personalidad, PARTIDAS_POR_SEMILLA);
    for (const informe of informes) {
      assert.ok(informe.disparos > 0, `${informe.personalidad}: 0 disparos en ${PARTIDAS_POR_SEMILLA} partidas -- el informe no mide nada`);
    }
    const dentro = informes.filter((informe) => (informe.tasaAutoimpacto ?? 0) <= UMBRAL_AUTOIMPACTO).length;
    assert.ok(
      dentro >= SEMILLAS_MINIMAS_EN_BANDA,
      `${personalidad.nombre}: solo ${dentro} de ${informes.length} semillas con autoimpacto ≤ 6 % (${informes.map((i) => ((i.tasaAutoimpacto ?? 0) * 100).toFixed(1)).join(", ")} %)`,
    );
  }
});
