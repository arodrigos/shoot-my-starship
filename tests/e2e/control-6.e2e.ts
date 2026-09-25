import { test, expect } from "@playwright/test";
import { CATALOGO_ARMAS } from "../../src/sim/armas/catalogo";

// control-6: ayuda inicial descartable y que no vuelve a aparecer; el
// selector de armas muestra nombre y descripción de cada una; el arma
// agotada (Despedida, usosMaximos=1) se marca como "agotada".
test.describe("control-6", () => {
  test("la ayuda inicial se puede cerrar y no reaparece tras recargar", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.control !== undefined);

    await expect(page.getByTestId("ayuda-inicial")).toBeVisible();
    await page.getByTestId("ayuda-cerrar").click();
    await expect(page.getByTestId("ayuda-inicial")).toBeHidden();

    await page.reload();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.control !== undefined);
    await expect(page.getByTestId("ayuda-inicial")).toBeHidden();
  });

  test("el selector de armas muestra nombre y descripción de cada una de las 10 armas", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.control !== undefined);
    if (await page.getByTestId("ayuda-cerrar").isVisible()) {
      await page.getByTestId("ayuda-cerrar").click();
    }

    await page.getByTestId("selector-arma-abrir").click();

    expect(CATALOGO_ARMAS.length).toEqual(10);
    for (const arma of CATALOGO_ARMAS) {
      const boton = page.getByTestId(`arma-${arma.id}`);
      await expect(boton).toContainText(arma.nombre);
      await expect(boton).toContainText(arma.descripcion);
    }
  });

  test("la Despedida se muestra como agotada tras usarse una vez", async ({ page }) => {
    // Ver control-1: dos turnos animados bajo WebGL por software pueden
    // tardar más que los timeouts por defecto sin que haya nada roto.
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?mapa=calma-de-los-restos");
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
    if (await page.getByTestId("ayuda-cerrar").isVisible()) {
      await page.getByTestId("ayuda-cerrar").click();
    }

    await page.getByTestId("selector-arma-abrir").click();
    const botonDespedidaAntes = page.getByTestId("arma-despedida");
    await expect(botonDespedidaAntes).not.toContainText("agotada");
    await expect(botonDespedidaAntes).toBeEnabled();
    await botonDespedidaAntes.click();

    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await page.getByTestId("disparar").click();

    // Espera determinista (issue #151): dos turnos resueltos y de vuelta al
    // jugador, sin animación en curso -- solo entonces el store ha marcado
    // el uso de la Despedida.
    await page.waitForFunction(
      () => window.__debug.turno === 0 && (window.__debug.numeroTurno ?? 0) >= 2 && window.__debug.animacionEnCurso === false,
      undefined,
      { timeout: 60000 },
    );

    await page.getByTestId("selector-arma-abrir").click();
    const botonDespedidaDespues = page.getByTestId("arma-despedida");
    await expect(botonDespedidaDespues).toContainText("agotada");
    await expect(botonDespedidaDespues).toBeDisabled();
  });
});
