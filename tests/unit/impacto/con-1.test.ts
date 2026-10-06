import { test } from "node:test";
import assert from "node:assert/strict";
import { comprobarRocePaso, dentroDelPoligono, direccionDeNave } from "@/sim/naves/contacto";
import { RADIO_CASCO_NAVE_PX, crearRastreadorImpactoNaves, type NavePosicion } from "@/sim/naves/impacto";
import { puntosCascoVariante } from "@/sim/naves/geometriaCasco";

// con-1: la nave objetivo, quieta en el origen del mundo, mirando a +x --
// puntosCascoVariante(id, dir) es exactamente la silueta que dibuja Nave.ts
// para esta nave (la variante coincide con el asiento).
const NAVE_OBJETIVO: NavePosicion = { id: 1, x: 500, y: 300 };

// Un punto local de la silueta dibujada que queda fuera del casco de
// colisión: se busca en la propia silueta de la nave, porque cada asiento
// tiene una forma distinta y un punto fijo valdría solo para una.
function puntoFueraDelCascoDentroDeLaSilueta(): { readonly x: number; readonly y: number } {
  const dir = direccionDeNave(NAVE_OBJETIVO.id);
  const silueta = puntosCascoVariante(NAVE_OBJETIVO.id as 0 | 1 | 2 | 3, dir);
  for (let distancia = RADIO_CASCO_NAVE_PX + 12; distancia < 120; distancia += 1) {
    const candidato = { x: dir * distancia, y: 0 };
    if (dentroDelPoligono(candidato.x, candidato.y, silueta)) return candidato;
  }
  throw new Error("fixture inválido: la silueta no sale del casco de colisión");
}

test("con-1: un segmento que cruza el casco real es impacto -- comprobarRocePaso no debe activarse ahí (lo decide comprobarPaso)", () => {
  const anterior = { x: 500, y: 200, vx: 0, vy: 40 };
  const actual = { x: 500, y: 320, vx: 0, vy: 40 };
  // El segmento pasa por el centro del casco: comprobarPaso (RADIO_CASCO_NAVE_PX)
  // ya lo clasificaría como impacto: comprobarRocePaso debe devolver null, no
  // "también" roce -- impacto y roce son mutuamente excluyentes por diseño.
  const roce = comprobarRocePaso(anterior, actual, [NAVE_OBJETIVO]);
  assert.equal(roce, null);
});

test("con-1: un segmento que pasa fuera del casco real pero dentro de la silueta dibujada es roce", () => {
  const punto = puntoFueraDelCascoDentroDeLaSilueta();
  assert.ok(Math.hypot(punto.x, punto.y) > RADIO_CASCO_NAVE_PX, "el punto de prueba debe quedar fuera del casco de colisión");

  // Vertical, para cruzar la silueta por el eje en que sale del casco.
  const x = NAVE_OBJETIVO.x + punto.x;
  const anterior = { x, y: NAVE_OBJETIVO.y - 1, vx: 0, vy: 100 };
  const actual = { x, y: NAVE_OBJETIVO.y + 1, vx: 0, vy: 100 };

  const roce = comprobarRocePaso(anterior, actual, [NAVE_OBJETIVO]);
  assert.ok(roce, "se esperaba roce");
  assert.equal(roce!.nave, NAVE_OBJETIVO.id);
});

test("con-1: un segmento que pasa fuera de toda silueta no es ni impacto ni roce", () => {
  const anterior = { x: NAVE_OBJETIVO.x, y: NAVE_OBJETIVO.y - 500, vx: 100, vy: 0 };
  const actual = { x: NAVE_OBJETIVO.x + 40, y: NAVE_OBJETIVO.y - 500, vx: 100, vy: 0 };
  const roce = comprobarRocePaso(anterior, actual, [NAVE_OBJETIVO]);
  assert.equal(roce, null);
});

test("con-1: la clasificación es una función pura -- 200 llamadas idénticas dan exactamente el mismo resultado", () => {
  const punto = puntoFueraDelCascoDentroDeLaSilueta();
  const x = NAVE_OBJETIVO.x + punto.x;
  const anterior = { x, y: NAVE_OBJETIVO.y - 1, vx: 0, vy: 100 };
  const actual = { x, y: NAVE_OBJETIVO.y + 1, vx: 0, vy: 100 };

  const resultados = Array.from({ length: 200 }, () => comprobarRocePaso(anterior, actual, [NAVE_OBJETIVO]));
  assert.ok(resultados.every((r) => r !== null && r.nave === resultados[0]!.nave && r.x === resultados[0]!.x && r.y === resultados[0]!.y));
});

test("con-1/con-5: el rastreador aditivo (comprobarRoce) no cambia el resultado de comprobarPaso -- el lote de 200 semillas de impacto sigue igual", () => {
  for (let semilla = 0; semilla < 200; semilla++) {
    const anguloRad = (semilla / 200) * Math.PI * 2;
    const radio = RADIO_CASCO_NAVE_PX - 1;
    const anterior = { x: NAVE_OBJETIVO.x - 50, y: NAVE_OBJETIVO.y, vx: 100, vy: 0 };
    const actual = {
      x: NAVE_OBJETIVO.x + radio * Math.cos(anguloRad),
      y: NAVE_OBJETIVO.y + radio * Math.sin(anguloRad),
      vx: 100,
      vy: 0,
    };
    const rastreador = crearRastreadorImpactoNaves([NAVE_OBJETIVO], 0 as 0 | 1);
    const impacto = rastreador.comprobarPaso(anterior, actual);
    // El punto final está DENTRO del radio de colisión en todas las
    // semillas (radio < RADIO_CASCO_NAVE_PX): debe seguir siendo impacto,
    // exactamente como antes de este bloque -- comprobarRoce nunca se llama
    // para este paso porque avanzar()/vuelo.ts solo lo consulta cuando
    // comprobarPaso ya ha dicho que no hay impacto.
    assert.ok(impacto, `semilla ${semilla}: se esperaba impacto`);
  }
});
