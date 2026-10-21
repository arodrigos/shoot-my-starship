import { test, expect } from "@playwright/test";
import { arrastrarDesdeNave } from "./utilesApuntado";

// colocacion-etiquetas: un disparo a quemarropa (rival pegado justo debajo del
// tirador) saca a la vez los números de daño y el «Estaba aquí» casi en el
// mismo punto. Mientras conviven, ninguna etiqueta pisa a otra ni se sale de
// la pantalla, en las tres pantallas del encargo.
for (const pantalla of [
  { width: 360, height: 640 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
]) {
  test(`etiquetas a quemarropa sin solapes en ${pantalla.width}x${pantalla.height}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize(pantalla);
    await page.goto("/");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
    if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();

    const colocado = await page.evaluate(() => {
      const mundo = window.__debug.mundo!;
      const planetas = window.__debug.planetas ?? [];
      const yTirador = 0.3 * mundo.alto;
      const yRival = yTirador + 70;
      const despejada = (x: number): boolean => {
        for (let y = yTirador - 40; y <= yRival + 40; y += 10) {
          if (window.__debug.terreno!.esSolido(Math.round(x), Math.round(y))) return false;
          for (const planeta of planetas) if (Math.hypot(x - planeta.cx, y - planeta.cy) < planeta.radio + 60) return false;
        }
        return true;
      };
      for (let dx = 0; dx <= mundo.ancho * 0.4; dx += 10) {
        for (const x of dx === 0 ? [mundo.ancho / 2] : [mundo.ancho / 2 + dx, mundo.ancho / 2 - dx]) {
          if (!despejada(x)) continue;
          window.__debug.forzarPosicionNave!(0, x, yTirador);
          window.__debug.forzarPosicionNave!(1, x, yRival);
          return true;
        }
      }
      return false;
    });
    expect(colocado, "no hay columna despejada para el disparo a quemarropa").toBe(true);

    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
    await arrastrarDesdeNave(page, 0, 270, 40);
    await page.getByTestId("disparar").click();

    // En este entorno el número de daño del disparo real ya se ha fundido
    // cuando sale el «Estaba aquí» (la sacudida tarda más que en un móvil),
    // así que, nada más salir la marca, se lanzan por el gancho de impacto
    // real el -23 y el -50 del caso a quemarropa justo encima de ella: pasan
    // por el mismo mostrarNumeroDanio que un turno de verdad.
    await page.waitForFunction(() => (window.__debug.etiquetasImpacto ?? []).some((e) => e.tipo === "estaba-aqui"), undefined, { timeout: 60000 });
    // Se lanza un muestreo por fotograma de 300 ms en la página y, mientras
    // corre, la captura (que va pronto porque los números se funden en 900 ms).
    await page.evaluate(() => {
      const marca = window.__debug.etiquetasImpacto!.find((e) => e.tipo === "estaba-aqui")!;
      const x = marca.x + marca.ancho / 2;
      const y = marca.y + marca.alto;
      window.__debug.dispararEventoImpactoReal!(1, x, y, 23);
      window.__debug.dispararEventoImpactoReal!(1, x + 2, y - 2, 50);
      const resultado = { maxVivas: 0, fallos: [] as string[], terminado: false };
      (window as unknown as { muestreoEtiquetas: typeof resultado }).muestreoEtiquetas = resultado;
      const inicio = performance.now();
      const muestrear = (): void => {
        const vivas = window.__debug.etiquetasImpacto ?? [];
        resultado.maxVivas = Math.max(resultado.maxVivas, vivas.length);
        for (const [i, a] of vivas.entries()) {
          const c = a.css;
          if (c.x < -0.5 || c.y < -0.5 || c.x + c.ancho > window.innerWidth + 0.5 || c.y + c.alto > window.innerHeight + 0.5) resultado.fallos.push(`fuera: ${JSON.stringify(c)}`);
          for (const b of vivas.slice(i + 1)) {
            const d = b.css;
            if (c.x < d.x + d.ancho && d.x < c.x + c.ancho && c.y < d.y + d.alto && d.y < c.y + c.alto) resultado.fallos.push(`solape: ${JSON.stringify(c)} / ${JSON.stringify(d)}`);
          }
        }
        if (performance.now() - inicio > 300) resultado.terminado = true;
        else requestAnimationFrame(muestrear);
      };
      muestrear();
    });
    if (process.env.RUTA_CAPTURA) await page.screenshot({ path: `${process.env.RUTA_CAPTURA}-${pantalla.width}x${pantalla.height}.png` });
    await page.waitForFunction(() => (window as unknown as { muestreoEtiquetas: { terminado: boolean } }).muestreoEtiquetas.terminado);
    const resultado = await page.evaluate(() => (window as unknown as { muestreoEtiquetas: { maxVivas: number; fallos: string[] } }).muestreoEtiquetas);
    expect(resultado.fallos).toEqual([]);
    expect(resultado.maxVivas, "los dos números y el «Estaba aquí» llegan a verse a la vez").toBeGreaterThanOrEqual(3);
  });
}
