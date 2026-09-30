import { test, expect } from "@playwright/test";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

const MUNDO_ANCHO = 1920;
const MUNDO_ALTO = 1080;

const TESTIDS_HUD_OPACO = [
  "resultado-turno",
  "reticulo",
  "paso-angulo-mas",
  "paso-angulo-menos",
  "selector-arma-abrir",
  "repetir-disparo",
  "disparar",
];

// pyl-3 (camino_critico): un representante por cada una de las ocho
// familias visuales, confirmado contra familiaVisualDe en pyl-1/pyl-2 (no
// elegido a ojo aquí) -- si el catálogo cambiara de armas, ese test unitario
// fallaría antes de que este e2e mintiera sobre qué familia dispara.
const REPRESENTANTE_POR_FAMILIA: Record<string, string> = {
  bomba: "pepinazo-cortesia",
  capsula: "mortero-lamentable",
  racimo: "racimo-de-tuppers",
  chatarra: "pelota-de-chatarra",
  orbe: "graviton-segunda-mano",
  flecha: "andanada-de-flechas",
  broca: "barrena-planetaria",
  haz: "rayo-laser",
};

for (const [familia, armaId] of Object.entries(REPRESENTANTE_POR_FAMILIA)) {
  test(`pyl-3: familia "${familia}" (${armaId}) -- vuelo visible >=90% y turno cerrado con resultado declarado`, async ({
    page,
  }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/?mapa=calma-de-los-restos");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
    if (await page.getByTestId("ayuda-cerrar").isVisible()) {
      await page.getByTestId("ayuda-cerrar").click();
    }

    await page.getByTestId("selector-arma-abrir").click();
    await page.getByTestId(`arma-${armaId}`).click();
    await page.waitForFunction((id) => window.__debug.control!.ajuste.armaId === id, armaId);
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);

    async function arrastrarHasta(anguloObjetivo: number, potenciaObjetivo: number): Promise<void> {
      const ajusteAntes = (await page.evaluate(() => window.__debug.control!.ajuste))!;
      const deltaY = -(anguloObjetivo - ajusteAntes.anguloGrados) / GANANCIA_ANGULO_GRADOS;
      const deltaX = (potenciaObjetivo - ajusteAntes.potencia) / GANANCIA_POTENCIA;

      const inicio = { x: 160, y: 560 };
      const fin = { x: inicio.x + deltaX * 360, y: inicio.y + deltaY * 640 };
      await page.mouse.move(inicio.x, inicio.y);
      await page.mouse.down();
      await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
      await page.mouse.move(fin.x, fin.y, { steps: 5 });
      await page.mouse.up();
    }

    // Mismo arco bajo-y-potente que proy-5, deliberadamente reutilizado: se
    // mantiene dentro del campo de batalla para las ocho armas, incluida la
    // instantánea (Rayo Láser), que recorre el mismo arco con gravedad
    // forzada a 0 -- sigue teniendo un vuelo multi-fotograma muestreable
    // (AnimadorProyectil no distingue instantáneo de parabólico).
    await arrastrarHasta(18, 90);

    const rectanguloLienzo = await page.evaluate(() => {
      const lienzo = document.querySelector("#game-container canvas") as HTMLCanvasElement;
      const r = lienzo.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const rectangulosHud = await page.evaluate((testids) => {
      return testids
        .map((id) => document.querySelector(`[data-testid="${id}"]`))
        .filter((el): el is Element => el !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        });
    }, TESTIDS_HUD_OPACO);

    function mundoAPantalla(x: number, y: number): { x: number; y: number } {
      return {
        x: rectanguloLienzo.left + (x / MUNDO_ANCHO) * rectanguloLienzo.width,
        y: rectanguloLienzo.top + (y / MUNDO_ALTO) * rectanguloLienzo.height,
      };
    }

    function dentroDelLienzo(punto: { x: number; y: number }): boolean {
      return (
        punto.x >= rectanguloLienzo.left &&
        punto.x <= rectanguloLienzo.left + rectanguloLienzo.width &&
        punto.y >= rectanguloLienzo.top &&
        punto.y <= rectanguloLienzo.top + rectanguloLienzo.height
      );
    }

    function tapadoPorHud(punto: { x: number; y: number }): boolean {
      return rectangulosHud.some(
        (r) => punto.x >= r.left && punto.x <= r.right && punto.y >= r.top && punto.y <= r.bottom,
      );
    }

    const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
    await page.getByTestId("disparar").click();

    // Mismo evaluate() único por muestra que proy-5 (issue diagnosticado en
    // desarrollo-18): leer animacionEnCurso/numeroTurno/proyectilEnVuelo por
    // separado no es atómico y puede colar una muestra del disparo rival.
    const muestras: { visible: boolean; armaId: string }[] = [];
    let capturado = false;
    for (;;) {
      const instante = await page.evaluate((n) => {
        const enCurso = window.__debug.animacionEnCurso === true && (window.__debug.numeroTurno ?? 0) === n;
        return { enCurso, punto: enCurso ? window.__debug.proyectilEnVuelo : null };
      }, numeroTurnoAntes);
      if (!instante.enCurso) break;
      const punto = instante.punto;
      if (punto) {
        const pantalla = mundoAPantalla(punto.x, punto.y);
        const dentro = dentroDelLienzo(pantalla);
        const tapado = tapadoPorHud(pantalla);
        muestras.push({ visible: dentro && !tapado, armaId: punto.armaId });
        if (!capturado) {
          await page.screenshot({ path: `capturas/proyectiles-siluetas-9-pyl3-vuelo-${familia}.png` });
          capturado = true;
        }
      }
      await page.waitForTimeout(30);
    }

    expect(muestras.length).toBeGreaterThan(2);
    expect(muestras.every((m) => m.armaId === armaId)).toBe(true);

    const visibles = muestras.filter((m) => m.visible).length;
    expect(visibles / muestras.length).toBeGreaterThanOrEqual(0.9);

    // Punta a punta (pyl-3): el turno avanza y hay un resultado declarado --
    // no basta con que el proyectil se viera, el disparo tiene que cerrar de
    // verdad.
    await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoAntes, { timeout: 60000 });
    await expect(page.getByTestId("resultado-turno")).toBeVisible();
  });
}
