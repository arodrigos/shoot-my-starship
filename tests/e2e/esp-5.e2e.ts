import { test, expect, type Page } from "@playwright/test";
import { componentesRGB, luminanciaRelativa, ratioDeContraste, RATIO_MINIMO_TEXTO } from "../utils/contraste";

// esp-5: el esquema claro/oscuro del sistema cambia el cromado (paneles,
// texto del HUD) con contraste >=4.5:1 en los dos, mientras que el campo de
// juego (el canvas y el letterbox que lo rodea) se queda oscuro en ambos
// esquemas -- decisión declarada, no un descuido: SuperficieEspacio y el
// fondo de Phaser no leen `prefers-color-scheme` en ningún momento.

async function iniciarPartida(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

test("los esquemas claro y oscuro dan >=4.5:1 de contraste en el cromado, y el campo de juego se queda oscuro en los dos", async ({
  page,
}) => {
  const lecturas: { esquema: "light" | "dark"; fondo: string; texto: string; bodyFondo: string }[] = [];

  for (const esquema of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: esquema });
    await iniciarPartida(page);

    const estilos = await page.evaluate(() => {
      const raiz = getComputedStyle(document.documentElement);
      return {
        fondo: raiz.getPropertyValue("--color-cromado-fondo").trim(),
        texto: raiz.getPropertyValue("--color-cromado-texto").trim(),
        bodyFondo: getComputedStyle(document.body).backgroundColor,
      };
    });
    lecturas.push({ esquema, ...estilos });

    const ratio = ratioDeContraste(estilos.fondo, estilos.texto);
    expect(ratio).toBeGreaterThanOrEqual(RATIO_MINIMO_TEXTO);
  }

  const [oscuro, claro] = lecturas;
  // El cromado tiene que cambiar de verdad entre esquemas -- si fondo/texto
  // fueran iguales en los dos, el test anterior habría pasado sin que
  // prefers-color-scheme estuviera teniendo ningún efecto real.
  expect(claro.fondo).not.toBe(oscuro.fondo);
  expect(claro.texto).not.toBe(oscuro.texto);

  // El campo de juego (letterbox tras el canvas) se queda oscuro en los dos
  // esquemas -- misma decisión declarada, comprobable sin leer el canvas.
  expect(claro.bodyFondo).toBe(oscuro.bodyFondo);
  const [br, bg, bb] = componentesRGB(oscuro.bodyFondo);
  expect(luminanciaRelativa([br, bg, bb])).toBeLessThan(0.1);
});
