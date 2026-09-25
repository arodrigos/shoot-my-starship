import { test, expect } from "@playwright/test";

// partida-5: degradación con gracia sin almacenamiento -- Storage.prototype
// .setItem lanzando reproduce el modo privado estricto real (Safari/iOS
// entre otros): es el mismo método que usa el sondeo de
// almacenamientoDisponible() y guardar() en progreso.ts, así que overridearlo
// en addInitScript (antes de que PantallaInicio se monte) prueba el camino
// de producción, no un doble de pruebas. El criterio pide dos cosas: que se
// pueda jugar una partida entera igualmente, y que el aviso aparezca UNA
// vez con una explicación real, no un icono mudo.
test("sin almacenamiento disponible, el aviso aparece una vez y se puede jugar una partida completa", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("El almacenamiento no está disponible en este contexto.", "SecurityError");
    };
  });

  await page.goto("/");
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();

  const aviso = page.getByTestId("aviso-sin-almacenamiento");
  await expect(aviso).toBeVisible();
  expect(await aviso.count()).toBe(1);
  const textoAviso = (await aviso.textContent())!.trim();
  expect(textoAviso.length).toBeGreaterThan(20);
  expect(textoAviso.toLowerCase()).toContain("no se van a guardar");

  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const inicio = { x: 180, y: 620 };
  const fin = { x: 220, y: 520 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(
    () => window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= 2 && window.__debug.animacionEnCurso === false,
    undefined,
    { timeout: 60000 },
  );

  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0), undefined, {
    timeout: 60000,
  });

  // El intento de guardado (guardarUltimaPartida, en Partida.ts) se degrada
  // en silencio contra un setItem que lanza -- la partida ya jugada llega
  // igual al parte de guerra, que es lo que este criterio exige.
  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
  const parte = await page.evaluate(() => window.__debug.parteDeGuerra);
  expect(parte).not.toBeNull();
  expect(parte!.estadisticas.disparos).toBeGreaterThan(0);
});
