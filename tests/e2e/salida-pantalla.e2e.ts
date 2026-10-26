import { test, expect, type Page } from "@playwright/test";
import { arrastrarDesdeNave } from "./utilesApuntado";

// salida-pantalla (sal-1, sal-2): un tiro casi vertical a potencia máxima sale
// por arriba. Debe perderse al cruzar el margen del borde, mostrar «¡Perdido!»
// y pasar el turno enseguida, sin segundos de pantalla quieta.
async function empezar(page: Page, reducido: boolean): Promise<void> {
  await page.emulateMedia({ reducedMotion: reducido ? "reduce" : "no-preference" });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.rendimiento !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// El aviso vive en el lienzo, así que __debug no basta (un texto de 3 px CSS
// también publicaba su rectángulo). Se pasa a px CSS, se exige tamaño legible
// y dentro del viewport, nada del DOM encima, y píxeles dorados (#ffd166)
// leídos del propio lienzo (preserveDrawingBuffer), que es más rápido que una
// captura y cabe en los 1,2 s que dura el aviso.
async function comprobarAvisoVisible(page: Page, reducido: boolean): Promise<void> {
  const medida = await page.evaluate(() => {
    const aviso = window.__debug.avisoPerdido!;
    const lienzo = document.querySelector<HTMLCanvasElement>("#game-container canvas")!;
    const caja = lienzo.getBoundingClientRect();
    // El rectángulo en px CSS ya incluye el zoom y el desplazamiento de la
    // cámara: con la vista alejada, mundo y pantalla no se corresponden 1 a 1.
    const rect = { x: aviso.css.x, y: aviso.css.y, w: aviso.css.ancho, h: aviso.css.alto };
    const encima = document.elementFromPoint(rect.x + rect.w / 2, rect.y + rect.h / 2);
    const pxPorCss = lienzo.width / caja.width;
    const copia = document.createElement("canvas");
    copia.width = Math.max(1, Math.round(rect.w * pxPorCss));
    copia.height = Math.max(1, Math.round(rect.h * pxPorCss));
    const ctx = copia.getContext("2d")!;
    ctx.drawImage(lienzo, (rect.x - caja.left) * pxPorCss, (rect.y - caja.top) * pxPorCss, copia.width, copia.height, 0, 0, copia.width, copia.height);
    const datos = ctx.getImageData(0, 0, copia.width, copia.height).data;
    let dorados = 0;
    for (let i = 0; i < datos.length; i += 4) {
      if (Math.abs(datos[i]! - 0xff) < 40 && Math.abs(datos[i + 1]! - 0xd1) < 40 && Math.abs(datos[i + 2]! - 0x66) < 60) dorados++;
    }
    return { rect, viewport: { w: window.innerWidth, h: window.innerHeight }, encima: encima?.tagName ?? null, dorados };
  });
  // La captura es para quien revise el aviso a ojo; solo se guarda si el
  // entorno lo pide, para no ensuciar el repo.
  if (process.env.CAPTURAS_DIR) {
    await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/salida-pantalla-59-perdido-arriba-360x640${reducido ? "-reducido" : ""}.png` });
  }
  expect(medida.rect.h, "alto del aviso en px CSS").toBeGreaterThanOrEqual(16);
  expect(medida.rect.w, "ancho del aviso en px CSS").toBeGreaterThanOrEqual(60);
  expect(medida.rect.x).toBeGreaterThanOrEqual(0);
  expect(medida.rect.y).toBeGreaterThanOrEqual(0);
  expect(medida.rect.x + medida.rect.w).toBeLessThanOrEqual(medida.viewport.w);
  expect(medida.rect.y + medida.rect.h).toBeLessThanOrEqual(medida.viewport.h);
  expect(medida.encima, "nada del DOM tapa el aviso").toBe("CANVAS");
  // El texto a 22 px CSS deja miles de píxeles dorados (medido: ~6000 y ~4500
  // con movimiento reducido); bajo 150 el aviso no se lee, p. ej. si el zoom
  // de la cámara dejara de compensarse.
  expect(medida.dorados, "píxeles #ffd166 del texto en el lienzo").toBeGreaterThan(150);
}

async function dispararHaciaArriba(page: Page, reducido: boolean): Promise<number> {
  // Se mira cuándo se publica el número de turno con un setter, no con un
  // sondeo: el sondeo heredaría el coste de cada fotograma del lienzo en el CI.
  await page.evaluate(() => {
    const depuracion = window.__debug as unknown as Record<string, unknown>;
    let valor = depuracion.numeroTurno;
    Object.defineProperty(depuracion, "numeroTurno", {
      configurable: true,
      get: () => valor,
      set: (nuevo) => {
        if (nuevo !== valor) (window as unknown as { __tTurno?: number }).__tTurno = performance.now();
        valor = nuevo;
      },
    });
  });
  const turnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await arrastrarDesdeNave(page, 0, 90, 220);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.avisoPerdido !== undefined, undefined, { timeout: 60000 });
  // El aviso nace al llegar la respuesta del trabajador, entre dos frames: hasta
  // que Phaser pinta uno más el lienzo aún no lo tiene y su lectura sale vacía.
  await page.evaluate(() => new Promise<void>((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo()))));
  await comprobarAvisoVisible(page, reducido);
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, turnoAntes, { timeout: 30000 });
  return turnoAntes;
}

for (const reducido of [false, true]) {
  test(`sal-2: un tiro que sale por arriba se pierde y el turno pasa enseguida (movimiento reducido: ${reducido})`, async ({ page }) => {
    test.setTimeout(180000);
    await empezar(page, reducido);
    await dispararHaciaArriba(page, reducido);

    const medida = await page.evaluate(() => {
      const marca = [...window.__debug.rendimiento!.marcas].reverse().find((m) => m.nombre === "salida");
      return {
        tSalida: marca?.t ?? null,
        tTurno: (window as unknown as { __tTurno?: number }).__tTurno ?? null,
        aviso: window.__debug.avisoPerdido!,
        detonaciones: window.__debug.detonaciones?.length ?? 0,
        explosiones: (window.__debug.efectosVisibles ?? []).filter((e) => e.tipo === "explosion").length,
      };
    });
    expect(medida.tSalida, "la marca «salida» existe").not.toBeNull();
    expect(medida.tTurno, "se publicó el cambio de turno").not.toBeNull();
    // El resultado del turno se aplica de golpe: marca y turno van juntos.
    expect(Math.abs(medida.tTurno! - medida.tSalida!)).toBeLessThanOrEqual(500);
    expect(medida.aviso.borde).toBe("arriba");
    expect(medida.detonaciones).toBe(0);
    expect(medida.explosiones).toBe(0);
  });
}
