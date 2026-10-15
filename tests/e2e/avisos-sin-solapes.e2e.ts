import { test, expect, type Page } from "@playwright/test";
import { abrirAjustes } from "./utilesControl";

// avisos-sin-solapes (avi-1..avi-4): dos avisos nunca ocupan el mismo sitio.
const TAMANOS = [
  { nombre: "360x640", ancho: 360, alto: 640 },
  { nombre: "820x1180", ancho: 820, alto: 1180 },
  { nombre: "1180x820", ancho: 1180, alto: 820 },
] as const;

async function capturar(page: Page, nombre: string): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/${nombre}.png` });
}

async function empezar(page: Page, ancho: number, alto: number, cerrarAyuda: boolean): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto("/?modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.cargarEscenario !== undefined,
  );
  if (cerrarAyuda && (await page.getByTestId("ayuda-cerrar").isVisible())) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

// La nave se coloca pegada al borde superior y dispara en vertical: el tiro
// sale del encuadre en cualquier mundo y tamaño, sin depender de dónde caigan
// los pozos de gravedad de la partida.
async function dispararPorArriba(page: Page): Promise<void> {
  await page.evaluate(() => {
    delete window.__debug.avisoPerdido;
    const mundo = window.__debug.mundo!;
    window.__debug.cargarEscenario!({
      naves: [
        { x: mundo.ancho / 2, y: 60, integridad: 150 },
        { x: mundo.ancho / 2, y: mundo.alto - 60, integridad: 150 },
      ],
      arma: "pepinazo-cortesia",
      anguloGrados: 90,
      potencia: 100,
    });
  });
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.avisoPerdido !== undefined, undefined, { timeout: 150000 });
}

for (const t of TAMANOS) {
  test(`avi-3: «Hay una versión nueva» no tapa el «¡Perdido!» del borde superior a ${t.nombre}`, async ({ page }) => {
    test.setTimeout(180000);
    await empezar(page, t.ancho, t.alto, true);
    await page.evaluate(() => window.__debug.mostrarAvisoPwa!("version"));
    await expect(page.getByTestId("aviso-version-nueva")).toBeVisible();
    await dispararPorArriba(page);
    const medida = await page.evaluate(() => ({
      perdido: window.__debug.avisoPerdido!.css,
      aviso: document.querySelector("[data-testid='aviso-version-nueva']")!.getBoundingClientRect().toJSON() as { bottom: number },
    }));
    await capturar(page, `avisos-sin-solapes-avi-3-${t.nombre}`);
    expect(medida.perdido.y, "el «¡Perdido!» queda por debajo del aviso").toBeGreaterThanOrEqual(medida.aviso.bottom);
    expect(medida.perdido.ancho).toBeGreaterThan(40);
  });
}

test("avi-1: dos tiros perdidos seguidos dejan un único «¡Perdido!» vivo a 360x640", async ({ page }) => {
  test.setTimeout(420000);
  await empezar(page, 360, 640, true);
  for (let tiro = 0; tiro < 2; tiro++) {
    await dispararPorArriba(page);
    expect(await page.evaluate(() => window.__debug.avisosPerdidoVivos), `vivos tras el tiro ${tiro + 1}`).toBe(1);
    if (tiro === 1) await capturar(page, "avisos-sin-solapes-avi-1-doble-360x640");
    // Turno propio otra vez (el rival dispara entre medias). Con el lienzo por
    // software de Actions el vuelo de la IA tarda más de un minuto.
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 150000 });
  }
});

test("avi-2: «Listo para jugar sin conexión» no tapa «Música» en la portada a 360x640", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("inicio-toggle-musica").waitFor();
  await page.waitForFunction(() => window.__debug?.mostrarAvisoPwa !== undefined);
  await page.evaluate(() => window.__debug.mostrarAvisoPwa!("listo"));
  const aviso = page.getByTestId("aviso-listo-sin-conexion");
  await expect(aviso).toBeVisible();
  const musica = page.getByTestId("inicio-toggle-musica");
  const cajaAviso = (await aviso.boundingBox())!;
  const cajaMusica = (await musica.boundingBox())!;
  expect(cajaAviso.y, "el aviso empieza bajo el botón").toBeGreaterThanOrEqual(cajaMusica.y + cajaMusica.height);
  const antes = await musica.getAttribute("aria-pressed");
  await musica.click();
  await expect(aviso).toBeVisible();
  expect(await musica.getAttribute("aria-pressed")).not.toBe(antes);
  await capturar(page, "avisos-sin-solapes-avi-2-portada-360x640");
});

test("avi-4: con la ayuda de apuntado visible, la cabecera del histórico queda por encima y responde", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page, 360, 640, true);
  await expect(page.getByTestId("ayuda-apuntado")).toBeVisible();
  await abrirAjustes(page);
  await page.getByTestId("historico-bromas-toggle").click();
  const cerrar = page.getByTestId("historico-bromas-cerrar");
  await expect(cerrar).toBeVisible();
  const arriba = await cerrar.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const encima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return encima === el || el.contains(encima);
  });
  expect(arriba, "el botón de cerrar es lo que hay en su centro").toBe(true);
  await capturar(page, "avisos-sin-solapes-avi-4-historico-360x640");
  await cerrar.click();
  await expect.poll(() => page.evaluate(() => window.__debug.historico?.abierto)).toBe(false);
});
