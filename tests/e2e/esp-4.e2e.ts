import { test, expect } from "@playwright/test";

// esp-4: a 360x640 el juego es usable de verdad -- sin scroll horizontal, el
// lienzo ocupa el 90% o más del ancho, los controles de disparo miden 44px
// o más en ambas dimensiones, y ninguno queda tapado por otro (por caja
// delimitadora, no por presencia en el DOM). La parte visual (¿se ve un
// sistema planetario reconocible?) es juicio del gatekeeper sobre la
// captura adjunta al entregable, no algo que este test pueda decidir.
const VIEWPORT = { width: 360, height: 640 };

function seSolapan(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("a 360x640 el lienzo domina la pantalla, los controles miden >=44px y no se tapan entre sí", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const sinScrollHorizontal = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(sinScrollHorizontal).toBe(true);

  const lienzo = await page.evaluate(() => {
    const canvas = document.querySelector("#game-container canvas") as HTMLCanvasElement;
    const caja = canvas.getBoundingClientRect();
    return { x: caja.x, y: caja.y, width: caja.width, height: caja.height };
  });
  expect(lienzo.width).toBeGreaterThanOrEqual(VIEWPORT.width * 0.9);

  const controlesDisparo = [
    page.getByTestId("disparar"),
    page.getByTestId("paso-angulo-mas"),
    page.getByTestId("paso-angulo-menos"),
  ];
  const cajas: { x: number; y: number; width: number; height: number }[] = [];
  for (const control of controlesDisparo) {
    const caja = await control.boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.width).toBeGreaterThanOrEqual(44);
    expect(caja!.height).toBeGreaterThanOrEqual(44);
    cajas.push(caja!);
  }

  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      expect(seSolapan(cajas[i], cajas[j])).toBe(false);
    }
  }
});
