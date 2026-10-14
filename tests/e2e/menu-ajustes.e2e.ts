import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { abrirAjustes } from "./utilesControl";

// ma-1..ma-8: los cinco interruptores viven tras un único botón ⚙ fuera de la
// consola (#199). Todo se mide sobre una partida real.
const VIEWPORTS = [
  { nombre: "360x640", ancho: 360, alto: 640 },
  { nombre: "820x1180", ancho: 820, alto: 1180 },
  { nombre: "1180x820", ancho: 1180, alto: 820 },
];
const INTERRUPTORES = ["toggle-sacudida", "toggle-silenciado", "toggle-musica", "toggle-voz", "historico-bromas-toggle"];

// Solo para dejar evidencia visual al gatekeeper; el CI no define la variable.
async function capturar(page: Page, nombre: string): Promise<void> {
  const carpeta = process.env.CAPTURAS_DIR;
  if (carpeta !== undefined) await page.screenshot({ path: `${carpeta}/${nombre}.png` });
}

async function entrar(page: Page, ancho: number, alto: number, ruta = "/"): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto(ruta);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
}

for (const vp of VIEWPORTS) {
  test(`ma-1: con el menú cerrado solo se ve el botón Ajustes (${vp.nombre})`, async ({ page }) => {
    await entrar(page, vp.ancho, vp.alto);
    const caja = (await page.getByTestId("boton-ajustes").boundingBox())!;
    expect(caja.width).toBeGreaterThanOrEqual(48);
    expect(caja.height).toBeGreaterThanOrEqual(48);
    expect(vp.ancho - (caja.x + caja.width)).toBeLessThanOrEqual(16);
    for (const id of INTERRUPTORES) {
      expect(await page.getByTestId(id).isVisible(), id).toBe(false);
    }
    // Ningún elemento visible con testid de los avisos ni de la cuenta atrás toca el botón.
    const solapes = await page.evaluate((c) => {
      const sel = '[data-testid="capa-avisos"] [data-testid], [data-testid="panel-cuenta-atras"]';
      return Array.from(document.querySelectorAll(sel))
        .map((el) => ({ id: el.getAttribute("data-testid"), r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0)
        .filter(({ r }) => r.left < c.x + c.width && r.right > c.x && r.top < c.y + c.height && r.bottom > c.y)
        .map(({ id }) => id);
    }, caja);
    expect(solapes).toEqual([]);
    await capturar(page, `menu-ajustes-1-cerrado-${vp.nombre}`);
  });
}

test("ma-2 / ma-8: el panel abre con los cinco controles, ayuda visible y efectos reales", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page, 360, 640);
  await page.getByTestId("boton-ajustes").click();
  await expect(page.getByTestId("boton-ajustes")).toHaveAttribute("aria-expanded", "true");
  const panel = page.getByTestId("panel-ajustes");
  await expect(panel).toBeVisible();

  const ayudas: Record<string, string> = {
    "toggle-sacudida": "Mueve la pantalla en los impactos",
    "toggle-silenciado": "Efectos de sonido del juego",
    "toggle-musica": "Banda sonora",
    "toggle-voz": "Lee los chistes en voz alta",
    "historico-bromas-toggle": "Mensajes de la partida",
  };
  for (const id of INTERRUPTORES) {
    const boton = page.getByTestId(id);
    await expect(boton).toBeVisible();
    expect((await boton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await boton.getAttribute("title")).not.toBeNull();
    const ayuda = await boton.evaluate((el) => document.getElementById(el.getAttribute("aria-describedby")!)?.textContent);
    expect(ayuda, id).toBe(ayudas[id]);
  }
  await capturar(page, "menu-ajustes-2-abierto-360x640");

  // El panel cabe en pantalla o se alcanza con su propio scroll.
  const cabe = await panel.evaluate((el) => el.getBoundingClientRect().bottom <= window.innerHeight);
  expect(cabe).toBe(true);

  const sonido = page.getByTestId("toggle-silenciado");
  const antes = await page.evaluate(() => window.__debug.audio!().silenciado);
  await sonido.click();
  await expect(sonido).toHaveText(antes ? "Sonido: On" : "Sonido: Off");
  expect(await page.evaluate(() => window.__debug.audio!().silenciado)).toBe(!antes);
  await sonido.click();
  expect(await page.evaluate(() => window.__debug.audio!().silenciado)).toBe(antes);

  const musica = page.getByTestId("toggle-musica");
  await expect(musica).toHaveAttribute("aria-pressed", "true");
  await musica.click();
  await expect(musica).toHaveText("Música: No");
  expect(await page.evaluate(() => window.__debug.musica!().estado)).toBe("parada");

  const sacudidaAntes = await page.evaluate(() => window.__debug.control!.sacudidaActiva);
  await page.getByTestId("toggle-sacudida").click();
  await page.waitForFunction((v) => window.__debug.control!.sacudidaActiva !== v, sacudidaAntes);
});

test("ma-3: las preferencias guardadas se leen tal cual y el menú arranca cerrado", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    if (sessionStorage.getItem("sembrado") === null) {
      sessionStorage.setItem("sembrado", "1");
      localStorage.setItem("realce-impacto:sacudida-activa", "0");
      localStorage.setItem("banda-sonora:activada", "0");
    }
  });
  await entrar(page, 360, 640);
  await abrirAjustes(page);
  await expect(page.getByTestId("toggle-sacudida")).toHaveText("Sacudida: Off");
  await expect(page.getByTestId("toggle-musica")).toHaveText("Música: No");
  const clavesAntes = await page.evaluate(() => Object.keys(localStorage).sort());

  await page.getByTestId("toggle-silenciado").click();
  await page.reload();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await expect(page.getByTestId("boton-ajustes")).toHaveAttribute("aria-expanded", "false");
  await abrirAjustes(page);
  await expect(page.getByTestId("toggle-silenciado")).toHaveText("Sonido: On");
  await expect(page.getByTestId("toggle-sacudida")).toHaveText("Sacudida: Off");
  await expect(page.getByTestId("toggle-musica")).toHaveText("Música: No");
  const clavesDespues = await page.evaluate(() => Object.keys(localStorage).sort());
  for (const clave of clavesDespues) {
    expect(clave).not.toMatch(/ajustes|menu|rotulo/i);
  }
  // La única clave nueva es la del sonido, que el propio clic acaba de escribir.
  expect(clavesDespues.filter((c) => !clavesAntes.includes(c)).every((c) => c === "sonido-procedimental:silenciado")).toBe(true);
});

