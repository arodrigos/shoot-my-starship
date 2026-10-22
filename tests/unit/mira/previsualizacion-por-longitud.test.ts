import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularAbanicoPrevisualizacion,
  calcularPrevisualizacion,
  PASOS_MAXIMOS_TRAYECTORIA,
  PRESUPUESTO_COMPUTO_ABANICO_MS,
  PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS,
  RAYOS_POR_LADO_TRAMO2,
  superaPresupuestoAbanico,
  superaPresupuestoComputo,
} from "@/sim/armas/previsualizacion";
import { longitudDeArco } from "@/juego/mira/trayectoriaPantalla";
import { ALTURA_CANON_PX } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { MARGEN_SALIDA_U } from "@/sim/fisica/vuelo";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

// La mira por longitud de arco (longitudMundoMax) y el abanico: resultados
// concretos con suelo plano y semillas fijas, sin tiradas estadísticas.

const ALTURA_SUELO = 1300;
const base = {
  mascara: crearMascaraPlana(2400, 1400, ALTURA_SUELO),
  gravedad: 1,
  deriva: 0,
  ancho: 2400,
  alto: 1400,
  origenX: 300,
  origenY: ALTURA_SUELO,
  comportamiento: { tipo: "impacto-simple" } as const,
};

const gradosDelPrimerPaso = (t: readonly { x: number; y: number }[]) => (Math.atan2(-(t[1].y - t[0].y), t[1].x - t[0].x) * 180) / Math.PI;

test("por longitud: el primer punto es la boca del cañón y la línea para en el primer paso que pasa la cota", () => {
  for (const longitudMundoMax of [50, 400, 700]) {
    const t = calcularPrevisualizacion({ ...base, anguloGrados: 60, potencia: 50, longitudMundoMax });
    assert.equal(t[0].x, 300);
    assert.equal(t[0].y, ALTURA_SUELO - ALTURA_CANON_PX);
    // Pasa la cota con el último paso y no antes: ni se queda corta ni sigue de más.
    assert.ok(longitudDeArco(t) > longitudMundoMax, `${longitudDeArco(t)} ≤ ${longitudMundoMax}`);
    assert.ok(longitudDeArco(t.slice(0, -1)) <= longitudMundoMax, `${longitudDeArco(t.slice(0, -1))} > ${longitudMundoMax}`);
  }
});

test("por longitud: sube hacia arriba y en la dirección del ángulo (eje y de mundo hacia abajo)", () => {
  const derecha = calcularPrevisualizacion({ ...base, anguloGrados: 60, potencia: 50, longitudMundoMax: 200 });
  const izquierda = calcularPrevisualizacion({ ...base, origenX: 1200, anguloGrados: 120, potencia: 50, longitudMundoMax: 200 });
  assert.ok(Math.abs(gradosDelPrimerPaso(derecha) - 60) < 1, `${gradosDelPrimerPaso(derecha)}`);
  assert.ok(Math.abs(gradosDelPrimerPaso(izquierda) - 120) < 1, `${gradosDelPrimerPaso(izquierda)}`);
  assert.ok(derecha[derecha.length - 1].y < derecha[0].y && derecha[derecha.length - 1].x > derecha[0].x);
  assert.ok(izquierda[izquierda.length - 1].y < izquierda[0].y && izquierda[izquierda.length - 1].x < izquierda[0].x);
  // Simétricos respecto a la vertical del cañón: la gravedad tira igual hacia abajo en los dos.
  assert.equal(derecha.length, izquierda.length);
  for (let i = 0; i < derecha.length; i++) {
    assert.ok(Math.abs(derecha[i].x - 300 - (1200 - izquierda[i].x)) < 1e-6);
    assert.ok(Math.abs(derecha[i].y - izquierda[i].y) < 1e-6);
  }
});

test("por longitud: un tiro que choca antes de la cota termina en el suelo y no oculta el contacto", () => {
  const t = calcularPrevisualizacion({ ...base, origenY: 1200, anguloGrados: -30, potencia: 50, longitudMundoMax: 1000 });
  const fin = t[t.length - 1];
  assert.ok(longitudDeArco(t) < 1000);
  assert.ok(Math.round(fin.y) >= ALTURA_SUELO, `fin en y=${fin.y}`);
  for (const p of t.slice(0, -1)) assert.ok(Math.round(p.y) < ALTURA_SUELO, `punto ya enterrado en y=${p.y}`);
  // Sin la cota de longitud, pvr-2 sí lo esconde: el contraste es lo que cambia el modo.
  const sinCota = calcularPrevisualizacion({ ...base, origenY: 1200, anguloGrados: -30, potencia: 50 });
  assert.ok(sinCota[sinCota.length - 1].y < ALTURA_SUELO - 1);
});

test("por longitud: un tiro que sale por el lateral se corta en el borde ampliado del encuadre", () => {
  const t = calcularPrevisualizacion({ ...base, origenX: 2370, anguloGrados: 10, potencia: 100, longitudMundoMax: 1000 });
  assert.equal(t[t.length - 1].x, 2400 + MARGEN_SALIDA_U);
  for (const p of t) assert.ok(p.x <= 2400 + MARGEN_SALIDA_U);
  const porIzquierda = calcularPrevisualizacion({ ...base, origenX: 30, anguloGrados: 170, potencia: 100, longitudMundoMax: 1000 });
  assert.equal(porIzquierda[porIzquierda.length - 1].x, -MARGEN_SALIDA_U);
});

