import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { analizarNoCopiar, buscarColisiones } from "@/contenido/noCopiar";

const RUTA_NO_COPIAR = path.join(process.cwd(), "no-copiar.md");
const MINIMO_ENTRADAS = 60;

// armas-nuevas (arm-7): escalón por encima del mínimo de armas-5 (40) que
// fija este bloque -- crece el mismo fichero, no uno paralelo, porque
// buscarColisiones ya es genérico sobre cualquier lista de cadenas propias.
// El generador de sistemas (generador-sistema) no emite ningún nombre propio
// todavía -- los planetas son ids numéricos, sin bautizar -- así que hoy no
// hay nada suyo que cruzar; el día que lo tenga, reutiliza esta misma
// función en vez de escribir un segundo cruce.
function cadenasPropias(): string[] {
  return CATALOGO_ARMAS.flatMap((arma) => [arma.nombre, arma.descripcion]);
}

test("arm-7: no-copiar.md llega a 60 entradas o más", () => {
  const contenido = readFileSync(RUTA_NO_COPIAR, "utf-8");
  const lista = analizarNoCopiar(contenido);
  const total = lista.generoArtilleria.length + lista.franquiciasCienciaFiccion.length;
  assert.equal(total >= MINIMO_ENTRADAS, true, `no-copiar.md tiene ${total} entradas, se exigen al menos ${MINIMO_ENTRADAS}`);
});

test("arm-7: ningún nombre del catálogo de armas (incluidas las nuevas) coincide, normalizado, con no-copiar.md", () => {
  const contenido = readFileSync(RUTA_NO_COPIAR, "utf-8");
  const lista = analizarNoCopiar(contenido);
  const colisiones = buscarColisiones(cadenasPropias(), lista);

  assert.deepEqual(
    colisiones,
    [],
    `hay coincidencias con no-copiar.md: ${colisiones.map((c) => `"${c.cadenaPropia}" ~ "${c.entradaProhibida}"`).join(", ")}`,
  );
});
