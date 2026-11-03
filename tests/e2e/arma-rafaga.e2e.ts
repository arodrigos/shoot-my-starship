import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// arma-rafaga: raf-2. Se juega por la portada real, en el mapa sembrado de
// siempre, con el escenario fijado para que el rival quede fuera de tiro.
const MAPA_SEMBRADO = "calma-de-los-restos";
const TAMANOS = [
  { w: 360, h: 640 },
  { w: 820, h: 1180 },
  { w: 1180, h: 820 },
];

async function empezar(page: Page, tam: { w: number; h: number }): Promise<void> {
  await page.setViewportSize({ width: tam.w, height: tam.h });
  await page.goto(`/?mapa=${MAPA_SEMBRADO}`);
  await page.getByTestId("humanos-1").click();
  await page.getByTestId("ias-1").click();
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  mkdirSync("capturas", { recursive: true });
  await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    window.__debug.cargarEscenario!({
      naves: [
        { x: 120, y: mundo.alto / 2, integridad: 150 },
        { x: mundo.ancho - 120, y: mundo.alto / 2, integridad: 150 },
      ],
      arma: "hipo-triple",
      anguloGrados: 50,
      potencia: 75,
    });
  });
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
}

for (const t of TAMANOS) {
  test(`raf-2: tres proyectiles seguidos y tres explosiones, con la fase en «vuelo» entre medias (${t.w}x${t.h})`, async ({ page }) => {
    test.setTimeout(240000);
    await empezar(page, t);
    const previas = await page.evaluate(() => window.__debug.registroDetonaciones?.length ?? 0);
    await page.evaluate(() => {
      // Muestreo de la fase cada 50 ms: entre el primer y el tercer impacto no puede salir de «vuelo».
      const w = window as unknown as { __fases: string[] };
      w.__fases = [];
      // Por reloj y no por fotograma: el render por software de CI da pocos fotogramas.
      setInterval(() => w.__fases.push(`${Math.round(performance.now())}:${window.__debug.velocidadPresentacion!().fase}`), 50);
    });
    await page.getByTestId("disparar").click();
    await page.waitForFunction(() => window.__debug.velocidadPresentacion!().fase === "vuelo", undefined, { timeout: 60000, polling: "raf" });
    // Una captura por tercio del vuelo secuencial: la explosión de cada impacto se ve en el siguiente.
    for (let i = 1; i <= 3; i++) {
      await page.waitForTimeout(900);
      await page.screenshot({ path: `capturas/arma-rafaga-11-impacto-${i}-${t.w}x${t.h}.png` });
    }
    await page.waitForFunction(
      (n) => (window.__debug.registroDetonaciones ?? []).length > n,
      previas,
      { timeout: 60000, polling: "raf" },
    );
    const registro = await page.evaluate((n) => (window.__debug.registroDetonaciones ?? []).slice(n)[0], previas);
    expect(registro).toMatchObject({ armaId: "hipo-triple", cantidad: 3 });
    const fases = await page.evaluate(() => (window as unknown as { __fases: string[] }).__fases);
    const primera = fases.findIndex((f) => f.endsWith(":vuelo"));
    expect(primera).toBeGreaterThanOrEqual(0);
    // El primer tramo seguido en «vuelo» es el del disparo humano (la IA responde después, con su propio vuelo):
    // si saliera de «vuelo» tras el 1.º o el 2.º impacto, el tramo acabaría antes de la última explosión.
    let fin = primera;
    while (fin < fases.length && fases[fin].endsWith(":vuelo")) fin++;
    // En CI el reloj va a tirones (render por software): se mide en milisegundos y no en muestras.
    const ms = (i: number): number => Number(fases[i].split(":")[0]);
    expect(ms(fin - 1) - ms(primera)).toBeGreaterThan(1500);
    await page.screenshot({ path: `capturas/arma-rafaga-11-final-${t.w}x${t.h}.png` });
  });
}

test("raf-2: con ×3 tras tocar «⏩» en el 2.º vuelo, el factor sigue en 3 durante el 3.º", async ({ page }) => {
  test.setTimeout(240000);
  await empezar(page, TAMANOS[0]);
  await page.getByTestId("disparar").click();
  await page.waitForFunction(() => window.__debug.velocidadPresentacion!().fase === "vuelo", undefined, { timeout: 60000, polling: "raf" });
  await page.waitForTimeout(1200);
  await page.getByTestId("boton-acelerar").click();
  expect(await page.evaluate(() => window.__debug.velocidadPresentacion!().factor)).toBe(3);
  // Mientras dure el vuelo (hasta el impacto del tercero) el factor no puede bajar.
  const factores = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const vistos: number[] = [];
        const paso = (): void => {
          const v = window.__debug.velocidadPresentacion!();
          if (v.fase !== "vuelo") return resolve(vistos);
          vistos.push(v.factor);
          requestAnimationFrame(paso);
        };
        paso();
      }),
  );
  expect(factores.length).toBeGreaterThan(0);
  expect(factores.every((f) => f === 3)).toBe(true);
});
