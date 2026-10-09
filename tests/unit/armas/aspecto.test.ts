import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import {
  aspectoDeId,
  aspectosDelCatalogo,
  GIRO_RODANTE_RAD_S,
  nombreTextura,
  presupuestoParticulas,
  trazadoDeArma,
  trazadoSvg,
} from "@/juego/armas/aspecto";
import { hashSilueta, puntosSilueta } from "@/juego/proyectiles/geometriaProyectil";
import { efectosRegistrados, techoTotalParticulas } from "@/juego/efectos/registroEfectos";

// sRGB → CIELAB (D65) y ΔE76: suficiente para decidir si dos colores se
// distinguen a simple vista (arm-1 pide ΔE ≥ 10 o forma distinta).
function lab(color: number): [number, number, number] {
  const lineal = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = lineal((color >> 16) & 255);
  const g = lineal((color >> 8) & 255);
  const b = lineal(color & 255);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
function deltaE(a: number, b: number): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

test("arm-1: cada arma del catálogo tiene exactamente un aspecto", () => {
  const ids = aspectosDelCatalogo().map((a) => a.armaId);
  assert.deepEqual([...ids].sort(), CATALOGO_ARMAS.map((a) => a.id).sort());
  assert.equal(new Set(ids).size, ids.length);
});

test("arm-1: dos armas cualesquiera se distinguen por forma o por color (ΔE ≥ 10)", () => {
  const aspectos = aspectosDelCatalogo();
  for (let i = 0; i < aspectos.length; i++) {
    for (let j = i + 1; j < aspectos.length; j++) {
      const mismaForma = hashSilueta(aspectos[i].puntos) === hashSilueta(aspectos[j].puntos);
      const de = deltaE(aspectos[i].paleta.cuerpo, aspectos[j].paleta.cuerpo);
      assert.ok(!mismaForma || de >= 10, `${aspectos[i].armaId} y ${aspectos[j].armaId}: misma forma y ΔE ${de.toFixed(1)}`);
    }
  }
});

// Invariante 1: el trazado del selector y los vértices que hornea Phaser
// salen de la misma función con la misma entrada, para cualquier arma.
test("arm-1 (propiedad): el trazado SVG del selector se reconstruye de los vértices horneados", () => {
  fc.assert(
    fc.property(fc.constantFrom(...CATALOGO_ARMAS.map((a) => a.id)), (armaId) => {
      const aspecto = aspectoDeId(armaId);
      const arma = CATALOGO_ARMAS.find((a) => a.id === armaId)!;
      assert.equal(trazadoDeArma(armaId), trazadoSvg(puntosSilueta(arma)));
      assert.equal(trazadoDeArma(armaId), trazadoSvg(aspecto.puntos));
      assert.equal(nombreTextura(armaId), `arma-${armaId}`);
      // Mismo número de comandos que vértices: ni uno más ni uno menos.
      assert.equal(trazadoDeArma(armaId).split(" ").filter((t) => /^[ML]/.test(t)).length, aspecto.puntos.length);
    }),
    { numRuns: 60 },
  );
});

test("arm-2: solo las armas que ruedan giran sobre sí mismas, a ≥ 90°/s", () => {
  for (const arma of CATALOGO_ARMAS) {
    const aspecto = aspectoDeId(arma.id);
    if (arma.comportamiento.tipo === "rodante") {
      assert.ok((aspecto.giroRadS * 180) / Math.PI >= 90);
      assert.equal(aspecto.giroRadS, GIRO_RODANTE_RAD_S);
    } else {
      assert.equal(aspecto.giroRadS, 0, `${arma.id} no rueda`);
    }
  }
});

test("arm-2: el rumbo del proyectil no se pierde en la silueta (morro en +x)", () => {
  for (const aspecto of aspectosDelCatalogo()) {
    const maxX = Math.max(...aspecto.puntos.map((p) => p.x));
    const minX = Math.min(...aspecto.puntos.map((p) => p.x));
    if (aspecto.giroRadS === 0) assert.ok(maxX > Math.abs(minX) * 0.7, `${aspecto.armaId}: morro hacia +x`);
  }
});

// Invariante 2: el techo declarado de todos los efectos cabe en el
// presupuesto del móvil, y el de escritorio nunca es menor.
test("arm-4 (propiedad): los techos de partículas registrados no superan el presupuesto global", () => {
  assert.ok(techoTotalParticulas() <= presupuestoParticulas(360), `suma ${techoTotalParticulas()} > 120`);
  assert.ok(efectosRegistrados().some((e) => e.id === "estela-llama"));
  fc.assert(
    fc.property(fc.integer({ min: 200, max: 2400 }), (ancho) => {
      const p = presupuestoParticulas(ancho);
      assert.ok(p === 120 || p === 240);
      assert.equal(p, ancho < 600 ? 120 : 240);
      assert.ok(techoTotalParticulas() <= p);
    }),
  );
});
