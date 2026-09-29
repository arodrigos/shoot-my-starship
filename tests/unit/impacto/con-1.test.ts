import { test } from "node:test";
import assert from "node:assert/strict";
import { comprobarRocePaso, dentroDelPoligono, direccionDeNave } from "@/sim/naves/contacto";
import { RADIO_CASCO_NAVE_PX, crearRastreadorImpactoNaves, type NavePosicion } from "@/sim/naves/impacto";
import { puntosCasco, cajaCasco } from "@/sim/naves/geometriaCasco";

// con-1: la nave objetivo, quieta en el origen del mundo, mirando a +x --
// puntosCasco(1) es exactamente la silueta que dibuja Nave.ts para esta
// nave (id 0, ver Partida.ts: mirarHaciaMasX=true).
const NAVE_OBJETIVO: NavePosicion = { id: 1, x: 500, y: 300 };

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
  const caja = cajaCasco(direccionDeNave(NAVE_OBJETIVO.id));
  // A medio camino entre el radio de colisión y el borde de la silueta
  // dibujada, en el eje Y (dentro del polígono ahí, ver puntosCasco).
  const yLocal = (RADIO_CASCO_NAVE_PX + caja.alto / 2) / 2;
  assert.ok(yLocal > RADIO_CASCO_NAVE_PX, "el punto de prueba debe quedar fuera del casco de colisión");
  assert.ok(
    dentroDelPoligono(0, yLocal, puntosCasco(direccionDeNave(NAVE_OBJETIVO.id))),
    "el punto de prueba debe quedar dentro de la silueta dibujada (fixture inválido si no)",
  );

  const x = NAVE_OBJETIVO.x;
  const y = NAVE_OBJETIVO.y + yLocal;
  const anterior = { x: x - 40, y, vx: 100, vy: 0 };
  const actual = { x: x + 40, y, vx: 100, vy: 0 };

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
  const caja = cajaCasco(direccionDeNave(NAVE_OBJETIVO.id));
  const yLocal = (RADIO_CASCO_NAVE_PX + caja.alto / 2) / 2;
  const anterior = { x: NAVE_OBJETIVO.x - 40, y: NAVE_OBJETIVO.y + yLocal, vx: 100, vy: 0 };
  const actual = { x: NAVE_OBJETIVO.x + 40, y: NAVE_OBJETIVO.y + yLocal, vx: 100, vy: 0 };

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
