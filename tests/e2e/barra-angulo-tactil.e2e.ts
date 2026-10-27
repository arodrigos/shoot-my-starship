import { test, expect, type CDPSession, type Page } from "@playwright/test";
import { anguloDesdeFraccionControl } from "@/juego/control/apuntado";

// Bug 11: en el móvil, arrastrar la barra de ángulo cambiaba la potencia. Todos
// los gestos son toques reales por CDP (no page.mouse), a 360x640.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 640 } });

type Caja = { x: number; y: number; width: number; height: number };

async function toque(cdp: CDPSession, tipo: "touchStart" | "touchMove" | "touchEnd", x: number, y: number): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", { type: tipo, touchPoints: tipo === "touchEnd" ? [] : [{ x, y, id: 0 }] });
}

async function gesto(cdp: CDPSession, desde: { x: number; y: number }, hasta: { x: number; y: number }, pasos = 10): Promise<void> {
  await toque(cdp, "touchStart", desde.x, desde.y);
  for (let i = 1; i <= pasos; i++) {
    await toque(cdp, "touchMove", desde.x + ((hasta.x - desde.x) * i) / pasos, desde.y + ((hasta.y - desde.y) * i) / pasos);
  }
  await toque(cdp, "touchEnd", hasta.x, hasta.y);
}

const caja = async (page: Page, id: string): Promise<Caja> => (await page.getByTestId(id).boundingBox())!;
const ajuste = (page: Page) => page.evaluate(() => ({ angulo: window.__debug.control!.ajuste.anguloGrados, potencia: window.__debug.control!.ajuste.potencia }));

async function empezar(page: Page, textoGrande: boolean): Promise<CDPSession> {
  if (textoGrande) await page.addInitScript(() => localStorage.setItem("legibilidad:texto-grande", "1"));
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  return page.context().newCDPSession(page);
}

// Sube la potencia a un valor conocido que no sea el de arranque.
async function dejarEn50(page: Page, cdp: CDPSession): Promise<void> {
  const b = await caja(page, "barra-potencia");
  const y = b.y + b.height / 2;
  await gesto(cdp, { x: b.x + 2, y }, { x: b.x + b.width * 0.5, y }, 4);
  await page.waitForFunction(() => Math.abs(window.__debug.control!.ajuste.potencia - 50) < 3);
}

const objetivoAngulo = anguloDesdeFraccionControl(0.75);
const cercaDe = (valor: number, esperado: number) => Math.abs(valor - esperado) <= 4;

