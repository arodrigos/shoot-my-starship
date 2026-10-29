import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { contarPixelesDestruidos } from "@/sim/terreno/estadisticas";
import { AIRE, ESCOMBRO, SOLIDO, crearMascaraVacia } from "@/sim/terreno/mascara";

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

  it("SOLIDO que pasa a otro material distinto de aire también cuenta", () => {
    assert.equal(contarPixelesDestruidos(mascara([SOLIDO]), mascara([ESCOMBRO])), 1);
  });

  // Fallo esperado: desde grav-8 cualquier byte distinto de AIRE es sólido
  // (planetas 1..12 y escombro 255), pero el contador solo mira SOLIDO=1.
  // Vaciar el planeta 3 o un anillo de escombro no suma nada al Mérito
  // Geológico. Se deja marcado, sin arreglar, para que lo decida el bloque
  // dueño.
  it(
    "destruir material de otros planetas o escombro también es mundo que desaparece",
    { todo: "contarPixelesDestruidos solo cuenta material SOLIDO=1, no planetas 2..12 ni escombro" },
    () => {
      assert.equal(contarPixelesDestruidos(mascara([3, ESCOMBRO]), mascara([AIRE, AIRE])), 2);
    },
  );
});
