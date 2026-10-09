// cal-1..cal-4: regenera docs/calibracion-economia.md y sale con un código
// distinto de 0 si alguna banda falla. Mismo arnés que medir:armas y medir:ia.
//   npm run calibrar:economia -- [--partidas N] [--maestras a,b,c] [--sin-simulacion]
// En CI corre con pocas partidas (solo comprueba que termina y escribe el
// informe); la validación completa de bandas va con PRUEBA_LARGA=1.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PREMIO_LOTERIA, PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { calcularParametros, evaluarBandas, renderizarInforme, simularPerfiles, type ResultadoSemilla } from "../tests/utils/calibrarEconomia";
import { SEMILLAS_MAESTRAS_MEDICION_IA } from "../tests/utils/medirIA";

function argumento(nombre: string): string | undefined {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice === -1 ? undefined : process.argv[indice + 1];
}

const partidas = Number(argumento("partidas") ?? "10");
const maestras = argumento("maestras")?.split(",").map(Number) ?? SEMILLAS_MAESTRAS_MEDICION_IA;
const simular = !process.argv.includes("--sin-simulacion");
const largo = process.env.PRUEBA_LARGA === "1";
const fallos: string[] = [];

const p = calcularParametros();
if (p.presupuestoBase !== PRESUPUESTO_BASE) fallos.push(`PRESUPUESTO_BASE es ${PRESUPUESTO_BASE} y la medición da ${p.presupuestoBase}`);
if (p.premioLoteria !== PREMIO_LOTERIA) fallos.push(`PREMIO_LOTERIA es ${PREMIO_LOTERIA} y la medición da ${p.premioLoteria}`);

// Una semilla maestra son minutos de CPU: su resultado se guarda en .tmp para
// poder repartir la medición en varias ejecuciones sin repetir lo ya medido.
function medirSemilla(semillaMaestra: number): ResultadoSemilla {
  const cache = join(process.cwd(), ".tmp", `calibracion-${semillaMaestra}-${partidas}.json`);
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8")) as ResultadoSemilla;
  const medido = simularPerfiles(semillaMaestra, partidas);
  mkdirSync(join(process.cwd(), ".tmp"), { recursive: true });
  writeFileSync(cache, JSON.stringify(medido), "utf8");
  return medido;
}

const resultados: readonly ResultadoSemilla[] | null = simular ? maestras.map(medirSemilla) : null;
if (resultados !== null && largo) {
  for (const banda of evaluarBandas(resultados)) if (!banda.cumple) fallos.push(banda.texto);
}

writeFileSync(join(process.cwd(), "docs", "calibracion-economia.md"), renderizarInforme(partidas, resultados), "utf8");
console.log(`docs/calibracion-economia.md regenerado (base ${p.presupuestoBase} cr, M ${p.medianaPrecios} cr${resultados ? `, ${maestras.length} semillas × ${partidas} partidas` : ""}).`);
if (fallos.length > 0) {
  for (const fallo of fallos) console.error(`FALLO: ${fallo}`);
  process.exit(1);
}
