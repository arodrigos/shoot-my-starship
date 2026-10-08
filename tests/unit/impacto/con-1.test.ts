import { test } from "node:test";
import assert from "node:assert/strict";
import { dentroDelPoligono, poligonoDeNave } from "@/sim/naves/contacto";
import { crearRastreadorImpactoNaves, type NavePosicion } from "@/sim/naves/impacto";
import { puntosCascoVariante } from "@/sim/naves/geometriaCasco";

// con-1 (naves-silueta): ya no hay roce. El segmento de un paso de vuelo es
// impacto si y solo si corta la silueta dibujada; si no la corta, no pasa nada.

// Orientación escrita a mano (la que se ve en pantalla), no sacada de
// direccionDeNave: así el test no se compara con la implementación.
const ORIENTACION_DIBUJADA = { 0: 1, 1: -1, 2: 1, 3: -1 } as const;
const ASIENTOS = [0, 1, 2, 3] as const;

function naveEn(id: 0 | 1 | 2 | 3): NavePosicion {
  return { id, x: 500, y: 300 };
}

test("con-1: un segmento que cruza la silueta es impacto en los cuatro asientos", () => {
  for (const id of ASIENTOS) {
    const nave = naveEn(id);
    const rastreador = crearRastreadorImpactoNaves([nave], id === 0 ? 1 : 0);
    const impacto = rastreador.comprobarPaso(
      { x: nave.x, y: nave.y - 200, vx: 0, vy: 40 },
      { x: nave.x, y: nave.y + 20, vx: 0, vy: 40 },
    );
    assert.ok(impacto, `asiento ${id}: se esperaba impacto`);
    assert.equal(impacto!.nave, id);
  }
});

test("con-1: un punto fuera de la silueta pero dentro del círculo envolvente no es impacto", () => {
  for (const id of ASIENTOS) {
    const dir = ORIENTACION_DIBUJADA[id];
    const silueta = puntosCascoVariante(id, dir);
    // La esquina superior de la caja: en todas las siluetas queda fuera.
    const ancho = Math.max(...silueta.map((p) => Math.abs(p.x)));
    const alto = Math.max(...silueta.map((p) => Math.abs(p.y)));
    assert.equal(dentroDelPoligono(ancho * 0.99, alto * 0.99, silueta), false, `asiento ${id}: fixture inválido`);
    const nave = naveEn(id);
    const rastreador = crearRastreadorImpactoNaves([nave], id === 0 ? 1 : 0);
    const y = nave.y - alto * 0.99;
    const impacto = rastreador.comprobarPaso(
      { x: nave.x + ancho * 0.99 + 1, y, vx: -100, vy: 0 },
      { x: nave.x + ancho * 0.99 - 1, y, vx: -100, vy: 0 },
    );
    assert.equal(impacto, null, `asiento ${id}: el hueco de la caja no es zona de impacto`);
  }
});

test("con-1: la clasificación es una función pura -- 200 llamadas idénticas dan exactamente el mismo resultado", () => {
  const nave = naveEn(2);
  const resultados = Array.from({ length: 200 }, () =>
    crearRastreadorImpactoNaves([nave], 0).comprobarPaso(
      { x: nave.x, y: nave.y - 100, vx: 0, vy: 100 },
      { x: nave.x, y: nave.y + 100, vx: 0, vy: 100 },
    ),
  );
  assert.ok(resultados.every((r) => r !== null && r.x === resultados[0]!.x && r.y === resultados[0]!.y));
});

test("con-1: el punto de impacto cae sobre el borde de la silueta (no más allá)", () => {
  for (const id of ASIENTOS) {
    const nave = naveEn(id);
    const impacto = crearRastreadorImpactoNaves([nave], id === 0 ? 1 : 0).comprobarPaso(
      { x: nave.x - 200, y: nave.y, vx: 100, vy: 0 },
      { x: nave.x + 200, y: nave.y, vx: 100, vy: 0 },
    );
    assert.ok(impacto, `asiento ${id}: se esperaba impacto`);
    const poligono = poligonoDeNave(nave);
    const localX = impacto!.x - nave.x;
    const haciaDentro = Math.sign(-localX);
    assert.ok(dentroDelPoligono(localX + haciaDentro * 0.5, 0, poligono), `asiento ${id}: medio píxel hacia dentro debe estar dentro`);
    assert.equal(dentroDelPoligono(localX - haciaDentro * 0.5, 0, poligono), false, `asiento ${id}: medio píxel hacia fuera debe estar fuera`);
  }
});
