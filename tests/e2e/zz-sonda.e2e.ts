import { test } from "@playwright/test";
for (const [w, h] of [[360, 640], [1180, 820]]) {
test(`sonda ${w}`, async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`/?modo=barra-libre`);
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.publicarResumenPrueba !== undefined && window.__debug.zonasCamara !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.__debug.publicarResumenPrueba!("desplazado-por-bisagra"));
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const f = (e: Element | null) => { if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
    const capa = q("capa-avisos")!;
    return { capa: f(capa), anclaje: capa.getAttribute("data-anclaje"), sin: capa.hasAttribute("data-sin-toques"), hijos: Array.from(capa.children).map((c) => [c.getAttribute("data-testid"), f(c), getComputedStyle(c).opacity]), panel: f(q("panel-bromas")), texto: f(q("resumen-texto")), consola: f(q("consola")), z: window.__debug.zonasCamara!().objetivos.map((o) => o.css), ayudaApuntado: !!q("ayuda-apuntado") };
  });
  throw new Error("SONDA " + w + " " + JSON.stringify(r));
});
}
