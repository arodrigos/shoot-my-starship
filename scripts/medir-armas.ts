// armas-metrica: regenera docs/facilidad-armas.md a partir del mismo harness
// (tests/utils/medirArmas.ts) que comprueba el test de umbral -- un solo
// cálculo de facilidad de acierto, nunca uno para el informe y otro distinto
// para el test que lo vigila.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { medirCatalogo, paresDeDominancia, NUM_ESCENARIOS_METRICA_ARMAS } from "../tests/utils/medirArmas";

const metricas = medirCatalogo();
const dominancia = paresDeDominancia(metricas);

const filas = metricas
  .map(
    (m) =>
      `| ${m.nombre} | ${m.danioMaximo} | ${m.radioEfectoPx} | ${m.tiempoVueloMedioS === null ? "n/a" : m.tiempoVueloMedioS.toFixed(2) + "s"} | ${(m.facilidad * 100).toFixed(1)}% | ${m.coste} |`,
  )
  .join("\n");

const filasDominancia =
  dominancia.length > 0
    ? dominancia.map((p) => `- **${p.dominante}** domina a **${p.dominada}** (igual o más daño, igual o más facilidad, igual o menos coste).`).join("\n")
    : "Ninguna encontrada en esta medición.";

const contenido = `# Facilidad de acierto por arma

Regenerado por \`npm run medir:armas\` (\`armas-metrica\`). No a mano: estos
números salen de \`facilidadDeAcierto\`, que barre toda la rejilla
ángulo x potencia con el resolutor de vuelo real sobre ${NUM_ESCENARIOS_METRICA_ARMAS} escenarios
sembrados (\`tests/utils/medirArmas.ts\`). El mismo cálculo lo vigila
\`tests/unit/armas/armas-metrica.test.ts\`: si este informe cambia, es porque
el test ya lo detectó primero.

La facilidad es la fracción de esas combinaciones que causan daño real sobre
la nave objetivo -- un radio de efecto mayor o una dispersión angular que
sigue impactando suben este número por sí solos, sin ninguna ponderación
aparte que mantener sincronizada con el resolutor.

## Catálogo

| Arma | Daño máx. | Radio de efecto (px) | Tiempo de vuelo medio | Facilidad medida | Coste |
| --- | --- | --- | --- | --- | --- |
${filas}

## Dominancia

Un arma domina a otra cuando iguala o supera su daño y su facilidad con igual
o menor coste -- la combinación que convertiría el reprecio (bloque
\`armas-reprecio-roles\`) en cosmético si no se corrige.

${filasDominancia}
`;

writeFileSync(join(process.cwd(), "docs", "facilidad-armas.md"), contenido, "utf8");
console.log(`docs/facilidad-armas.md regenerado (${metricas.length} armas, ${dominancia.length} par(es) de dominancia).`);
