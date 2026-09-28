import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { analizarNoCopiar, buscarColisiones } from "@/contenido/noCopiar";
import { todasLasFrasesDeBromas } from "@/contenido/bancoBromas";

const RUTA_NO_COPIAR = path.join(process.cwd(), "no-copiar.md");

// Mismo patrón que humor-8/arm-7 (armas-5): un único punto de comparación
// normalizado entre el material propio y no-copiar.md, aplicado ahora a las
// frases de humor-por-turno.
test("hum-7: ninguna frase del banco de bromas (disparo ni impacto) coincide, normalizada, con no-copiar.md", () => {
  const contenido = readFileSync(RUTA_NO_COPIAR, "utf-8");
  const lista = analizarNoCopiar(contenido);
  const colisiones = buscarColisiones(todasLasFrasesDeBromas(), lista);

  assert.deepEqual(
    colisiones,
    [],
    `hay coincidencias con no-copiar.md: ${colisiones.map((c) => `"${c.cadenaPropia}" ~ "${c.entradaProhibida}"`).join(", ")}`,
  );
});
