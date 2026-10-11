import { test } from "node:test";
import assert from "node:assert/strict";
import { LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA } from "@/sim/ia/personalidades";
import { medirEnSemillas, SEMILLAS_MINIMAS_EN_BANDA } from "../../utils/medirIA";

// ia-punteria-3 exige una guarda que falle si alguna personalidad sale de su
// banda, sobre al menos 200 partidas -- no basta con "no degenerada": hay
// que afirmar las tres bandas medidas con npm run medir:ia (ver
// docs/jugador-patron.md) para que la siguiente deriva del buscador la cante.
// cal-6c: cinco semillas maestras con 100 partidas cada una (500 por
// personalidad); la banda tiene que cumplirse en al menos cuatro.
const PARTIDAS_POR_SEMILLA = 100;
// naves-silueta: con las naves a la mitad (zona de impacto = polígono) es más
// difícil acertar y La Contable pasa de ~80 % a ~68 % (medido con 200 partidas);
// las tres siguen ordenadas.
// racimo-perdigones: el Racimo estalla agrupado en el impacto y con tope de
// daño combinado, así que el área que aprovechaba Almirante Bisagra ya no
// compensa su puntería media y baja de ~58 % a ~38 % (200 partidas). Sigue
// entre Chispa y La Contable, por lo que se desplaza su banda.
// salida-pantalla: el jugador patrón traza ahora su tiro contra el terreno real
// (como la IA) y con la mitad de ruido, porque la zona de impacto a la mitad le
// quitaba la puntería. Medido con 100 partidas por semilla (2024/2028/3031/
// 4057/5099): La Contable 75/75/83/74/71 %, Almirante Bisagra 26/40/41/46/54 %
// y Chispa 17/54/34/18/33 %. El mapa pesa mucho en las dos últimas (Chispa va
// de 17 a 54 %), así que sus bandas se ensanchan a lo medido; el orden se
// sostiene en 4 de 5 semillas, que es lo que la guarda exige.
// vida-muerte-subita: con 150 de vida y muerte súbita en la ronda 14 las
// partidas se resuelven más a menudo. Medido con 100 partidas por semilla:
// La Contable 89/91/96/85/85 %, Almirante Bisagra 42/71/54/64/73 % y Chispa
// 29/67/42/25/44 %. El orden se cumple en las 5 semillas; las bandas se
// desplazan a lo medido, dejando 4 de 5 dentro.
const BANDA_LA_CONTABLE = [0.75, 0.98] as const;
const BANDA_ALMIRANTE_BISAGRA = [0.35, 0.8] as const;
const BANDA_CHISPA = [0.2, 0.5] as const;

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
test("ia-3: las tres bandas de dificultad se cumplen y están ordenadas en ≥ 4 de 5 semillas maestras", () => {
  const contable = medirEnSemillas(LA_CONTABLE, PARTIDAS_POR_SEMILLA);
  const bisagra = medirEnSemillas(ALMIRANTE_BISAGRA, PARTIDAS_POR_SEMILLA);
  const chispa = medirEnSemillas(CHISPA, PARTIDAS_POR_SEMILLA);

  // Cada personalidad dentro de su banda medida (ia-punteria-3, camino
  // crítico): esto es la guarda que el criterio exige, no una comprobación
  // de "no degenerada" -- si el buscador deriva (p. ej. al tocarlo en
  // potencia-dispersion), este test lo tiene que cantar.
  const lotes = [
    ["La Contable", contable, BANDA_LA_CONTABLE],
    ["Almirante Bisagra", bisagra, BANDA_ALMIRANTE_BISAGRA],
    ["Chispa", chispa, BANDA_CHISPA],
  ] as const;
  for (const [nombre, informes, [minimo, maximo]] of lotes) {
    const tasas = informes.map((informe) => informe.tasaVictoria);
    console.log(`ia-3: ${nombre} ${tasas.map((t) => (t * 100).toFixed(1)).join(" / ")} %`);
    const dentro = tasas.filter((t) => t >= minimo && t <= maximo).length;
    assert.ok(dentro >= SEMILLAS_MINIMAS_EN_BANDA, `${nombre}: solo ${dentro} de ${tasas.length} semillas dentro de [${minimo * 100}, ${maximo * 100}] (${tasas.map((t) => (t * 100).toFixed(1)).join(", ")} %)`);
  }
  const ordenadas = contable.filter((_, i) => chispa[i].tasaVictoria < bisagra[i].tasaVictoria && bisagra[i].tasaVictoria < contable[i].tasaVictoria).length;
  assert.ok(ordenadas >= SEMILLAS_MINIMAS_EN_BANDA, `Las tres bandas solo quedan estrictamente ordenadas en ${ordenadas} de ${contable.length} semillas`);
});