test("ma-4: Ajustes y Sonido funcionan con la consola mínima, oculta y durante el vuelo", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page, 360, 640);
  const conmutarSonido = async (): Promise<void> => {
    const antes = await page.evaluate(() => window.__debug.audio!().silenciado);
    await abrirAjustes(page);
    await page.getByTestId("toggle-silenciado").click();
    expect(await page.evaluate(() => window.__debug.audio!().silenciado)).toBe(!antes);
    await page.getByTestId("cerrar-ajustes").click();
    await expect(page.getByTestId("panel-ajustes")).toBeHidden();
  };

  await page.getByTestId("boton-plegar-consola").click();
  await expect(page.getByTestId("consola")).toHaveAttribute("data-estado", "minima");
  await conmutarSonido();
  await capturar(page, "menu-ajustes-4-consola-minima-360x640");

  await page.getByTestId("boton-plegar-consola").click();
  await page.getByTestId("boton-ocultar-consola").click();
  await expect(page.getByTestId("consola")).toHaveAttribute("data-estado", "oculta");
  await conmutarSonido();
  await capturar(page, "menu-ajustes-4-consola-oculta-360x640");

  await page.getByTestId("pestana-consola").click();
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === false);
  await conmutarSonido();
  await capturar(page, "menu-ajustes-4-vuelo-360x640");
});

test("ma-5: el aviso de voz vive en el panel, bajo Voz, y no en la capa de avisos", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page, 360, 640);
  await expect(page.getByTestId("capa-avisos").getByTestId("voz-aviso")).toHaveCount(0);
  await abrirAjustes(page);
  const aviso = page.getByTestId("voz-aviso");
  await expect(aviso).toBeVisible();
  await expect(page.getByTestId("panel-ajustes").getByTestId("voz-aviso")).toHaveCount(1);
  await expect(page.getByTestId("toggle-voz")).toBeDisabled();
  const cajaAviso = (await aviso.boundingBox())!;
  const cajaVoz = (await page.getByTestId("toggle-voz").boundingBox())!;
  expect(cajaAviso.y).toBeGreaterThanOrEqual(cajaVoz.y + cajaVoz.height);
  await capturar(page, "menu-ajustes-5-aviso-voz-360x640");
});

test("ma-6: se cierra con el botón, Cerrar y Escape, y solo al disparar; tocar el lienzo no lo cierra; axe limpio", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page, 360, 640);
  const boton = page.getByTestId("boton-ajustes");
  const panel = page.getByTestId("panel-ajustes");
  const cerradoYEnfocado = async (): Promise<void> => {
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe("boton-ajustes");
  };

  await boton.click();
  await boton.click();
  await cerradoYEnfocado();

  await boton.click();
  await page.getByTestId("cerrar-ajustes").click();
  await cerradoYEnfocado();

  await boton.click();
  await page.keyboard.press("Escape");
  await cerradoYEnfocado();

  await boton.click();
  const graves = (await new AxeBuilder({ page }).include('[data-testid="panel-ajustes"]').analyze()).violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(graves.map((v) => v.id)).toEqual([]);

  // Un toque sobre el lienzo (zona libre, lejos del panel) no cierra el menú.
  await page.mouse.click(40, 300);
  await expect(panel).toBeVisible();

  await page.getByTestId("disparar").click();
  await expect(panel).toBeHidden();
});

test("ma-7: Histórico muestra el contador, cierra el panel y abre la hoja", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page, 360, 640);
  await abrirAjustes(page);
  await expect(page.getByTestId("historico-bromas-toggle")).toHaveText(/^Histórico/);
  await page.getByTestId("historico-bromas-toggle").click();
  await expect(page.getByTestId("panel-ajustes")).toBeHidden();
  await expect(page.getByTestId("historico-bromas")).toBeVisible();
  expect(await page.evaluate(() => window.__debug.historico!.abierto)).toBe(true);
  await expect(page.getByTestId("historico-bromas-vacio")).toBeVisible();
  await capturar(page, "menu-ajustes-7-historico-360x640");
});
