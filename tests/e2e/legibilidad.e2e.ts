import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { wcagContrast, parse, formatHex } from "culori";
import { comprobarContrasteHud } from "../utils/axeHud";
import { palabrasPartidas } from "../utils/palabrasPartidas";

// P2 (contraste-y-tamano): ct-1, ct-2, ct-4, ct-6. Se juega por la portada real
// en el mapa sembrado de siempre.
const MAPA_SEMBRADO = "calma-de-los-restos";

async function empezar(page: Page, humanos: number, ias: number, reloj?: 30): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId(`humanos-${humanos}`).click();
  await page.getByTestId(`ias-${ias}`).click();
  if (humanos > 1) {
    await page.getByTestId("nombre-jugador-0").pressSequentially("Ana");
    await page.getByTestId("nombre-jugador-1").pressSequentially("Luis");
  }
  if (reloj) await page.getByTestId(`reloj-${reloj}`).click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.mundo !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
}

async function finDePartida(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__debug.forzarFinDePartida !== undefined);
  await page.evaluate(() => window.__debug.forzarFinDePartida!());
  await page.waitForFunction(() => window.__debug.parteDeGuerra != null, undefined, { timeout: 60000 });
  await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
}

function hex(css: string): string {
  const c = parse(css);
  if (!c) throw new Error(`color no reconocido: ${css}`);
  return formatHex(c);
}

async function tamanosMinimos(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((raiz) => {
    const tamanos: number[] = [];
    const recorrer = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let n = recorrer.nextNode(); n; n = recorrer.nextNode()) {
      const el = n.parentElement;
      if (!el || !(n.textContent ?? "").trim() || el.closest('[aria-hidden="true"]')) continue;
      const caja = el.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) continue;
      tamanos.push(parseFloat(getComputedStyle(el).fontSize));
    }
    return tamanos.length ? Math.min(...tamanos) : 99;
  });
}

