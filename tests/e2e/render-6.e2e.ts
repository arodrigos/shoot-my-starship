import { test, expect } from "@playwright/test";

// render-6: la magnitud y el sentido que dibuja el indicador de deriva
// tienen que corresponder a mundo.deriva de verdad (no a un adorno fijo) en
// los tres mapas del catálogo -- uno con deriva negativa, uno en calma y uno
// con deriva positiva -- y la etiqueta debe distinguir al menos dos de los
// tres.
const MAPAS = [
  { id: "desguace-del-ecuador", derivaEsperada: -18 },
  { id: "calma-de-los-restos", derivaEsperada: 0 },
  { id: "corriente-de-estribor", derivaEsperada: 26 },
];

test("el indicador de deriva corresponde a mundo.deriva en los tres mapas", async ({ page }) => {
  const lecturas: { id: string; deriva: { valorMundo: number; etiqueta: string; sentido: -1 | 0 | 1; longitudFlechaPx: number } }[] = [];

  for (const mapa of MAPAS) {
    await page.goto(`/?mapa=${mapa.id}`);
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.deriva !== undefined);

    const deriva = await page.evaluate(() => window.__debug.deriva!);
    lecturas.push({ id: mapa.id, deriva });

    expect(deriva.valorMundo).toBe(mapa.derivaEsperada);
    expect(deriva.etiqueta.length).toBeGreaterThan(0);

    const sentidoEsperado = mapa.derivaEsperada > 0 ? 1 : mapa.derivaEsperada < 0 ? -1 : 0;
    expect(deriva.sentido).toBe(sentidoEsperado);

    if (sentidoEsperado === 0) {
      expect(deriva.longitudFlechaPx).toBe(0);
    } else {
      expect(deriva.longitudFlechaPx).toBeGreaterThan(0);
    }
  }

  const etiquetasUnicas = new Set(lecturas.map((lectura) => lectura.deriva.etiqueta));
  expect(etiquetasUnicas.size).toBeGreaterThanOrEqual(2);
});
