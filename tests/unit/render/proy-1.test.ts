import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { puntosSilueta, hashSilueta, dimensionMayor, FRACCION_MINIMA_PROYECTIL } from "@/juego/proyectiles/geometriaProyectil";
import { cajaCasco } from "@/sim/naves/geometriaCasco";

// proy-1 pedía originalmente "18px a escala de juego" en términos absolutos
// de pantalla. escala-legible (esc-1, camino_critico) lo sustituye por un
// suelo RELATIVO al lado mayor de la nave ya dibujada: a 360px de ancho ese
// suelo relativo cae por debajo de los 18px absolutos (ver esc-6, no
// crítico, documentado como desviación incompatible con esc-1 en el
// entregable de este bloque). Medir aquí el absoluto de antes haría fallar
// el test por un requisito que el propio diseño desplazó a un segundo
// plano -- lo que se comprueba ahora es que ningún proyectil cae por debajo
// del suelo relativo vigente, no un número de pantalla que ya no gobierna.
const ladoMayorNave = Math.max(...Object.values(cajaCasco(1)));

test("proy-1: ningún proyectil es un punto -- toda arma respeta el suelo de tamaño derivado de la nave (escala-legible/esc-2)", () => {
  for (const arma of CATALOGO_ARMAS) {
    const dimensionMundo = dimensionMayor(puntosSilueta(arma));
    const fraccion = dimensionMundo / ladoMayorNave;
    assert.ok(
      fraccion >= FRACCION_MINIMA_PROYECTIL - 1e-6,
      `${arma.id}: silueta de ${dimensionMundo.toFixed(1)}px de mundo es el ${(fraccion * 100).toFixed(1)}% del lado mayor de la nave, por debajo del suelo relativo (${FRACCION_MINIMA_PROYECTIL * 100}%)`,
    );
  }
});

test("proy-1: las siluetas del catálogo son distinguibles entre sí (hash sin colisiones)", () => {
  const hashes = new Set<string>();
  for (const arma of CATALOGO_ARMAS) {
    const hash = hashSilueta(puntosSilueta(arma));
    assert.ok(!hashes.has(hash), `${arma.id}: su silueta coincide con la de otra arma ya vista (hash "${hash}")`);
    hashes.add(hash);
  }
  assert.equal(hashes.size, CATALOGO_ARMAS.length);
});
