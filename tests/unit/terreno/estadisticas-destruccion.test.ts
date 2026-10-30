import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { contarPixelesDestruidos } from "@/sim/terreno/estadisticas";
import { AIRE, ESCOMBRO, PLANETA_MAX, SOLIDO, crearMascaraVacia } from "@/sim/terreno/mascara";

function mascara(datos: number[]) {
  const m = crearMascaraVacia(datos.length, 1);
  m.datos.set(datos);
  return m;
}

describe("contarPixelesDestruidos", () => {
  it("sin cambios: cero", () => {
    const m = mascara([SOLIDO, AIRE, SOLIDO]);
    assert.equal(contarPixelesDestruidos(m, m), 0);
  });

  it("cuenta las celdas de SOLIDO que pasan a aire", () => {
    assert.equal(contarPixelesDestruidos(mascara([SOLIDO, SOLIDO, SOLIDO, AIRE]), mascara([AIRE, SOLIDO, AIRE, AIRE])), 2);
  });

  it("añadir sólido (Vertedero Portátil) no resta ni suma", () => {
    assert.equal(contarPixelesDestruidos(mascara([AIRE, AIRE, SOLIDO]), mascara([SOLIDO, SOLIDO, AIRE])), 1);
  });

  // Un material tapado por otro no es mundo que desaparece: el único
  // "sumar" del juego (Vertedero Portátil) pinta SOLIDO encima de lo que
  // haya, y eso es añadir chatarra, no destruir el planeta de debajo.
  it("material que pasa a otro material distinto de aire no cuenta", () => {
    assert.equal(contarPixelesDestruidos(mascara([SOLIDO, 3, ESCOMBRO]), mascara([ESCOMBRO, SOLIDO, SOLIDO])), 0);
  });

  it("destruir material de otros planetas o escombro también es mundo que desaparece", () => {
    assert.equal(contarPixelesDestruidos(mascara([3, ESCOMBRO]), mascara([AIRE, AIRE])), 2);
  });

  it("varios materiales a la vez: planeta 1, otro planeta, escombro, aire y material añadido", () => {
    const antes = mascara([SOLIDO, 7, PLANETA_MAX, ESCOMBRO, AIRE, AIRE, 5]);
    const despues = mascara([AIRE, AIRE, AIRE, AIRE, AIRE, SOLIDO, 5]);
    assert.equal(contarPixelesDestruidos(antes, despues), 4);
  });
});