for (const textoGrande of [false, true]) {
  const sufijo = textoGrande ? " con «Texto grande»" : "";

  test(`ang-1${sufijo}: deslizar en horizontal sobre la barra de ángulo mueve el ángulo y no la potencia`, async ({ page }) => {
    test.setTimeout(120000);
    const cdp = await empezar(page, textoGrande);
    await dejarEn50(page, cdp);
    const antes = await ajuste(page);
    const b = await caja(page, "barra-angulo");
    const y = b.y + b.height / 2;
    const sufijoCaptura = textoGrande ? "texto-grande" : "normal";
    const recorteFila = async (id: string): Promise<Buffer> => {
      const c = await caja(page, id);
      return page.screenshot({ clip: c });
    };
    const potenciaAntesImg = await recorteFila("control-potencia");
    await page.screenshot({ path: `capturas/barra-angulo-tactil-2-ang-5-antes-${sufijoCaptura}.png` });
    await toque(cdp, "touchStart", b.x + b.width * 0.1, y);
    for (let i = 1; i <= 10; i++) {
      await toque(cdp, "touchMove", b.x + b.width * (0.1 + 0.065 * i), y);
      expect((await ajuste(page)).potencia, `paso ${i}`).toBe(antes.potencia);
    }
    await toque(cdp, "touchEnd", b.x + b.width * 0.75, y);
    const despues = await ajuste(page);
    expect(cercaDe(despues.angulo, objetivoAngulo)).toBe(true);
    expect(despues.potencia).toBe(antes.potencia);
    await expect(page.getByTestId("valor-potencia")).toHaveText("50%");
    // ang-5: la barra de potencia queda idéntica píxel a píxel y la de ángulo cambia.
    await page.screenshot({ path: `capturas/barra-angulo-tactil-2-ang-5-despues-${sufijoCaptura}.png` });
    expect((await recorteFila("control-potencia")).equals(potenciaAntesImg)).toBe(true);
  });

  test(`ang-1b${sufijo}: de derecha a izquierda y en diagonal saliendo de la barra`, async ({ page }) => {
    test.setTimeout(120000);
    const cdp = await empezar(page, textoGrande);
    await dejarEn50(page, cdp);
    const b = await caja(page, "barra-angulo");
    const y = b.y + b.height / 2;
    await gesto(cdp, { x: b.x + b.width * 0.9, y }, { x: b.x + b.width * 0.05, y });
    expect(cercaDe((await ajuste(page)).angulo, anguloDesdeFraccionControl(0.05))).toBe(true);
    expect((await ajuste(page)).potencia).toBe(50);

    await gesto(cdp, { x: b.x + b.width * 0.2, y }, { x: b.x + b.width * 0.75, y: y - 30 });
    const d = await ajuste(page);
    expect(cercaDe(d.angulo, objetivoAngulo)).toBe(true);
    expect(d.potencia).toBe(50);
  });

  test(`ang-2${sufijo}: el dedo apoya en el borde de la barra o sobre su retículo`, async ({ page }) => {
    test.setTimeout(120000);
    const cdp = await empezar(page, textoGrande);
    await dejarEn50(page, cdp);
    const b = await caja(page, "barra-angulo");
    const r = await caja(page, "reticulo");
    const inicios = [
      { nombre: "borde superior", x: b.x + b.width * 0.1, y: b.y + 2 },
      { nombre: "borde inferior", x: b.x + b.width * 0.1, y: b.y + b.height - 2 },
      { nombre: "reticulo", x: r.x + r.width / 2, y: r.y + r.height / 2 },
    ];
    for (const inicio of inicios) {
      await gesto(cdp, { x: inicio.x, y: inicio.y }, { x: b.x + b.width * 0.75, y: inicio.y });
      const a = await ajuste(page);
      expect(cercaDe(a.angulo, objetivoAngulo), inicio.nombre).toBe(true);
      expect(a.potencia, inicio.nombre).toBe(50);
      await gesto(cdp, { x: b.x + b.width * 0.5, y: b.y + b.height / 2 }, { x: b.x + b.width * 0.1, y: b.y + b.height / 2 }, 3);
    }
  });

  test(`ang-3${sufijo}: un gesto que empieza en la fila del ángulo no toca la potencia y viceversa`, async ({ page }) => {
    test.setTimeout(120000);
    const cdp = await empezar(page, textoGrande);
    await dejarEn50(page, cdp);
    const fila = await caja(page, "control-angulo");
    const menos = await caja(page, "paso-angulo-menos");
    const b = await caja(page, "barra-angulo");
    const antes = await ajuste(page);
    // Empieza en el botón -0.1° y cruza la barra.
    await gesto(cdp, { x: menos.x + menos.width / 2, y: menos.y + menos.height / 2 }, { x: b.x + b.width * 0.8, y: b.y + b.height / 2 });
    // Empieza en el hueco de la fila (entre botón y barra) y en su margen vertical.
    await gesto(cdp, { x: b.x - 2, y: b.y + b.height / 2 }, { x: b.x + b.width * 0.6, y: fila.y + fila.height / 2 - 6 });
    const a = await ajuste(page);
    expect(a.potencia).toBe(antes.potencia);

    const p = await caja(page, "barra-potencia");
    const anguloAntes = (await ajuste(page)).angulo;
    await gesto(cdp, { x: p.x + p.width * 0.2, y: p.y + p.height / 2 }, { x: p.x + p.width * 0.8, y: p.y + p.height / 2 });
    const c = await ajuste(page);
    expect(c.angulo).toBe(anguloAntes);
    expect(Math.abs(c.potencia - 80)).toBeLessThanOrEqual(4);
  });
}
