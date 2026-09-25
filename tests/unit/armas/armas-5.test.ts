import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { analizarNoCopiar, buscarColisiones } from "@/contenido/noCopiar";

const RUTA_NO_COPIAR = path.join(process.cwd(), "no-copiar.md");
const MINIMO_ENTRADAS = 40;

// El banco de frases y los nombres de rival todavía no existen (son de
// humor-sistemico e ia-personalidades, bloques posteriores): este bloque
// solo aporta el catálogo de armas, así que es la única fuente de cadenas
// propias que hay que comprobar por ahora. buscarColisiones es genérico
// sobre CUALQUIER lista de cadenas -- los bloques que añadan banco de
// frases y nombres de rival reutilizan esta misma función, no escriben otra.
function cadenasDelCatalogo(): string[] {
  return CATALOGO_ARMAS.flatMap((arma) => [arma.nombre, arma.descripcion]);
}

test("armas-5: no-copiar.md existe con sus dos secciones y al menos 40 entradas en total", () => {
  const contenido = readFileSync(RUTA_NO_COPIAR, "utf-8");
  const lista = analizarNoCopiar(contenido);

  assert.equal(lista.generoArtilleria.length > 0, true, "falta la sección de género de artillería, o está vacía");
  assert.equal(lista.franquiciasCienciaFiccion.length > 0, true, "falta la sección de franquicias de ciencia ficción, o está vacía");

  const total = lista.generoArtilleria.length + lista.franquiciasCienciaFiccion.length;
  assert.equal(total >= MINIMO_ENTRADAS, true, `no-copiar.md tiene ${total} entradas, se exigen al menos ${MINIMO_ENTRADAS}`);
});

test("armas-5: ninguna cadena del catálogo de armas coincide, normalizada, con una entrada de no-copiar.md", () => {
  const contenido = readFileSync(RUTA_NO_COPIAR, "utf-8");
  const lista = analizarNoCopiar(contenido);
  const colisiones = buscarColisiones(cadenasDelCatalogo(), lista);

  assert.deepEqual(
    colisiones,
    [],
    `hay coincidencias con no-copiar.md: ${colisiones.map((c) => `"${c.cadenaPropia}" ~ "${c.entradaProhibida}"`).join(", ")}`,
  );
});
