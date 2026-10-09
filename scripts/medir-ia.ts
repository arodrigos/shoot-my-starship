// ia-autodanio-3: informe de medir:ia. Juega NUM_PARTIDAS_MEDICION_IA
// partidas sembradas por personalidad contra el jugador patrón
// (docs/jugador-patron.md) y publica tasa de victoria, error medio de
// impacto y tasa de autoimpacto, junto a la cifra de autoimpacto previa al
// bloque para que el cambio sea comparable.
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE } from "@/sim/ia/personalidades";
import { medirCompraIA } from "../tests/utils/medirCompraIA";
import { medirTerminacion } from "../tests/utils/medirTerminacion";
import { medirPersonalidad, NUM_PARTIDAS_MEDICION_IA, SEMILLAS_MAESTRAS_MEDICION_IA } from "../tests/utils/medirIA";

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

// eco-4: `--modo presupuesto --naves 4 --semillas N` mide cuánto de lo que la IA
// dispara es de pago cuando su saldo le llega para el arma de ataque más barata.
function argumento(nombre: string): string | undefined {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice === -1 ? undefined : process.argv[indice + 1];
}

const UMBRAL_PAGO_PCT = 70;

if (argumento("modo") === "presupuesto") {
  if ((argumento("naves") ?? "4") !== "4") throw new Error("medir:ia --modo presupuesto solo mide partidas de 4 naves");
  const semillas = Number(argumento("semillas") ?? "20");
  const informe = medirCompraIA(semillas);
  const marca = informe.porcentajeDePago >= UMBRAL_PAGO_PCT ? "OK" : "POR DEBAJO DEL UMBRAL";
  console.log(`\nCompra de la IA en modo presupuesto (4 naves, ${semillas} semillas, tres perfiles juntos)`);
  console.log(`  turnos con saldo para el arma de pago más barata: ${informe.turnosConSaldo}`);
  console.log(`  disparos de pago en esos turnos:                  ${informe.turnosDePago} (${informe.porcentajeDePago.toFixed(1)}%) [${marca}, umbral ${UMBRAL_PAGO_PCT}%]`);
  process.exit(informe.porcentajeDePago >= UMBRAL_PAGO_PCT ? 0 : 1);
}

// ms-1: `--naves N --semillas S [--modo-juego presupuesto]` mide que todas las
// partidas solo de IAs terminen dentro de la cota de la muerte súbita.
if (argumento("naves") !== undefined && argumento("modo") === undefined) {
  const naves = Number(argumento("naves"));
  const semillas = Number(argumento("semillas") ?? "10");
  const modoJuego = argumento("modo-juego") === "presupuesto" ? "presupuesto" : "barra-libre";
  const informe = medirTerminacion(naves, semillas, modoJuego);
  const dentroDeCota = informe.terminadas === informe.partidas && informe.turnoMaximo <= informe.cotaTurnos;
  console.log(`\nCierre de partida (${naves} IAs, ${semillas} semillas, ${modoJuego})`);
  console.log(`  terminadas: ${informe.terminadas}/${informe.partidas} (${((100 * informe.terminadas) / informe.partidas).toFixed(0)}%), empates: ${informe.empates}`);
  console.log(`  turno medio ${informe.turnoMedio.toFixed(1)}, turno máximo ${informe.turnoMaximo} [${dentroDeCota ? "OK" : "FUERA DE COTA"}, cota ${informe.cotaTurnos}]`);
  process.exit(dentroDeCota ? 0 : 1);
}

for (const semillaMaestra of SEMILLAS_MAESTRAS_MEDICION_IA) for (const personalidad of [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA]) {
  const informe = medirPersonalidad(personalidad, semillaMaestra, NUM_PARTIDAS_MEDICION_IA);
  const previo = AUTOIMPACTO_PREVIO_AL_BLOQUE[informe.personalidad];
  const marca = (informe.tasaAutoimpacto ?? 0) <= UMBRAL_AUTOIMPACTO ? "OK" : "SUPERA EL UMBRAL";

  console.log(`\n${informe.personalidad} (${informe.partidas} partidas, semilla maestra ${semillaMaestra})`);
  console.log(`  tasa de victoria:        ${(informe.tasaVictoria * 100).toFixed(1)}%`);
  console.log(`  error medio de impacto:  ${informe.errorMedioImpactoPx?.toFixed(1) ?? "n/a"}px`);
  console.log(`  tasa de autoimpacto:     ${((informe.tasaAutoimpacto ?? 0) * 100).toFixed(2)}% [${marca}, umbral ${UMBRAL_AUTOIMPACTO * 100}%]`);
  console.log(`  autoimpacto previo al bloque ia-autodanio: ${((previo ?? 0) * 100).toFixed(2)}%`);
  if (informe.partidasConProblemas > 0) {
    console.log(`  aviso: ${informe.partidasConProblemas} partida(s) con invariante roto (nucleo-5, fuera de alcance de este bloque)`);
  }
}