for (const esquema of ["dark", "light"] as const) {
  test(`ct-1/ct-6: parte de 4 asientos a 360x640 (${esquema}): botón legible, fijo y sin solapes`, async ({ page }) => {
    test.setTimeout(240000);
    await page.emulateMedia({ colorScheme: esquema });
    await empezar(page, 1, 3);
    await finDePartida(page);
    await page.getByTestId("ver-numeros").click();
    const boton = page.getByTestId("otra-partida");
    const colores = await boton.evaluate((el) => ({ texto: getComputedStyle(el).color, fondo: getComputedStyle(el).backgroundColor }));
    expect(wcagContrast(hex(colores.texto), hex(colores.fondo))).toBeGreaterThanOrEqual(4.5);

    const medir = async () =>
      page.evaluate(() => {
        const caja = (el: Element) => el.getBoundingClientRect();
        const tarjetas = Array.from(document.querySelectorAll('[data-testid^="premio-asiento-"]')).filter((e) =>
          /^premio-asiento-\d+$/.test(e.getAttribute("data-testid") ?? ""),
        );
        const cajas = tarjetas.map(caja);
        const b = caja(document.querySelector('[data-testid="otra-partida"]')!);
        const cruza = (a: DOMRect, c: DOMRect) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
        let intersecciones = 0;
        cajas.forEach((a, i) => {
          if (cruza(a, b)) intersecciones++;
          cajas.slice(i + 1).forEach((c) => cruza(a, c) && intersecciones++);
        });
        const tabla = document.querySelector('[data-testid="tabla-numeros"]')!;
        // El panel (con overflow-y) también debe caber a lo ancho: lo que la
        // tabla desborda por la derecha queda recortado por él.
        const panel = document.querySelector('[data-testid="parte-de-guerra"] > div')!;
        const celdas = Array.from(tabla.querySelectorAll("th, td")).filter((c) => c.scrollWidth > c.clientWidth).length;
        return {
          tarjetas: tarjetas.length,
          intersecciones,
          desbordan: tarjetas.filter((t) => t.scrollWidth > t.clientWidth).length + (tabla.scrollWidth > tabla.clientWidth ? 1 : 0) + (panel.scrollWidth > panel.clientWidth ? 1 : 0) + celdas,
          botonTop: b.top,
          botonBottom: b.bottom,
          scrollY: window.scrollY,
        };
      });
    mkdirSync("capturas", { recursive: true });
    const arriba = await medir();
    expect(arriba.tarjetas).toBe(4);
    expect(arriba.intersecciones).toBe(0);
    expect(arriba.desbordan).toBe(0);
    expect(await palabrasPartidas(page, '[data-testid="parte-de-guerra"]'), "palabras partidas a mitad").toEqual([]);
    expect(arriba.botonTop).toBeGreaterThanOrEqual(0);
    expect(arriba.botonBottom).toBeLessThanOrEqual(640);
    await page.screenshot({ path: `capturas/contraste-y-tamano-3-parte-arriba-${esquema}-360x640.png` });

    // El contenido se desplaza dentro del panel; el botón sigue fijo al pie.
    await page.getByTestId("tabla-numeros").evaluate((el) => el.scrollIntoView({ block: "end" }));
    const abajo = await medir();
    expect(abajo.intersecciones).toBe(0);
    expect(abajo.desbordan).toBe(0);
    expect(abajo.botonBottom).toBeLessThanOrEqual(640);
    await page.screenshot({ path: `capturas/contraste-y-tamano-3-parte-abajo-${esquema}-360x640.png` });

    // Con la CPU a un sexto, el parte tiene que irse en el propio clic y no
    // esperar a que Phaser genere el mundo nuevo.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await boton.click();
    await expect(page.getByTestId("parte-de-guerra")).toHaveCount(0, { timeout: 1000 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await page.waitForFunction(() => window.__debug.numeroTurno === 0);
  });
}

for (const esquema of ["dark", "light"] as const) {
  test(`ct-2/ct-4: axe sin violaciones ni incomplete y letra ≥ 14 px en el HUD (${esquema})`, async ({ page }) => {
    test.setTimeout(300000);
    await page.emulateMedia({ colorScheme: esquema });
    await empezar(page, 2, 1, 30);
    const fallos: string[] = [];
    const pasar = async (nombre: string, selectores: string[]) => {
      const r = await comprobarContrasteHud(page, selectores);
      if (r.violaciones + r.incompletos > 0) fallos.push(`${nombre}: ${r.detalle.join(" | ")}`);
    };

    // Con la pantalla de relevo visible (si la hay en este orden de turnos).
    if (await page.getByTestId("pantalla-relevo").isVisible()) {
      await pasar("relevo", ['[data-testid="pantalla-relevo"]']);
      expect(await tamanosMinimos(page, '[data-testid="pantalla-relevo"]')).toBeGreaterThanOrEqual(14);
      await page.getByTestId("relevo-confirmar").click();
    }
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });

    await page.getByTestId("boton-ajustes").click();
    await pasar("ajustes", ['[data-testid="panel-ajustes"]']);
    expect(await tamanosMinimos(page, '[data-testid="panel-ajustes"]')).toBeGreaterThanOrEqual(14);
    await page.getByTestId("cerrar-ajustes").click();

    await pasar("consola", ['[data-testid="consola"]']);
    expect(await tamanosMinimos(page, '[data-testid="consola"]')).toBeGreaterThanOrEqual(14);

    // La ayuda de apuntado (con su ✕, un <button> que no hereda la letra) solo
    // existe mientras se puede disparar: se mide antes de agotar el reloj.
    await expect(page.getByTestId("ayuda-apuntado")).toBeVisible();
    await pasar("ayuda-apuntado", ['[data-testid="ayuda-apuntado"]']);
    expect(await tamanosMinimos(page, '[data-testid="ayuda-apuntado"]')).toBeGreaterThanOrEqual(14);
    expect(
      await page.getByTestId("ayuda-apuntado-cerrar").evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(14);

    await page.evaluate(() => window.__debug.adelantarRelojTurno!(30000));
    await expect(page.getByTestId("aviso-tiempo-agotado")).toBeVisible();
    await pasar("avisos", ['[data-testid="capa-avisos"]']);
    expect(await tamanosMinimos(page, '[data-testid="capa-avisos"]')).toBeGreaterThanOrEqual(14);

    await finDePartida(page);
    await page.getByTestId("ver-numeros").click();
    await pasar("parte", ['[data-testid="parte-de-guerra"]']);
    expect(await tamanosMinimos(page, '[data-testid="parte-de-guerra"]')).toBeGreaterThanOrEqual(14);
    // Desplazado hasta abajo, axe marca "parcialmente tapado" lo que sale del
    // panel: se centra cada tarjeta antes de medir para que decida el contraste.
    const tarjetas = page.getByTestId(/^premio-asiento-\d+$/);
    const n = await tarjetas.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await tarjetas.nth(i).evaluate((el) => el.scrollIntoView({ block: "center" }));
      const id = await tarjetas.nth(i).getAttribute("data-testid");
      await pasar(`parte-desplazado-${i}`, [`[data-testid="${id}"]`]);
    }
    mkdirSync("capturas", { recursive: true });
    await page.screenshot({ path: `capturas/contraste-y-tamano-3-numeros-${esquema}-360x640.png` });
    expect(fallos, fallos.join("\n")).toEqual([]);
  });
}
