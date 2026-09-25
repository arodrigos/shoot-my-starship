import { test } from "node:test";
import assert from "node:assert/strict";
import { Terreno, type SuperficieDeTerreno } from "@/juego/terreno/Terreno";
import { crearMascaraVacia, SOLIDO, type Mascara } from "@/sim/terreno/mascara";
import type { RectanguloSucio } from "@/sim/terreno/huella";

class SuperficieEspia implements SuperficieDeTerreno {
  llamadas: RectanguloSucio[] = [];
  pintadasCompletas = 0;

  refrescarRectangulo(_mascara: Mascara, rectangulo: RectanguloSucio): void {
    this.llamadas.push(rectangulo);
  }

  pintarCompleta(): void {
    this.pintadasCompletas++;
  }
}

// Cubre el mecanismo que render-2 y render-5 necesitan: reconciliar la
// máscara autoritativa que devuelve avanzar() (con huellas de cualquier
// forma -- circular, cápsula, o ninguna) con la textura, sin que Terreno
// tenga que conocer la forma de cada arma.
test("sincronizarDesde: refresca solo el rectángulo que cambió respecto a la máscara anterior", () => {
  const anterior = crearMascaraVacia(100, 100);
  const espia = new SuperficieEspia();
  const terreno = new Terreno(anterior, espia);

  const nueva = crearMascaraVacia(100, 100);
  for (let y = 40; y < 60; y++) {
    for (let x = 30; x < 70; x++) {
      nueva.datos[y * 100 + x] = SOLIDO;
    }
  }

  const rectangulo = terreno.sincronizarDesde(nueva);

  assert.deepEqual(rectangulo, { x: 30, y: 40, ancho: 40, alto: 20 });
  assert.equal(espia.llamadas.length, 1);
  assert.deepEqual(espia.llamadas[0], rectangulo);
  assert.equal(terreno.obtenerMascara(), nueva);
});

test("sincronizarDesde: un arma sin huella (Gravitón) no cambia la máscara y no pide refresco", () => {
  const mascara = crearMascaraVacia(100, 100);
  const espia = new SuperficieEspia();
  const terreno = new Terreno(mascara, espia);

  // La misma máscara, ni un byte distinto: lo que devuelve resolverDisparo
  // para un arma con huella "ninguna".
  const identica = crearMascaraVacia(100, 100);
  const rectangulo = terreno.sincronizarDesde(identica);

  assert.equal(rectangulo, null);
  assert.equal(espia.llamadas.length, 0);
});

test("repintarCompleta: pide una pasada completa sobre la máscara actual, no la inicial", () => {
  const mascara = crearMascaraVacia(50, 50);
  const espia = new SuperficieEspia();
  const terreno = new Terreno(mascara, espia);

  terreno.aplicarHuella(25, 25, 10, "restar");
  const mascaraTrasCrater = terreno.obtenerMascara();

  terreno.repintarCompleta();

  assert.equal(espia.pintadasCompletas, 1);
  // La máscara que Terreno mantiene tras el cráter es la que se repinta: si
  // render-5 regenerase desde la semilla en vez de leer esto, el cráter
  // reaparecería.
  assert.equal(terreno.obtenerMascara(), mascaraTrasCrater);
});
