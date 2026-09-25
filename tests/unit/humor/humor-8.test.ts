import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { analizarNoCopiar, buscarColisiones } from "@/contenido/noCopiar";
import { BANCO_REACCIONES, combinacionesDelBanco, frasesPara } from "@/contenido/bancoReacciones";
import { generarParteDeGuerra, type EstadisticasPartida } from "@/sim/partida/parteDeGuerra";

const RUTA_NO_COPIAR = path.join(process.cwd(), "no-copiar.md");

// Las cuatro medallas posibles, una por rama de generarParteDeGuerra: el
// texto varía con las cifras, pero el nombre de la medalla es fijo, así que
// basta un perfil por rama para cubrir las cuatro cadenas propias.
const PERFILES: readonly EstadisticasPartida[] = [
  { disparos: 5, fallos: 1, autoimpactos: 1, danioHechoAlEnemigo: 40, pixelesDestruidos: 10 },
  { disparos: 4, fallos: 0, autoimpactos: 0, danioHechoAlEnemigo: 100, pixelesDestruidos: 10 },
  { disparos: 5, fallos: 1, autoimpactos: 0, danioHechoAlEnemigo: 40, pixelesDestruidos: 3000 },
  { disparos: 5, fallos: 2, autoimpactos: 0, danioHechoAlEnemigo: 100, pixelesDestruidos: 10 },
];

// armas-5 cubría solo el catálogo de armas porque el banco de frases y el
// parte de guerra todavía no existían; esta es esa misma extensión, con la
// misma función de colisión, aplicada al material que aporta este bloque.
function cadenasDeHumor(): string[] {
  const frasesDelBanco = combinacionesDelBanco().flatMap(({ personalidadId, tipoEvento }) => [...frasesPara(personalidadId, tipoEvento)]);
  const textosDeParte = PERFILES.flatMap((perfil) => {
    const parte = generarParteDeGuerra(perfil);
    return [parte.medalla, parte.texto];
  });
  return [...frasesDelBanco, ...textosDeParte];
}

test("humor-8: ninguna frase del banco de reacciones ni del parte de guerra coincide, normalizada, con no-copiar.md", () => {
  const contenido = readFileSync(RUTA_NO_COPIAR, "utf-8");
  const lista = analizarNoCopiar(contenido);
  const colisiones = buscarColisiones(cadenasDeHumor(), lista);

  assert.deepEqual(
    colisiones,
    [],
    `hay coincidencias con no-copiar.md: ${colisiones.map((c) => `"${c.cadenaPropia}" ~ "${c.entradaProhibida}"`).join(", ")}`,
  );
});

test("humor-8: ninguna frase del banco de reacciones está vacía ni repetida dentro de su propia combinación", () => {
  for (const { personalidadId, tipoEvento } of combinacionesDelBanco()) {
    const frases = frasesPara(personalidadId, tipoEvento);
    for (const frase of frases) {
      assert.equal(frase.trim().length > 0, true, `${personalidadId}/${tipoEvento}: frase vacía`);
    }
    assert.equal(
      new Set(frases).size,
      frases.length,
      `${personalidadId}/${tipoEvento}: hay frases repetidas dentro de la misma combinación`,
    );
  }
});

test("humor-8: el banco cubre exactamente las personalidades declaradas en ia-personalidades", () => {
  assert.deepEqual(
    new Set(Object.keys(BANCO_REACCIONES)),
    new Set(["la-contable", "almirante-bisagra", "chispa"]),
    "el banco de reacciones tiene personalidades de más o de menos respecto a ia-personalidades",
  );
});
