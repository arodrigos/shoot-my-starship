// cal-1..cal-4: regenera docs/calibracion-economia.md y sale con un código
// distinto de 0 si alguna banda falla. Mismo arnés que medir:armas y medir:ia.
//   npm run calibrar:economia -- [--semillas N] [--sin-simulacion]
// En CI corre con pocas semillas (solo comprueba que termina y escribe el
// informe); la validación completa de bandas va con PRUEBA_LARGA=1.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ARRASTRE_MAXIMO, PREMIO_LOTERIA, PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { calcularParametros, renderizarInforme, simularPerfiles, type ResultadoPerfil } from "../tests/utils/calibrarEconomia";

function argumento(nombre: string): string | undefined {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice === -1 ? undefined : process.argv[indice + 1];
}

const semillas = Number(argumento("semillas") ?? "10");
const simular = !process.argv.includes("--sin-simulacion");
const largo = process.env.PRUEBA_LARGA === "1";
const fallos: string[] = [];

const p = calcularParametros();
if (p.presupuestoBase !== PRESUPUESTO_BASE) fallos.push(`PRESUPUESTO_BASE es ${PRESUPUESTO_BASE} y la medición da ${p.presupuestoBase}`);
if (p.arrastreMaximo !== ARRASTRE_MAXIMO) fallos.push(`ARRASTRE_MAXIMO es ${ARRASTRE_MAXIMO} y la medición da ${p.arrastreMaximo}`);
if (p.premioLoteria !== PREMIO_LOTERIA) fallos.push(`PREMIO_LOTERIA es ${PREMIO_LOTERIA} y la medición da ${p.premioLoteria}`);

const resultados: readonly ResultadoPerfil[] | null = simular ? simularPerfiles(semillas) : null;
if (resultados !== null && largo) {
  for (const r of resultados) {
    const conGanador = r.partidas - r.empates;
    const tasa = conGanador === 0 ? 0 : r.victorias / conGanador;
    if (tasa < 0.2 || tasa > 0.5) fallos.push(`${r.perfil}: gana el ${(100 * tasa).toFixed(0)} % de las partidas con ganador, fuera de [20, 50]`);
    if (r.perfil === "agresivo" && r.llegaronAlOctavo > 0 && r.sinSaldoEnOctavo / r.llegaronAlOctavo < 0.8) fallos.push("agresivo: con saldo para la más barata en su 8.º turno en más del 20 % de las partidas");
    if (r.perfil === "ahorrador" && r.llegaronARonda10 > 0 && r.pagoEnRonda10 / r.llegaronARonda10 < 0.7) fallos.push("ahorrador: paga en la ronda 10 en menos del 70 % de las partidas que llegan");
  }
}

writeFileSync(join(process.cwd(), "docs", "calibracion-economia.md"), renderizarInforme(semillas, resultados), "utf8");
console.log(`docs/calibracion-economia.md regenerado (base ${p.presupuestoBase} cr, M ${p.medianaPrecios} cr${resultados ? `, ${semillas} semillas` : ""}).`);
if (fallos.length > 0) {
  for (const fallo of fallos) console.error(`FALLO: ${fallo}`);
  process.exit(1);
}
