import { test, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __contadorAudioContext?: number;
  }
}

async function contarAudioContext(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__contadorAudioContext = 0;
    const Original = window.AudioContext;
    // Una subclase conserva el comportamiento real y solo añade la cuenta.
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        window.__contadorAudioContext = (window.__contadorAudioContext ?? 0) + 1;
      }
    };
  });
}

async function jugar(page: Page): Promise<void> {
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.musica !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

const notas = (page: Page): Promise<number> => page.evaluate(() => window.__debug.musica!().notasProgramadas);

// mus-1 (camino crítico): sin gesto no hay AudioContext; Jugar la pone a
// sonar; su control la para sin tocar los efectos; la elección sobrevive a
// recargar. Se sondea el estado real, nunca un sleep que cruce los dedos.
test("mus-1: la música espera al gesto, suena con Jugar, se para con su control y se recuerda", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await contarAudioContext(page);
  await page.goto("/");
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => window.__contadorAudioContext)).toBe(0);

  await jugar(page);
  await expect
    .poll(() => page.evaluate(() => window.__debug.musica!().estado), { timeout: 10000, intervals: [50, 100] })
    .toBe("sonando");
  const base = await notas(page);
  await expect.poll(() => notas(page), { timeout: 10000, intervals: [50, 100] }).toBeGreaterThanOrEqual(base + 4);

  const boton = page.getByTestId("toggle-musica");
  await expect(boton).toHaveAttribute("aria-pressed", "true");
  const efectosAntes = await page.evaluate(() => window.__debug.audio!().silenciado);
  await boton.click();
  await expect(boton).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.__debug.musica!().estado)).toBe("parada");
  const trasParar = await notas(page);
  // Con la música parada el reloj sigue avanzando: si no se programa nada en
  // 1 s de reloj de audio, el programador está de verdad detenido.
  await page.waitForTimeout(1000);
  expect(await notas(page)).toBe(trasParar);
  expect(await page.evaluate(() => window.__debug.audio!().silenciado)).toBe(efectosAntes);
  expect(await page.evaluate(() => localStorage.getItem("banda-sonora:activada"))).toBe("0");

  await page.reload();
  await jugar(page);
  expect(await page.evaluate(() => window.__debug.musica!().estado)).toBe("parada");
  await expect(page.getByTestId("toggle-musica")).toHaveAttribute("aria-pressed", "false");
});

test("mus-1 límite: un valor corrupto cuenta como activada y no hay errores en la consola", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addInitScript(() => localStorage.setItem("banda-sonora:activada", "basura"));
  await page.goto("/");
  await jugar(page);
  await expect
    .poll(() => page.evaluate(() => window.__debug.musica!().estado), { timeout: 10000, intervals: [50, 100] })
    .toBe("sonando");
  await expect(page.getByTestId("toggle-musica")).toHaveAttribute("aria-pressed", "true");
  expect(errores).toEqual([]);
});

test("mus-1 límite: con la música desactivada los efectos se registran y la música no programa notas", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addInitScript(() => localStorage.setItem("banda-sonora:activada", "0"));
  await page.goto("/?mapa=calma-de-los-restos");
  await jugar(page);
  await page.getByTestId("toggle-silenciado").click();
  await page.evaluate(() => window.__debug.dispararEventoRoce!(1, 200, 300));
  const historial = await page.evaluate(() => window.__debug.audio!().historial);
  expect(historial[historial.length - 1]?.id).toBe("roce");
  expect(await notas(page)).toBe(0);
});

test("mus-1 límite: con la pestaña oculta el AudioContext se suspende", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await jugar(page);
  await page.waitForFunction(() => window.__debug.estadoAudio!() === "en-marcha");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => window.__debug.estadoAudio!() === "suspendido");
});
