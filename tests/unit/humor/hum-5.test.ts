import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as frecuenciaBromas from "@/contenido/frecuenciaBromas";
import {
  FRECUENCIA_BROMAS_POR_DEFECTO,
  debeMostrarBromaDeDisparo,
} from "@/contenido/frecuenciaBromas";

test("hum-5: frecuencia 'normal' muestra la broma de disparo en todos los turnos", () => {
  for (let turno = 1; turno <= 12; turno++) {
    assert.equal(debeMostrarBromaDeDisparo("normal", turno), true, `turno ${turno}`);
  }
});

test("hum-5: frecuencia 'sobria' muestra la broma de disparo exactamente uno de cada tres turnos", () => {
  const resultado = Array.from({ length: 9 }, (_, i) => debeMostrarBromaDeDisparo("sobria", i + 1));
  assert.deepEqual(resultado, [false, false, true, false, false, true, false, false, true]);
});

test("hum-5: el valor por defecto es 'normal'", () => {
  assert.equal(FRECUENCIA_BROMAS_POR_DEFECTO, "normal");
});

// hum-5 exige que frecuenciaBromas viva en un único sitio: si otro fichero
// de src/ declarara su propia constante o su propio literal "sobria"/1-en-3
// fuera de frecuenciaBromas.ts, habría dos sitios decidiendo lo mismo y
// podrían divergir sin que ningún test lo note.
function listarFicherosTs(dir: string): string[] {
  const ficheros: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      ficheros.push(...listarFicherosTs(ruta));
    } else if (entrada.name.endsWith(".ts") || entrada.name.endsWith(".tsx")) {
      ficheros.push(ruta);
    }
  }
  return ficheros;
}

test("hum-5: ningún otro fichero de src/ declara su propia lógica de frecuencia de bromas", () => {
  const raizSrc = path.join(process.cwd(), "src");
  const ficheros = listarFicherosTs(raizSrc).filter(
    (ruta) => !ruta.endsWith(path.join("contenido", "frecuenciaBromas.ts")),
  );
  for (const ruta of ficheros) {
    const contenido = readFileSync(ruta, "utf-8");
    assert.equal(
      /FrecuenciaBromas\s*=\s*["'`]/.test(contenido),
      false,
      `${ruta}: declara su propio tipo/literal de FrecuenciaBromas fuera de frecuenciaBromas.ts`,
    );
  }
});

test("hum-5: la broma de impacto no depende de la frecuencia (no existe ningún debeMostrarBromaDeImpacto)", () => {
  assert.equal(
    "debeMostrarBromaDeImpacto" in frecuenciaBromas,
    false,
    "la broma de impacto siempre se muestra; no debe tener su propia función de guardia",
  );
});
