import { test } from "node:test";
import assert from "node:assert/strict";
import { LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA } from "@/sim/ia/personalidades";
import { medirPersonalidad, NUM_PARTIDAS_MEDICION_IA, SEMILLA_MAESTRA_MEDICION_IA } from "../../utils/medirIA";

// ia-punteria-3 exige una guarda que falle si alguna personalidad sale de su
// banda, sobre al menos 200 partidas -- no basta con "no degenerada": hay
// que afirmar las tres bandas medidas con npm run medir:ia (ver
// docs/jugador-patron.md) para que la siguiente deriva del buscador la cante.
const PARTIDAS_POR_PERSONALIDAD = NUM_PARTIDAS_MEDICION_IA;
const BANDA_LA_CONTABLE = [0.75, 0.9] as const;
const BANDA_ALMIRANTE_BISAGRA = [0.45, 0.65] as const;
const BANDA_CHISPA = [0.2, 0.4] as const;

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
test("ia-3: las tres bandas de dificultad están dentro de su rango medido y ordenadas", () => {
  const informeContable = medirPersonalidad(LA_CONTABLE, SEMILLA_MAESTRA_MEDICION_IA, PARTIDAS_POR_PERSONALIDAD);
  const informeBisagra = medirPersonalidad(ALMIRANTE_BISAGRA, SEMILLA_MAESTRA_MEDICION_IA, PARTIDAS_POR_PERSONALIDAD);
  const informeChispa = medirPersonalidad(CHISPA, SEMILLA_MAESTRA_MEDICION_IA, PARTIDAS_POR_PERSONALIDAD);
  const pctContable = informeContable.tasaVictoria;
  const pctBisagra = informeBisagra.tasaVictoria;
  const pctChispa = informeChispa.tasaVictoria;

  console.log(
    `ia-3: La Contable ${(pctContable * 100).toFixed(1)}%, Almirante Bisagra ${(pctBisagra * 100).toFixed(1)}%, Chispa ${(pctChispa * 100).toFixed(1)}%`,
  );

  // Cada personalidad dentro de su banda medida (ia-punteria-3, camino
  // crítico): esto es la guarda que el criterio exige, no una comprobación
  // de "no degenerada" -- si el buscador deriva (p. ej. al tocarlo en
  // potencia-dispersion), este test lo tiene que cantar.
  for (const [nombre, pct, [minimo, maximo]] of [
    ["La Contable", pctContable, BANDA_LA_CONTABLE],
    ["Almirante Bisagra", pctBisagra, BANDA_ALMIRANTE_BISAGRA],
    ["Chispa", pctChispa, BANDA_CHISPA],
  ] as const) {
    assert.ok(
      pct >= minimo && pct <= maximo,
      `${nombre} ganó ${(pct * 100).toFixed(1)}%, fuera de su banda [${minimo * 100}, ${maximo * 100}]`,
    );
  }
  assert.ok(
    pctChispa < pctBisagra && pctBisagra < pctContable,
    `Las tres bandas no quedan estrictamente ordenadas: Chispa ${(pctChispa * 100).toFixed(1)}% / Almirante Bisagra ${(pctBisagra * 100).toFixed(1)}% / La Contable ${(pctContable * 100).toFixed(1)}%`,
  );
});
