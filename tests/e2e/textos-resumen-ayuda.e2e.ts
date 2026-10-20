import { test, expect, type Page } from "@playwright/test";
import { MAPA_SEMBRADO } from "./utilesCompra";

// textos-resumen-ayuda (txt-1..txt-4): textos de segunda persona, nombre corto
// del rival, «Gratis» una sola vez y ayuda del gesto, en los tres tamaños.
// Las capturas (CAPTURAS_DIR) son para el juicio visual del gatekeeper.
const TAMANOS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
];

async function captura(page: Page, nombre: string, ancho: number, alto: number): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/textos-resumen-ayuda-${nombre}-${ancho}x${alto}.png` });
}

for (const { ancho, alto } of TAMANOS) {
  test(`txt-1..4: textos, ficha y ayuda del gesto a ${ancho}x${alto}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto(`/?mapa=${MAPA_SEMBRADO}&modo=presupuesto&saldo=60`);
    await page.getByTestId("rival-almirante-bisagra").click();
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.publicarResumenPrueba !== undefined);
    // La ayuda del gesto espera a que se cierre la inicial: no se pisan.
    await expect(page.getByTestId("ayuda-inicial")).toBeVisible();
    await expect(page.getByTestId("ayuda-apuntado")).toHaveCount(0);
    await captura(page, "ayuda-inicial-sola", ancho, alto);
    await page.getByTestId("ayuda-cerrar").click();
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });

    // txt-4: primera partida con almacenamiento limpio.
    const ayuda = page.getByTestId("ayuda-apuntado");
    await expect(ayuda).toContainText("dedo");
    await expect(ayuda).toContainText("Gira");
    await captura(page, "ayuda-gesto", ancho, alto);

    // txt-1 y txt-2: el resumen del generador real y el rótulo del desplazamiento.
    await page.getByTestId("ayuda-apuntado-cerrar").click();
    await page.evaluate(() => window.__debug.publicarResumenPrueba!("desplazado-por-bisagra"));
    const resumen = (await page.getByTestId("resumen-texto").textContent()) ?? "";
    const rotulo = (await page.getByTestId("fantasma-0").textContent()) ?? "";
    const ultimo = await page.evaluate(() => window.__debug.historialBromas!.at(-1)!.resumen);
    expect(resumen).toContain("Te desplazaron");
    expect(rotulo).toContain("Te desplazaron");
    expect(ultimo).toBe(resumen);
    for (const texto of [resumen, rotulo]) {
      expect(texto).not.toContain("Tú fue");
      expect(texto).not.toContain("…");
    }
    expect(resumen).toContain("Bisagra");
    expect(resumen).not.toContain("Almirante Bis");
    await captura(page, "resumen-segunda-persona", ancho, alto);

    // txt-3: la ficha de Zanjadora dice «Gratis» una sola vez.
    await page.getByTestId("selector-arma-abrir").click();
    const gratis = ["precio-zanjadora-manolita", "gratis-reducida-zanjadora-manolita", "gratis-evento-zanjadora-manolita"];
    const textoFicha = (await Promise.all(gratis.map((id) => page.getByTestId(id).textContent()))).join("");
    expect(textoFicha.match(/Gratis/g)).toHaveLength(1);
    await captura(page, "ficha-zanjadora", ancho, alto);
  });
}
