// gravedad-calibracion-3: informe de medir:fisica. Dispara con pepinazo-cortesia
// sobre una rejilla de ángulo x potencia en NUM_PARTIDAS_MEDICION_FISICA
// sistemas sembrados (el mismo oráculo de colocación que usa el juego real)
// y publica la tasa de proyectiles perdidos (captura orbital que agota el
// presupuesto de pasos) y el máximo de pasos consumidos por un vuelo.
import { medirFisica, NUM_PARTIDAS_MEDICION_FISICA } from "../tests/utils/medirFisica";
import { PRESUPUESTO_VUELO_MULTIPOZO_PASOS } from "@/sim/fisica/vuelo";

const UMBRAL_PERDIDOS = 0.08;

const informe = medirFisica();
const marca = informe.tasaPerdidos <= UMBRAL_PERDIDOS ? "OK" : "SUPERA EL UMBRAL";

console.log(`\nmedir:fisica (${NUM_PARTIDAS_MEDICION_FISICA} partidas sembradas, ${informe.disparos} disparos)`);
console.log(`  tasa de perdidos:      ${(informe.tasaPerdidos * 100).toFixed(2)}% [${marca}, umbral ${UMBRAL_PERDIDOS * 100}%]`);
console.log(`  max pasos consumidos:  ${informe.maxPasosVuelo} (presupuesto ${PRESUPUESTO_VUELO_MULTIPOZO_PASOS})`);
