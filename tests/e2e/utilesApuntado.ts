import type { Page } from "@playwright/test";

// Posición en pantalla (píxeles CSS) de una nave, medida contra el lienzo
// real: es lo único que el apuntado directo conoce.
export async function posicionPantallaNave(page: Page, id: number): Promise<{ x: number; y: number }> {
  const caja = (await page.locator("#game-container canvas").boundingBox())!;
  const { nave, mundo } = await page.evaluate((idNave) => ({ nave: window.__debug.naves!.find((n) => n.id === idNave)!, mundo: window.__debug.mundo! }), id);
  return { x: caja.x + (nave.x / mundo.ancho) * caja.width, y: caja.y + ((nave.y as number) / mundo.alto) * caja.height };
}

// pantalla-completa: con la consola desplegada (capa sobre el 45 % inferior del
// viewport) los eventos del lienzo bajo ella no llegan. Quien apunta arrastrando
// sobre la nave pliega antes la consola, como haría un jugador.
export async function plegarConsola(page: Page): Promise<void> {
  const boton = page.getByTestId("boton-plegar-consola");
  if ((await boton.getAttribute("aria-expanded")) === "true") await boton.click();
  await page.getByTestId("barra-minima").waitFor();
}

// Fracción del lado menor del viewport a la que la fuerza llegaba a 100 en el
// apuntado de tirachinas. El gesto actual es relativo (apuntado-dedo), así que
// ya no es una regla del producto: se conserva solo para que los e2e que
// apuntan como MEDIO sigan hablando de «dirección y distancia desde la nave».
export const FRACCION_LADO_MENOR_POTENCIA_MAXIMA = 0.4;

// Fija el apuntado en `grados` (0° a la derecha, 90° arriba) y la fuerza que
// correspondería a `distancia` píxeles CSS, por el gancho de prueba y no con
// un gesto: el gesto relativo necesita cientos de píxeles para recorrer un
// giro grande, y estos tests no son sobre el gesto (eso es apuntado-dedo.e2e).
export async function arrastrarDesdeNave(page: Page, _id: number, grados: number, distancia: number): Promise<void> {
  await page.evaluate(
    ({ g, d, fraccion }) => {
      const lado = Math.min(window.innerWidth, window.innerHeight);
      const potencia = Math.max(0, Math.min(100, (d / (fraccion * lado)) * 100));
      window.__debug.fijarApuntado!(((g % 360) + 360) % 360, potencia);
    },
    { g: grados, d: distancia, fraccion: FRACCION_LADO_MENOR_POTENCIA_MAXIMA },
  );
}

// consola-compacta: la consola ocupa el 40 % del ancho y sus controles
// (barras de ángulo y potencia, botones) ya no dejan libres los puntos fijos
// que los tests usaban para el arrastre combinado. Busca un punto de la
// superficie de arrastre que no esté encima de ningún control, como haría un
// dedo que quiere apuntar y no pulsar un botón.
export async function puntoLibreDeArrastre(page: Page): Promise<{ x: number; y: number }> {
  const punto = await page.evaluate(() => {
    const superficie = document.querySelector<HTMLElement>('[data-testid="superficie-arrastre"]');
    if (superficie === null) return null;
    const caja = superficie.getBoundingClientRect();
    const centroX = caja.x + caja.width / 2;
    for (let y = caja.bottom - 6; y > caja.y + 6; y -= 6) {
      for (let desplazamiento = 0; desplazamiento < caja.width / 2 - 6; desplazamiento += 6) {
        for (const signo of [1, -1]) {
          const x = centroX + signo * desplazamiento;
          const elemento = document.elementFromPoint(x, y);
          if (elemento === null || !superficie.contains(elemento)) continue;
          if (elemento.closest('button, [role="slider"], input, select, a') !== null) continue;
          return { x, y };
        }
      }
    }
    return null;
  });
  if (punto === null) throw new Error("No hay ningún punto libre en la superficie de arrastre de la consola");
  return punto;
}
