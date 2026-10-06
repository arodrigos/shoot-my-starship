import { test, expect } from "@playwright/test";
import { ESCOMBRO } from "@/sim/terreno/mascara";

async function entrarAPartidaEspacial(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  // Sin "?mapa=": es la rama del hito espacial (render-espacio), la única
  // con material escombro real en la máscara (los mapas de suelo plano solo
  // conocen SOLIDO) -- ver Partida.ts y el comentario de esp-1.e2e.ts.
  //
  // ia-punteria (corrección): la semilla de producción (20260926) ya no
  // sirve de referencia fija a 360x640 -- colocarNaves (impacto-naves)
  // ahora exige tiro viable EN LAS DOS DIRECCIONES (fix de ia-punteria-6) y
  // con esa semilla la colocación original deja de ser válida, cae al
  // escalón de regeneración y el sistema regenerado no tiene cinturón de
  // escombro. La semilla 4 sí coloca las naves en el primer escalón
  // (recolocación) y conserva escombro real, comprobado por fuerza bruta
  // con colocarNaves fuera de test.
  await page.goto("/?semilla=4");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.modoEspacial === true);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }
}

// crt-1 (camino_critico): tres impactos deterministas en el mismo planeta
// (aplicarHuella, igual que terreno-6/realce-impacto: apuntar a mano no es
// reproducible) dejan un borde quemado que se distingue de la roca intacta
// por tipo Y por color, y el escombro del cinturón se distingue del planeta
// -- con capturas antes/después para el juicio visual del gatekeeper, tal
// y como pide la verificación del criterio.
test("crt-1: tras tres impactos reales el cráter se distingue de la roca intacta, y el escombro nunca se confunde con un planeta", async ({
  page,
}) => {
  await entrarAPartidaEspacial(page);

  const planetas = (await page.evaluate(() => window.__debug.planetas))!;
  expect(planetas.length).toBeGreaterThan(0);
  // pantalla-completa: el mundo es mayor y hay más planetas; los desplazamientos
  // de abajo (hasta 28 px) piden uno grande para que el cráter quede en roca.
  const planeta = planetas.reduce((mayor, actual) => (actual.radio > mayor.radio ? actual : mayor));
  expect(planeta.radio).toBeGreaterThan(75);

  // Punto de referencia bien dentro del planeta (en su centro), lejos de
  // cualquier impacto: roca intacta, antes y después.
  const centro = { x: Math.round(planeta.cx), y: Math.round(planeta.cy) };
  expect(await page.evaluate((p) => window.__debug.terreno!.clasificarVisual(p.x, p.y), centro)).toBe("roca");

  await page.screenshot({ path: "capturas/crateres-y-escombros-29-antes.png" });

  // Zona de impacto: al 60% del radio desde el centro, con margen de sobra
  // hasta el borde real del planeta (105px de radio en este sistema) para
  // que el cráter quede rodeado de roca por todos lados, no del vacío del
  // espacio.
  const base = { x: Math.round(planeta.cx + planeta.radio * 0.6), y: Math.round(planeta.cy) };
  await page.evaluate((p) => window.__debug.terreno!.aplicarHuella(p.x, p.y, 25, "restar"), base);
  await page.evaluate((p) => window.__debug.terreno!.aplicarHuella(p.x + 10, p.y + 10, 20, "restar"), base);
  await page.evaluate((p) => window.__debug.terreno!.aplicarHuella(p.x - 8, p.y - 14, 18, "restar"), base);

  await page.screenshot({ path: "capturas/crateres-y-escombros-29-despues.png" });

  // El centro del planeta, lejos de los tres impactos, sigue siendo roca
  // intacta: el bloque no reclasifica terreno que ningún impacto ha tocado.
  expect(await page.evaluate((p) => window.__debug.terreno!.clasificarVisual(p.x, p.y), centro)).toBe("roca");

  // Justo fuera del radio del primer impacto (25px desde "base"), dentro de
  // la banda de borde quemado declarada: ni roca intacta ni aire, un tipo
  // propio que delata el daño de un vistazo. 28px (comprobado contra la
  // misma clasificarPixelVisual que usa el renderizador, aplicando los tres
  // mismos impactos sobre esta semilla por defecto) cae fuera de los tres
  // cráteres solapados pero dentro de la banda de 3px de borde del más
  // cercano.
  const borde = { x: base.x + 28, y: base.y };
  const tipoBorde = await page.evaluate((p) => window.__debug.terreno!.clasificarVisual(p.x, p.y), borde);
  expect(tipoBorde).toBe("borde-quemado");

  // El interior del cráter (el propio punto de impacto) es aire, no un tipo
  // "dañado" sólido.
  expect(await page.evaluate((p) => window.__debug.terreno!.clasificarVisual(p.x, p.y), base)).toBe("aire");

  // Lo que de verdad ve el jugador: el color ya pintado en el lienzo para el
  // borde quemado tiene que ser distinto del de la roca intacta de
  // referencia -- no basta con que la clasificación lógica difiera, tiene
  // que notarse en el píxel real (una sola lectura de canvas, mismo patrón
  // que comprobarPuntos).
  const [colorCentro, colorBorde] = await page.evaluate(
    (puntos) => window.__debug.terreno!.leerColores(puntos),
    [centro, borde],
  );
  const distanciaColor =
    Math.abs(colorCentro.r - colorBorde.r) + Math.abs(colorCentro.g - colorBorde.g) + Math.abs(colorCentro.b - colorBorde.b);
  expect(distanciaColor).toBeGreaterThan(10);

  // El escombro del cinturón (material 255, generado de fábrica, no creado
  // por este bloque) nunca se confunde con un planeta: ni en la
  // clasificación lógica ni en el color real pintado.
  const puntoEscombro = await page.evaluate(
    (material) => window.__debug.terreno!.buscarPixelDeMaterial(material),
    ESCOMBRO,
  );
  expect(puntoEscombro).not.toBeNull();
  const tipoEscombro = await page.evaluate((p) => window.__debug.terreno!.clasificarVisual(p.x, p.y), puntoEscombro!);
  expect(tipoEscombro).toBe("escombro");

  const [colorEscombro, colorRoca] = await page.evaluate(
    (puntos) => window.__debug.terreno!.leerColores(puntos),
    [puntoEscombro!, centro],
  );
  const distanciaEscombroRoca =
    Math.abs(colorEscombro.r - colorRoca.r) + Math.abs(colorEscombro.g - colorRoca.g) + Math.abs(colorEscombro.b - colorRoca.b);
  expect(distanciaEscombroRoca).toBeGreaterThan(10);
});
