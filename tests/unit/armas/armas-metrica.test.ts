import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CATALOGO_ARMAS, buscarArma } from "@/sim/armas/catalogo";
import { ESCENARIOS_METRICA_ARMAS, facilidadDeAcierto, medirCatalogo, NUM_ESCENARIOS_METRICA_ARMAS, paresDeDominancia } from "../../utils/medirArmas";

// Barrer la rejilla completa (225 combinaciones) x 16 armas x 20 escenarios es
// costoso (es justo lo que mide el criterio). medirCatalogo() ya calcula la
// misma facilidadDeAcierto por arma puertas adentro (medirArma reutiliza
// candidatosDelEscenario) -- se llama una sola vez y se comparte entre los
// tests de este fichero en vez de recalcular el catálogo entero por test.
const metricasCatalogo = medirCatalogo();

// armas-metrica-1: determinista, valor entre 0 y 1, sobre al menos 20
// escenarios sembrados, calculado con el resolver real (facilidadDeAcierto
// reutiliza barridoRejilla, el mismo oráculo que ya usa la IA en vivo -- ver
// el comentario de tests/utils/medirArmas.ts).
test("armas-metrica-1: ESCENARIOS_METRICA_ARMAS tiene al menos 20 escenarios sembrados", () => {
  assert.ok(
    ESCENARIOS_METRICA_ARMAS.length >= 20,
    `se esperaban al menos 20 escenarios, hay ${ESCENARIOS_METRICA_ARMAS.length}`,
  );
  assert.equal(ESCENARIOS_METRICA_ARMAS.length, NUM_ESCENARIOS_METRICA_ARMAS);
});

test("armas-metrica-1: facilidadDeAcierto es determinista -- la misma entrada da el mismo valor en dos ejecuciones", () => {
  const arma = buscarArma("pepinazo-cortesia");
  const primera = facilidadDeAcierto(arma);
  const segunda = facilidadDeAcierto(arma);
  assert.equal(primera, segunda);
});

test("armas-metrica-1: facilidadDeAcierto cae entre 0 y 1 para todo el catálogo", () => {
  assert.equal(metricasCatalogo.length, CATALOGO_ARMAS.length);
  for (const metrica of metricasCatalogo) {
    assert.ok(metrica.facilidad >= 0 && metrica.facilidad <= 1, `${metrica.id}: facilidad ${metrica.facilidad} fuera de [0, 1]`);
  }
});

// armas-metrica-2: HUECO documentado (ver revision_previa del entregable).
// Medido sobre el catálogo actual y los 20 escenarios multipozo, el recorrido
// real de facilidadDeAcierto es de solo ~0.067 (todas las armas caen en la
// banda [0, 0.1)) -- muy por debajo del 0.4 que pide el criterio. No es un
// fallo del cálculo: un barrido ciego de la rejilla completa (225 combinaciones
// ángulo x potencia) sobre un objetivo puntual acierta poco por diseño, que es
// justo por lo que busquedaMultipozo.ts necesita una fase de refinamiento
// encima de la misma rejilla (ver ia-multipozo). Ampliar esta métrica para que
// discrimine de verdad (p.ej. tolerancia angular continua en vez de conteo de
// rejilla, o varias distancias de referencia) es trabajo pendiente, no
// cubierto por este bloque -- camino_critico de armas-metrica-2 es false.
test("armas-metrica-2 (hueco documentado): la métrica actual no discrimina lo suficiente sobre el catálogo", () => {
  const facilidades = metricasCatalogo.map((m) => m.facilidad);
  const recorrido = Math.max(...facilidades) - Math.min(...facilidades);
  console.log(`armas-metrica-2: recorrido medido = ${recorrido.toFixed(3)} (umbral del criterio: 0.4, NO alcanzado -- ver hueco documentado)`);
  // Se deja constancia del valor real sin fingir que cumple el umbral: la
  // única aserción es que el cálculo en sí produce una medida real, no NaN
  // ni una lista vacía -- el umbral de discriminación queda como hueco.
  assert.ok(Number.isFinite(recorrido));
});

// armas-metrica-3: el informe (docs/facilidad-armas.md, generado por
// `npm run medir:armas`) incluye las 16 armas, las cinco columnas y una
// sección de dominancia con los pares encontrados -- comprobado contra el
// fichero ya regenerado y comprometido en este mismo bloque, no recalculado
// aquí (el cálculo es el mismo de medirCatalogo/paresDeDominancia, ya
// cubierto por los tests de arriba y de abajo).
test("armas-metrica-3: docs/facilidad-armas.md incluye las 16 armas, las cinco columnas y la sección de dominancia", () => {
  const informe = readFileSync(join(process.cwd(), "docs", "facilidad-armas.md"), "utf8");
  for (const arma of CATALOGO_ARMAS) {
    assert.ok(informe.includes(arma.nombre), `falta ${arma.nombre} en el informe`);
  }
  for (const columna of ["Daño máx.", "Radio de efecto", "Tiempo de vuelo medio", "Facilidad medida", "Coste"]) {
    assert.ok(informe.includes(columna), `falta la columna "${columna}" en el informe`);
  }
  assert.ok(informe.includes("## Dominancia"));
  assert.ok(informe.includes("domina a"), "el informe no señala ningún par de dominancia");
});

test("armas-metrica-3: paresDeDominancia encuentra al menos el caso de pepinazo-cortesia", () => {
  const pares = paresDeDominancia(metricasCatalogo);
  assert.ok(pares.length > 0, "no se encontró ningún par de dominancia");
  assert.ok(
    pares.some((p) => p.dominante === "pepinazo-cortesia" || p.dominada === "pepinazo-cortesia"),
    "pepinazo-cortesia debería aparecer en al menos un par de dominancia",
  );
});

// armas-metrica-4: el arnés (tests/utils/medirArmas.ts, scripts/medir-armas.ts)
// no es alcanzable desde src/juego ni desde la aplicación Next.js -- en vez de
// confiar solo en la colocación de ficheros (como medirIA.ts), se comprueba
// mecánicamente que ningún fichero fuente de src/juego o src/app importa el
// arnés, igual que las comprobaciones de frontera de scripts/comprobar-*.mjs.
function todosLosFicheros(directorio: string): string[] {
  const resultados: string[] = [];
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      resultados.push(...todosLosFicheros(ruta));
    } else if (ruta.endsWith(".ts") || ruta.endsWith(".tsx")) {
      resultados.push(ruta);
    }
  }
  return resultados;
}

test("armas-metrica-4: ni src/juego ni src/app importan el arnés de medición de armas", () => {
  const prohibido = /medirArmas|scripts\/medir-armas/;
  for (const directorio of ["src/juego", "src/app"]) {
    for (const fichero of todosLosFicheros(join(process.cwd(), directorio))) {
      const contenido = readFileSync(fichero, "utf8");
      assert.ok(!prohibido.test(contenido), `${fichero} no debería importar el arnés de medición de armas`);
    }
  }
});
