import { test, expect } from "@playwright/test";
import { anguloTrasArrastre } from "@/juego/control/apuntado";
import { arrastrarDesdeNave } from "./utilesApuntado";

// apu-2: a 360x640 se fija cualquier ángulo con 0,1° de exactitud con un
// arrastre en el lienzo y, como mucho, 5 toques finos.
const OBJETIVOS = [0, 90, 183.5, 270, 359.9];

test("precision-angulo: arrastre en el lienzo y ≤ 5 toques finos dejan el ángulo exacto a 360x640", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });

  for (const objetivo of OBJETIVOS) {
    // La nave puede quedar cerca de un borde: se arrastra hacia dentro del
    // viewport solo si el punto cabe; si no, se usa una distancia menor (el
    // ángulo no depende de la distancia).
    await arrastrarDesdeNave(page, 0, objetivo, 60);
    const trasArrastre = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
    const error = Math.min(Math.abs(trasArrastre - objetivo), 360 - Math.abs(trasArrastre - objetivo));
    expect(error, `tras arrastrar a ${objetivo}° quedó en ${trasArrastre}°`).toBeLessThanOrEqual(0.5);

    // Hasta 5 toques de ±0,1° hacia el objetivo (sin cruzar el 0/360).
    for (let toque = 0; toque < 5; toque++) {
      const actual = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
      if (Math.abs(actual - objetivo) < 0.05) break;
      await page.getByTestId(actual < objetivo ? "paso-angulo-mas" : "paso-angulo-menos").click();
    }
    const final = await page.evaluate(() => window.__debug.control!.ajuste.anguloGrados);
    // Los toques finos saturan en 0 y 360 (control-2) en vez de dar la
    // vuelta: llegar a 0° desde 359,5° acaba en 360,0°, la misma dirección.
    const equivalente = objetivo === 0 && final === 360 ? 360 : objetivo;
    expect(final).toBeCloseTo(equivalente, 5);
    await expect(page.getByTestId("valor-angulo")).toHaveText(`${equivalente.toFixed(1).replace(".", ",")}°`);
  }
});

test("precision-angulo: un arrastre que empieza en la consola no mueve el ángulo a través del lienzo", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });

  const antes = await page.evaluate(() => window.__debug.control!.ajuste);
  const consola = (await page.getByTestId("consola").boundingBox())!;
  const lienzo = (await page.locator("#game-container canvas").boundingBox())!;
  const inicio = { x: consola.x + 20, y: consola.y + consola.height - 10 };
  const fin = { x: lienzo.x + lienzo.width / 2, y: lienzo.y + 40 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();
  const despues = await page.evaluate(() => window.__debug.control!.ajuste);

  // Lo que queda es lo que da el gesto de respaldo de la consola (vertical,
  // con ganancia). Si el lienzo hubiera tomado el arrastre, el ángulo sería
  // la dirección nave→dedo, que no coincide con esta fórmula.
  const esperado = anguloTrasArrastre(
    antes.anguloGrados,
    { x: inicio.x / 360, y: inicio.y / 640 },
    { x: fin.x / 360, y: fin.y / 640 },
  );
  expect(despues.anguloGrados).toBeCloseTo(esperado, 0);
});
