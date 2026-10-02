// ia-autodanio-3: informe de medir:ia. Juega NUM_PARTIDAS_MEDICION_IA
// partidas sembradas por personalidad contra el jugador patrón
// (docs/jugador-patron.md) y publica tasa de victoria, error medio de
// impacto y tasa de autoimpacto, junto a la cifra de autoimpacto previa al
// bloque para que el cambio sea comparable.
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE } from "@/sim/ia/personalidades";
import { medirPersonalidad, NUM_PARTIDAS_MEDICION_IA, SEMILLA_MAESTRA_MEDICION_IA } from "../tests/utils/medirIA";

// Medida una sola vez contra el commit c63de318d62d15873648bd129af30fe41eb64f1d
// (el padre de #82, justo antes del bloque ia-autodanio), con este mismo
// harness y semilla maestra: congelada aquí en vez de recalculada en cada
// ejecución porque ese commit ya no es el código que corre, solo una
// referencia histórica (docs/jugador-patron.md detalla el cómo).
const AUTOIMPACTO_PREVIO_AL_BLOQUE: Record<string, number> = {
  "La Contable": 0.4347,
  "Almirante Bisagra": 0.1797,
  Chispa: 0.0,
};

const UMBRAL_AUTOIMPACTO = 0.05;

for (const personalidad of [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA]) {
  const informe = medirPersonalidad(personalidad, SEMILLA_MAESTRA_MEDICION_IA, NUM_PARTIDAS_MEDICION_IA);
  const previo = AUTOIMPACTO_PREVIO_AL_BLOQUE[informe.personalidad];
  const marca = (informe.tasaAutoimpacto ?? 0) <= UMBRAL_AUTOIMPACTO ? "OK" : "SUPERA EL UMBRAL";

  console.log(`\n${informe.personalidad} (${informe.partidas} partidas, semilla maestra ${SEMILLA_MAESTRA_MEDICION_IA})`);
  console.log(`  tasa de victoria:        ${(informe.tasaVictoria * 100).toFixed(1)}%`);
  console.log(`  error medio de impacto:  ${informe.errorMedioImpactoPx?.toFixed(1) ?? "n/a"}px`);
  console.log(`  tasa de autoimpacto:     ${((informe.tasaAutoimpacto ?? 0) * 100).toFixed(2)}% [${marca}, umbral ${UMBRAL_AUTOIMPACTO * 100}%]`);
  console.log(`  autoimpacto previo al bloque ia-autodanio: ${((previo ?? 0) * 100).toFixed(2)}%`);
  if (informe.partidasConProblemas > 0) {
    console.log(`  aviso: ${informe.partidasConProblemas} partida(s) con invariante roto (nucleo-5, fuera de alcance de este bloque)`);
  }
}
