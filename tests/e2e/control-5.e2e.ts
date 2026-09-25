import { test, expect } from "@playwright/test";

// control-5: "repetir último disparo" precarga ángulo/potencia/arma del tiro
// que de verdad se disparó. La otra mitad del criterio -- "con la misma
// deriva el impacto cae a <=2px del anterior" -- se comprueba a nivel de
// física pura en tests/unit/control/control-5.test.ts (mismos parámetros,
// misma máscara, mismo resultado), no aquí: un turno de la máquina de por
// medio puede alterar el terreno bajo la trayectoria del jugador de forma
// legítima, y eso haría que dos "mismos" disparos aterricen en sitios
// distintos por una razón ajena a "repetir" (el campo de batalla cambió, no
// el control). Ver desviaciones del bloque.
test("repetir último disparo precarga el ángulo, la potencia y el arma del disparo que de verdad se hizo", async ({
  page,
}) => {
  // Ver control-1: dos turnos animados bajo WebGL por software pueden tardar
  // más que los timeouts por defecto sin que haya nada roto.
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const inicio = { x: 195, y: 760 };
  const fin = { x: 260, y: 620 };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  const ajusteDisparado = (await page.evaluate(() => window.__debug.control!.ajuste))!;

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();

  // Espera determinista (issue #151): dos turnos resueltos y de vuelta al
  // jugador, sin animación en curso.
  await page.waitForFunction(
    () => window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= 2 && window.__debug.animacionEnCurso === false,
    undefined,
    { timeout: 60000 },
  );

  // Se desajusta a propósito antes de repetir, para que el resultado no
  // pueda deberse a que el ajuste ya coincidía por casualidad.
  await page.getByTestId("paso-angulo-mas").click();
  await page.getByTestId("paso-angulo-mas").click();
  const ajusteDesviado = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(ajusteDesviado.anguloGrados).not.toEqual(ajusteDisparado.anguloGrados);

  await page.getByTestId("repetir-disparo").click();

  const ajustePrecargado = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(ajustePrecargado).toEqual(ajusteDisparado);
});
