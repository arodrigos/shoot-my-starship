import { test, expect, type Page } from "@playwright/test";

// esp-5: el esquema claro/oscuro del sistema cambia el cromado (paneles,
// texto del HUD) con contraste >=4.5:1 en los dos, mientras que el campo de
// juego (el canvas y el letterbox que lo rodea) se queda oscuro en ambos
// esquemas -- decisión declarada, no un descuido: SuperficieEspacio y el
// fondo de Phaser no leen `prefers-color-scheme` en ningún momento.

function componentesRGB(color: string): [number, number, number] {
  const coincidenciaHex = color.match(/^#([0-9a-f]{6})$/i);
  if (coincidenciaHex) {
    const hex = coincidenciaHex[1];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  const coincidenciaRgb = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (coincidenciaRgb) {
    return [Number(coincidenciaRgb[1]), Number(coincidenciaRgb[2]), Number(coincidenciaRgb[3])];
  }
  throw new Error(`color no reconocido: ${color}`);
}

// Luminancia relativa y ratio de contraste, fórmula WCAG 2.x estándar (la
// misma que usa cualquier comprobador de contraste): un cálculo genérico de
// test, no algo que viva en el producto.
function luminanciaRelativa([r, g, b]: [number, number, number]): number {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [canal(r), canal(g), canal(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function ratioDeContraste(colorA: string, colorB: string): number {
  const la = luminanciaRelativa(componentesRGB(colorA));
  const lb = luminanciaRelativa(componentesRGB(colorB));
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

async function iniciarPartida(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

const RATIO_MINIMO = 4.5;

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
    expect(ratio).toBeGreaterThanOrEqual(RATIO_MINIMO);
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
