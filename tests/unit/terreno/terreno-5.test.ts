import { test } from "node:test";
import assert from "node:assert/strict";
import { Terreno, type SuperficieDeTerreno } from "@/juego/terreno/Terreno";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import type { RectanguloSucio } from "@/sim/terreno/huella";

// Doble de prueba: no dibuja nada, solo registra con qué rectángulo se le
// pidió refrescar. Así terreno-5 se comprueba en Node, sin Phaser ni canvas
// real -- ver el porqué de la interfaz en Terreno.ts.
class SuperficieEspia implements SuperficieDeTerreno {
  llamadas: RectanguloSucio[] = [];

  refrescarRectangulo(_mascara: unknown, rectangulo: RectanguloSucio): void {
    this.llamadas.push(rectangulo);
  }
}

test("terreno-5: aplicar una huella pide refrescar exactamente un rectángulo, acotado al radio", () => {
  const mascara = crearMascaraVacia(1920, 1080);
  const espia = new SuperficieEspia();
  const terreno = new Terreno(mascara, espia);

  terreno.aplicarHuella(960, 540, 120, "restar");

  assert.equal(espia.llamadas.length, 1);
  const rectangulo = espia.llamadas[0];

  // El rectángulo sucio es del tamaño del radio, no del lienzo entero: es lo
  // que evita el repintado completo por cada impacto (el propio fallo de
  // rendimiento que terreno-5 existe para descartar).
  assert.ok(rectangulo.ancho <= 2 * 120 + 2);
  assert.ok(rectangulo.alto <= 2 * 120 + 2);
  assert.notEqual(rectangulo.ancho, mascara.ancho);
  assert.notEqual(rectangulo.alto, mascara.alto);
});

test("terreno-5: el rectángulo sucio se recorta al borde del mapa cuando el impacto está en la esquina", () => {
  const mascara = crearMascaraVacia(200, 150);
  const espia = new SuperficieEspia();
  const terreno = new Terreno(mascara, espia);

  terreno.aplicarHuella(0, 0, 50, "restar");

  const rectangulo = espia.llamadas[0];
  assert.equal(rectangulo.x, 0);
  assert.equal(rectangulo.y, 0);
  assert.ok(rectangulo.ancho <= 51);
  assert.ok(rectangulo.alto <= 51);
});

test("terreno-5: cada llamada a aplicarHuella produce exactamente una llamada a refrescarRectangulo", () => {
  const mascara = crearMascaraVacia(500, 500);
  const espia = new SuperficieEspia();
  const terreno = new Terreno(mascara, espia);

  terreno.aplicarHuella(100, 100, 20, "restar");
  terreno.aplicarHuella(200, 200, 30, "sumar");
  terreno.aplicarHuella(300, 300, 10, "restar");

  assert.equal(espia.llamadas.length, 3);
});
