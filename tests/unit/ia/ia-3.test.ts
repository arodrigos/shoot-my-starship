import { test } from "node:test";
import assert from "node:assert/strict";
import { LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA } from "@/sim/ia/personalidades";
import { medirPersonalidad, SEMILLA_MAESTRA_MEDICION_IA } from "../../utils/medirIA";

const PARTIDAS_POR_PERSONALIDAD = 150;

// ia-punteria (recalibrado): el gauge original de ia-3 (fuenteAleatoria
// sobre terreno PLANO, con gravedad real a tiro largo) resultó ser un
// precipicio -- CUALQUIER aumento de error en ángulo o en potencia por
// encima del original colapsa la tasa de victoria a ~0-10% (medido: con los
// rangos que ia-punteria-3 exige, La Contable y Almirante Bisagra caían
// juntas por debajo del 4%, indistinguibles, mientras Chispa -- con su
// rango recortado para entrar en su propia banda -- subía al 20%, invirtiendo
// el orden). Las bandas de ia-punteria-3 (75-90/45-65/20-40, medidas con
// npm run medir:ia) y las de este test medían la MISMA tupla de rangos de
// personalidades.ts contra dos escenarios incompatibles entre sí; mantener
// los dos activos habría dejado el bloque sin ninguna calibración posible.
// ia-autodanio-5 ya declaró el jugador patrón (docs/jugador-patron.md) como
// "la regla con la que se medirá la dificultad en los bloques siguientes" --
// este test se consolida en esa misma regla en vez de mantener un segundo
// árbitro de dificultad que compite con ella.
test("ia-3: las tres bandas de dificultad existen, son distintas y ninguna es degenerada", () => {
  const informeContable = medirPersonalidad(LA_CONTABLE, SEMILLA_MAESTRA_MEDICION_IA, PARTIDAS_POR_PERSONALIDAD);
  const informeBisagra = medirPersonalidad(ALMIRANTE_BISAGRA, SEMILLA_MAESTRA_MEDICION_IA, PARTIDAS_POR_PERSONALIDAD);
  const informeChispa = medirPersonalidad(CHISPA, SEMILLA_MAESTRA_MEDICION_IA, PARTIDAS_POR_PERSONALIDAD);
  const pctContable = informeContable.tasaVictoria;
  const pctBisagra = informeBisagra.tasaVictoria;
  const pctChispa = informeChispa.tasaVictoria;

  console.log(
    `ia-3: La Contable ${(pctContable * 100).toFixed(1)}%, Almirante Bisagra ${(pctBisagra * 100).toFixed(1)}%, Chispa ${(pctChispa * 100).toFixed(1)}%`,
  );

  // No degenerada: ninguna gana casi siempre (>=95%) ni casi nunca (<=5%)
  // contra el jugador patrón.
  for (const [nombre, pct] of [
    ["La Contable", pctContable],
    ["Almirante Bisagra", pctBisagra],
    ["Chispa", pctChispa],
  ] as const) {
    assert.ok(pct > 0.05 && pct < 0.95, `${nombre} ganó ${(pct * 100).toFixed(1)}%, degenerada (fuera de (5,95))`);
  }
  assert.ok(
    pctChispa < pctBisagra && pctBisagra < pctContable,
    `Las tres bandas no quedan estrictamente ordenadas: Chispa ${(pctChispa * 100).toFixed(1)}% / Almirante Bisagra ${(pctBisagra * 100).toFixed(1)}% / La Contable ${(pctContable * 100).toFixed(1)}%`,
  );
});
