import { test } from "@playwright/test";
for (const [w, h] of [[820, 1180], [1180, 820]]) {
test(`sonda ${w}`, async ({ page }) => {
  test.setTimeout(200000);
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`/?modo=barra-libre`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.cargarEscenario !== undefined && window.__debug.zonasCamara !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("ayuda-apuntado-cerrar").click();
  await page.evaluate(() => {
    const m = window.__debug.mundo!;
    window.__debug.cargarEscenario!({ naves: [{ x: m.ancho * 0.3, y: m.alto * 0.1, integridad: 150 }, { x: m.ancho * 0.7, y: m.alto * 0.1, integridad: 150 }], arma: "pepinazo-cortesia", anguloGrados: 45, potencia: 50, conservarAyuda: true });
  });
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.waitForFunction(() => window.__debug.zonasCamara!().valido === true, undefined, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__debug.publicarResumenPrueba!("desplazado-por-bisagra"));
  const medir = () => page.evaluate(() => {
    const f = (e: Element | null) => { if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
    const capa = q("capa-avisos")!;
    return { capa: f(capa), anclaje: capa.getAttribute("data-anclaje"), sin: capa.hasAttribute("data-sin-toques"), hijos: Array.from(capa.children).map((c) => [c.getAttribute("data-testid"), f(c)]), consola: f(q("consola")), est: q("consola")?.getAttribute("data-estado"), oc: q("consola")?.getAttribute("data-oculta"), naves: window.__debug.zonasCamara!().objetivos.map((o) => [Math.round(o.css.x), Math.round(o.css.y), Math.round(o.css.x + o.css.ancho), Math.round(o.css.y + o.css.alto)]) };
  });
  const a = await medir();
  await page.waitForTimeout(1500);
  const b = await medir();
  throw new Error("SONDA " + w + " " + JSON.stringify([a, b]));
});
}
