import type { Page } from "@playwright/test";

// Palabras que el navegador parte en dos líneas dentro de `selector` (un
// scrollWidth ≤ clientWidth no lo detecta: overflow-wrap parte a mitad de
// palabra sin desbordar). Cada palabra se mide con su propio Range.
export async function palabrasPartidas(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const partidas: string[] = [];
    for (const raiz of Array.from(document.querySelectorAll(sel))) {
      const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
      for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
        const texto = nodo.textContent ?? "";
        for (const m of texto.matchAll(/\S+/g)) {
          const rango = document.createRange();
          rango.setStart(nodo, m.index ?? 0);
          rango.setEnd(nodo, (m.index ?? 0) + m[0].length);
          const lineas = new Set(Array.from(rango.getClientRects()).map((r) => Math.round(r.top)));
          if (lineas.size > 1) partidas.push(m[0]);
        }
      }
    }
    return partidas;
  }, selector);
}
