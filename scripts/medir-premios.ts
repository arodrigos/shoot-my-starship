// pre-3: `npm run medir:premios [-- --partidas N --desde SEMILLA]`. Una partida de 4 IAs
// tarda minutos en el simulador real: 200 son horas de CPU, así que la medida
// completa se reparte con --desde. Imprime en cuántas
// partidas de 4 IAs sale cada premio y sale con código 1 si algún premio de
// mérito queda fuera de [3 %, 80 %]. La consolación no cuenta: existe para
// salir cuando nada más sale.
import { BANCO_MERITO } from "@/juego/premios/premios";
import { medirPremios } from "../tests/utils/medirPremios";

const MINIMO = 0.03;
const MAXIMO = 0.8;
const indice = process.argv.indexOf("--partidas");
const partidas = indice === -1 ? 200 : Number(process.argv[indice + 1]);

const desde = process.argv.indexOf("--desde");
const informe = medirPremios(partidas, desde === -1 ? 1 : Number(process.argv[desde + 1]));
let fuera = 0;
console.log(`\nPremios por asiento (${informe.partidas} partidas de 4 IAs; la tabla cuenta partidas en las que sale)`);
for (const [id, frecuencia] of informe.frecuencias) {
  const esMerito = BANCO_MERITO.some((d) => d.id === id);
  const ok = !esMerito || (frecuencia >= MINIMO && frecuencia <= MAXIMO);
  if (!ok) fuera += 1;
  console.log(`  ${id.padEnd(14)} ${(frecuencia * 100).toFixed(1).padStart(5)} %  ${esMerito ? (ok ? "OK" : "FUERA DE [3 %, 80 %]") : "consolación"}`);
}
process.exit(fuera === 0 ? 0 : 1);
