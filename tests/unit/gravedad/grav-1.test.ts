import { test } from "node:test";
import assert from "node:assert/strict";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";
import { contarPixelesPorMaterial, type Planeta } from "@/sim/gravedad/planetas";

// 2 s de vuelo en pasos fijos, la ventana que fija el propio criterio grav-1.
const PASOS_2S = 120;

test("grav-1: dos planetas idénticos simétricos respecto a la línea de tiro cancelan su tirón lateral", () => {
  const mascara = crearMascaraVacia(2000, 1000);
  const radio = 80;
  // Uno a cada lado de y=500 (la línea de tiro), a la misma distancia: si la
  // gravedad de verdad suma los dos cuerpos, sus tirones verticales se
  // cancelan; si solo tirara "el planeta más cercano" (o cualquier otro
  // atajo que no sea una suma real), no lo harían.
  aplicarHuellaCircular(mascara, 1000, 200, radio, "sumar", 1);
  aplicarHuellaCircular(mascara, 1000, 800, radio, "sumar", 2);
  const contadores = contarPixelesPorMaterial(mascara);

  const planetas: Planeta[] = [
    { id: 1, cx: 1000, cy: 200, radio, densidad: 1, pixelesVivos: contadores.get(1) ?? 0 },
    { id: 2, cx: 1000, cy: 800, radio, densidad: 1, pixelesVivos: contadores.get(2) ?? 0 },
  ];

  const { proyectil } = simularVuelo(
    { x: 100, y: 500, vx: 400, vy: 0 },
    0,
    0,
    () => false,
    { planetas, presupuestoPasos: PASOS_2S },
  );

  assert.ok(Math.abs(proyectil.y - 500) < 1, `desviación lateral neta ${proyectil.y - 500} debería ser < 1px`);
});

test("grav-1: duplicar el recuento de píxeles sólidos de un planeta duplica la desviación lateral a los 2s", () => {
  const mascara = crearMascaraVacia(2000, 1000);
  const radio = 80;
  aplicarHuellaCircular(mascara, 1000, 900, radio, "sumar", 1);
  const pixelesVivos = contarPixelesPorMaterial(mascara).get(1) ?? 0;

  const planeta1x: Planeta = { id: 1, cx: 1000, cy: 900, radio, densidad: 1, pixelesVivos };
  const planeta2x: Planeta = { ...planeta1x, pixelesVivos: pixelesVivos * 2 };

  const inicio = { x: 100, y: 500, vx: 400, vy: 0 };
  const final1x = simularVuelo(inicio, 0, 0, () => false, { planetas: [planeta1x], presupuestoPasos: PASOS_2S });
  const final2x = simularVuelo(inicio, 0, 0, () => false, { planetas: [planeta2x], presupuestoPasos: PASOS_2S });

  const desviacion1x = final1x.proyectil.y - 500;
  const desviacion2x = final2x.proyectil.y - 500;

  assert.ok(desviacion2x > desviacion1x, "el planeta más grande debe tirar más");
  const ratio = desviacion2x / desviacion1x;
  assert.ok(Math.abs(ratio - 2) <= 0.05 * 2, `ratio ${ratio} debería estar a menos del 5% de 2`);
});
