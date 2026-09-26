import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";
import { contarPixelesPorMaterial } from "@/sim/gravedad/planetas";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import type { Planeta } from "@/sim/gravedad/planetas";

const execFileAsync = promisify(execFile);

test("nav-4: la gravedad es de verdad significativa junto a una nave (el guion no protege un no-efecto)", () => {
  const mascara = crearMascaraVacia(2000, 1000);
  const radio = 150;
  aplicarHuellaCircular(mascara, 1000, 700, radio, "sumar", 1);
  const pixelesVivos = contarPixelesPorMaterial(mascara).get(1) ?? 0;
  const planeta: Planeta = { id: 1, cx: 1000, cy: 700, radio, densidad: 1, pixelesVivos };

  // Justo al lado de una nave típica (flotando a HOLGURA_SOLIDO_NAVE_PX del
  // planeta): si esta aceleración se aplicase a la nave -- en vez de solo a
  // proyectiles, que es la confusión que nav-4 vigila -- en los 600 pasos
  // (10s a 60Hz) del propio criterio la nave se desplazaría muy por encima
  // de su propia holgura de seguridad. Es la prueba de que el guion de abajo
  // protege un efecto real, no un cero.
  const aceleracion = calcularAceleracionGravitatoria([planeta], 1000, 700 - radio - 30);

  const PASOS = 600;
  const dt = 1 / 60;
  let velocidad = 0;
  let desplazamiento = 0;
  for (let paso = 0; paso < PASOS; paso++) {
    velocidad += aceleracion.y * dt;
    desplazamiento += velocidad * dt;
  }

  assert.ok(
    Math.abs(desplazamiento) > 30,
    `si esta gravedad tirase de la nave, 600 pasos la desplazarían solo ${desplazamiento}px`,
  );
});

test("nav-4: calcularAceleracionGravitatoria solo se llama desde simularVuelo, nunca sobre naves", async () => {
  await execFileAsync("node", ["scripts/comprobar-gravedad-solo-vuelo.mjs"], { cwd: process.cwd() });
});

test("nav-4: el guion comprobar-gravedad-solo-vuelo.mjs detecta una llamada colada fuera de vuelo.ts", async () => {
  const rutaFuga = path.resolve(process.cwd(), "src/sim/naves/__fuga-temporal-nav-4.ts");
  await writeFile(
    rutaFuga,
    'import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";\n' +
      "export const fugaDeGravedad = (planetas: Parameters<typeof calcularAceleracionGravitatoria>[0]) =>\n" +
      "  calcularAceleracionGravitatoria(planetas, 0, 0);\n",
    "utf8",
  );

  try {
    await assert.rejects(
      execFileAsync("node", ["scripts/comprobar-gravedad-solo-vuelo.mjs"], { cwd: process.cwd() }),
      /Command failed/,
    );
  } finally {
    await unlink(rutaFuga);
  }
});

test("nav-4: leer el propio fichero de vuelo confirma que sigue siendo el único permitido además de la definición", async () => {
  const contenido = await readFile(path.resolve(process.cwd(), "src/sim/fisica/vuelo.ts"), "utf8");
  assert.ok(contenido.includes("calcularAceleracionGravitatoria("), "vuelo.ts debería seguir llamando a la función");
});
