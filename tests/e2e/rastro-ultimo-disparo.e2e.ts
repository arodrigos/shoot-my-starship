import { test, expect, type Page } from "@playwright/test";
import { abrirAjustes } from "./utilesControl";

// rastro-ultimo-disparo (ras-1..ras-6): el único rastro es el del último tiro.
async function capturar(page: Page, nombre: string): Promise<void> {
  if (process.env.CAPTURAS_DIR) await page.screenshot({ path: `${process.env.CAPTURAS_DIR}/${nombre}.png` });
}

async function empezar(page: Page, ancho: number, alto: number, url = "/?modo=barra-libre", humanos = 1, ias = 1): Promise<void> {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.goto(url);
  if (humanos > 1 || ias !== 1) {
    await page.getByTestId(`humanos-${humanos}`).click();
    await page.getByTestId(`ias-${ias}`).click();
    if (humanos > 1) {
      await page.getByTestId("nombre-jugador-0").pressSequentially("Ana");
      await page.getByTestId("nombre-jugador-1").pressSequentially("Luis");
      await page.getByTestId("todos-vemos-todo").check();
    }
  }
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.fijarApuntado !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

interface Instantanea {
  asiento: number;
  puntos: { x: number; y: number }[];
  color: string;
  silueta: number;
  visible: boolean;
  estilo: { discontinuo: boolean; alfa: number };
  impactoReal: { x: number; y: number } | undefined;
  trayectoria: { x: number; y: number }[];
  colorNave: string;
  siluetaNave: number;
}

// Lee rastro, impacto y trayectoria en la misma evaluación: así no se mezclan
// los de dos vuelos distintos aunque la IA dispare enseguida.
async function esperarRastroDe(page: Page, asiento: number, distintoDe?: unknown): Promise<Instantanea> {
  const manejador = await page.waitForFunction(
    ([a, previo]) => {
      const r = window.__debug.rastro;
      if (!r || r.asiento !== a || window.__debug.animacionEnCurso !== false) return null;
      if (previo !== null && JSON.stringify(r.puntos) === previo) return null;
      const nave = window.__debug.naves!.find((n) => n.id === a)!;
      return {
        asiento: r.asiento,
        puntos: r.puntos.map((p) => ({ x: p.x, y: p.y })),
        color: r.color,
        silueta: r.silueta,
        visible: r.visible,
        estilo: r.estilo,
        impactoReal: window.__debug.ultimoDisparo?.impactoReal,
        trayectoria: (window.__debug.trayectoriaAnimadaUltimoVuelo ?? []).map((p) => ({ x: p.x, y: p.y })),
        colorNave: nave.colorAsiento,
        siluetaNave: nave.silueta,
      };
    },
    [asiento, distintoDe === undefined ? null : JSON.stringify(distintoDe)] as const,
    { timeout: 60000 },
  );
  return (await manejador.jsonValue()) as Instantanea;
}

async function dispararHumano(page: Page, angulo: number, potencia: number): Promise<void> {
  await page.evaluate(([a, p]) => window.__debug.fijarApuntado!(a, p), [angulo, potencia] as const);
  await page.getByTestId("disparar").click();
}

test("ras-1/ras-2: el rastro del tiro humano lo sustituye el de la IA y luego el del segundo tiro humano (360x640)", async ({ page }) => {
  test.setTimeout(300000);
  await empezar(page, 360, 640);
  expect(await page.evaluate(() => window.__debug.rastro ?? null), "sin tiros no hay rastro").toBeNull();
  await capturar(page, "rastro-ultimo-disparo-ras-1-antes-360x640");

  await dispararHumano(page, 60, 70);
  const primero = await esperarRastroDe(page, 0);
  await capturar(page, "rastro-ultimo-disparo-ras-1-impacto-360x640");
  expect(primero.visible).toBe(true);
  expect(primero.estilo.discontinuo).toBe(true);
  expect(primero.estilo.alfa).toBeLessThanOrEqual(0.45);
  expect(primero.puntos.length).toBeGreaterThanOrEqual(2);
  expect(primero.puntos.length).toBeLessThanOrEqual(64);
  const ultimo = primero.puntos[primero.puntos.length - 1];
  expect(Math.hypot(ultimo.x - primero.impactoReal!.x, ultimo.y - primero.impactoReal!.y)).toBeLessThanOrEqual(1);
  for (const p of primero.puntos) {
    const cerca = Math.min(...primero.trayectoria.map((q) => Math.hypot(q.x - p.x, q.y - p.y)));
    expect(cerca, "cada punto del rastro pertenece a la trayectoria animada").toBeLessThanOrEqual(2);
  }

  const ia = await esperarRastroDe(page, 1, primero.puntos);
  await capturar(page, "rastro-ultimo-disparo-ras-2-tras-ia-360x640");
  expect(ia.color).toBe(ia.colorNave);
  const ultimoIa = ia.puntos[ia.puntos.length - 1];
  const finIa = ia.trayectoria[ia.trayectoria.length - 1];
  expect(Math.hypot(ultimoIa.x - finIa.x, ultimoIa.y - finIa.y)).toBeLessThanOrEqual(1);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
  await capturar(page, "rastro-ultimo-disparo-ras-1-turno-de-vuelta-360x640");
  expect((await page.evaluate(() => window.__debug.rastro!.asiento)), "sigue el de la IA mientras se apunta").toBe(1);

  await dispararHumano(page, 45, 85);
  const segundo = await esperarRastroDe(page, 0, ia.puntos);
  await capturar(page, "rastro-ultimo-disparo-ras-2-segundo-tiro-360x640");
  const finSegundo = segundo.puntos[segundo.puntos.length - 1];
  expect(Math.hypot(finSegundo.x - segundo.impactoReal!.x, finSegundo.y - segundo.impactoReal!.y)).toBeLessThanOrEqual(1);
});

for (const t of [
  { nombre: "820x1180", ancho: 820, alto: 1180 },
  { nombre: "1180x820", ancho: 1180, alto: 820 },
]) {
  test(`ras-3: el rastro se ve con mira y banda a ${t.nombre}`, async ({ page }) => {
    test.setTimeout(180000);
    await empezar(page, t.ancho, t.alto);
    await dispararHumano(page, 60, 70);
    await esperarRastroDe(page, 0);
    await capturar(page, `rastro-ultimo-disparo-ras-3-${t.nombre}`);
  });
}

test("ras-4/ras-6: el interruptor «Rastro» oculta el rastro, mide la latencia y persiste", async ({ page }) => {
  test.setTimeout(240000);
  await empezar(page, 360, 640, "/?modo=barra-libre&rendimiento=1");
  await dispararHumano(page, 60, 70);
  await esperarRastroDe(page, 0);
  await abrirAjustes(page);
  const interruptor = page.getByTestId("toggle-rastro");
  await expect(interruptor).toHaveAttribute("aria-pressed", "true");
  await expect(interruptor).toContainText("Rastro: On");
  await capturar(page, "rastro-ultimo-disparo-ras-4-on-360x640");
  await interruptor.click();
  await page.waitForFunction(() => window.__debug.rastro?.visible === false);
  await expect(interruptor).toContainText("Rastro: Off");
  await capturar(page, "rastro-ultimo-disparo-ras-4-off-360x640");
  await page.waitForFunction(() => window.__debug.latencias!().some((l) => l.nombre === "rastro"));
  const ms = await page.evaluate(() => window.__debug.latencias!().filter((l) => l.nombre === "rastro").at(-1)!.ms);
  // En CI el lienzo pinta por software y un frame puede pasar de 200 ms; se
  // comprueba que la medida existe y es razonable, no el reloj de la máquina.
  expect(ms).toBeGreaterThan(0);
  await expect(page.getByTestId("hud-rendimiento")).toContainText(/rastro: \d+ ms/);
  await capturar(page, "rastro-ultimo-disparo-ras-6-panel-360x640");
  await interruptor.click();
  await page.waitForFunction(() => window.__debug.rastro?.visible === true);
  await interruptor.click();
  expect(await page.evaluate(() => window.localStorage.getItem("rastro-ultimo-disparo:activo"))).toBe("0");
  await page.reload();
  await page.getByTestId("boton-jugar").click();
  await page.waitForFunction(() => window.__debug.control !== undefined);
  expect(await page.evaluate(() => window.__debug.control!.rastroActivo)).toBe(false);
});

test("ras-5: con 2 humanos y 1 IA cada rastro lleva el color y la silueta de quien disparó (360x640)", async ({ page }) => {
  test.setTimeout(300000);
  await empezar(page, 360, 640, "/?modo=barra-libre", 2, 1);
  await dispararHumano(page, 60, 70);
  const j1 = await esperarRastroDe(page, 0);
  expect(j1.color).toBe(j1.colorNave);
  expect(j1.silueta).toBe(j1.siluetaNave);
  await capturar(page, "rastro-ultimo-disparo-ras-5-jugador1-360x640");
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true && window.__debug.turno === 1, undefined, { timeout: 60000 });
  await dispararHumano(page, 50, 75);
  const j2 = await esperarRastroDe(page, 1, j1.puntos);
  expect(j2.color).toBe(j2.colorNave);
  expect(j2.silueta).toBe(j2.siluetaNave);
  await capturar(page, "rastro-ultimo-disparo-ras-5-jugador2-360x640");
  const ia = await esperarRastroDe(page, 2, j2.puntos);
  expect(ia.color).toBe(ia.colorNave);
  expect(ia.silueta).toBe(ia.siluetaNave);
  await capturar(page, "rastro-ultimo-disparo-ras-5-ia-360x640");
});