test("por longitud: sin choque ni borde, el tope de pasos corta la línea", () => {
  // Sin gravedad, a potencia mínima y en un mundo muy ancho la cota de longitud no llega nunca.
  const ancho = 8000;
  const t = calcularPrevisualizacion({ ...base, mascara: crearMascaraPlana(ancho, 200, 199), ancho, alto: 200, origenX: 100, origenY: 199, gravedad: 0, anguloGrados: 0, potencia: 0, longitudMundoMax: 1e9 });
  assert.equal(t.length, PASOS_MAXIMOS_TRAYECTORIA + 1);
  for (const p of t) assert.equal(p.y, 199 - ALTURA_CANON_PX);
});

test("por longitud: el láser va en línea recta, sin gravedad", () => {
  const t = calcularPrevisualizacion({ ...base, comportamiento: { tipo: "instantaneo" }, anguloGrados: 30, potencia: 50, longitudMundoMax: 300 });
  const pendiente = -Math.tan(Math.PI / 6);
  for (const p of t.slice(1)) assert.ok(Math.abs((p.y - t[0].y) / (p.x - t[0].x) - pendiente) < 1e-9);
  assert.ok(longitudDeArco(t) > 300);
});

test("por longitud: la mosca se enseña sin perturbación aunque haya estado aleatorio", () => {
  const mosca = { tipo: "erratico", magnitudPxS2: 4000 } as const;
  const comun = { ...base, anguloGrados: 50, potencia: 60 };
  const conAzar = calcularPrevisualizacion({ ...comun, comportamiento: mosca, aleatorio: crearEstadoAleatorio(1234), longitudMundoMax: 300 });
  const recta = calcularPrevisualizacion({ ...comun, longitudMundoMax: 300 });
  assert.deepEqual(conAzar.map((p) => [p.x, p.y]), recta.map((p) => [p.x, p.y]));
  // Sin la cota de longitud la misma semilla sí la desvía (la mira antigua), o la prueba no distinguiría nada.
  const antigua = calcularPrevisualizacion({ ...comun, comportamiento: mosca, aleatorio: crearEstadoAleatorio(1234) });
  const sinAzar = calcularPrevisualizacion({ ...comun, comportamiento: mosca });
  assert.notDeepEqual(antigua.map((p) => [p.x, p.y]), sinAzar.map((p) => [p.x, p.y]));
});

test("abanico: cada borde y cada rayo es la previsualización real a su ángulo, de menor a mayor", () => {
  const params = { ...base, origenX: 1200, anguloGrados: 70, potencia: 55, longitudMundoMax: 350 };
  const a = calcularAbanicoPrevisualizacion(params, 9, 45);
  const en = (angulo: number) => calcularPrevisualizacion({ ...params, anguloGrados: angulo });
  assert.deepEqual(a.centro, en(70));
  assert.deepEqual(a.tramo1.menor, en(61));
  assert.deepEqual(a.tramo1.mayor, en(79));
  assert.equal(a.tramo2.rayos.length, 2 * RAYOS_POR_LADO_TRAMO2 + 1);
  const angulos = [25, 36.25, 47.5, 58.75, 70, 81.25, 92.5, 103.75, 115];
  a.tramo2.rayos.forEach((rayo, i) => {
    assert.deepEqual(rayo, en(angulos[i]), `rayo ${i}`);
    assert.ok(Math.abs(gradosDelPrimerPaso(rayo) - angulos[i]) < 1, `rayo ${i} sale a ${gradosDelPrimerPaso(rayo)}°`);
  });
  assert.equal(a.tramo2.menor, a.tramo2.rayos[0]);
  assert.equal(a.tramo2.mayor, a.tramo2.rayos[2 * RAYOS_POR_LADO_TRAMO2]);
});

test("abanico: con la mosca (±18°/±90°) los rayos extremos salen horizontales y el de abajo choca enseguida", () => {
  const a = calcularAbanicoPrevisualizacion({ ...base, origenX: 1200, origenY: ALTURA_SUELO - 1, anguloGrados: 90, potencia: 50, longitudMundoMax: 600 }, 18, 90);
  // La gravedad ya los inclina un grado hacia abajo en el primer paso.
  assert.ok(Math.abs(gradosDelPrimerPaso(a.tramo2.menor)) < 1.5);
  assert.ok(Math.abs(Math.abs(gradosDelPrimerPaso(a.tramo2.mayor)) - 180) < 1.5);
  assert.ok(a.tramo2.menor[1].x > a.tramo2.menor[0].x && a.tramo2.mayor[1].x < a.tramo2.mayor[0].x);
  assert.ok(Math.abs(gradosDelPrimerPaso(a.tramo1.menor) - 72) < 1);
  assert.ok(Math.abs(gradosDelPrimerPaso(a.tramo1.mayor) - 108) < 1);
  // El centro sube en vertical hasta la cota; los horizontales caen al suelo antes.
  assert.ok(longitudDeArco(a.centro) > 600);
  for (const borde of [a.tramo2.menor, a.tramo2.mayor]) {
    assert.ok(longitudDeArco(borde) < 600);
    assert.ok(Math.round(borde[borde.length - 1].y) >= ALTURA_SUELO);
  }
});

test("presupuestos de cómputo: el límite exacto aún cabe, un milisegundo más no", () => {
  assert.equal(superaPresupuestoComputo(PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS), false);
  assert.equal(superaPresupuestoComputo(PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS + 0.01), true);
  assert.equal(superaPresupuestoAbanico(PRESUPUESTO_COMPUTO_ABANICO_MS), false);
  assert.equal(superaPresupuestoAbanico(PRESUPUESTO_COMPUTO_ABANICO_MS + 0.01), true);
  assert.equal(superaPresupuestoAbanico(PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS + 1), false);
  assert.equal(superaPresupuestoAbanico(0), false);
});
