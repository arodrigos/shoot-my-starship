import { test, expect, type Page } from "@playwright/test";

async function empezar(page: Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/?eventos=1&modo=barra-libre");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined && window.__debug.fijarObjetos !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true && window.__debug.animacionEnCurso === false, undefined, { timeout: 60000 });
}

// obj-1 (camino crítico): el corazón flota con la gravedad real del mapa, enseña
// su ruta y, si choca con la nave 0, le devuelve 50 de vida y desaparece.
test("corazón: ruta punteada, choca con la nave 0 y le devuelve 50 de vida", async ({ page }) => {
  test.setTimeout(300000);
  await empezar(page);

  // Se busca un corazón cuya ruta completa de la ventana quede libre de
  // planetas y del borde (así no acaba antes de tiempo) y se coloca la nave 0
  // sobre un punto de esa ruta: el casco queda cruzado por la ruta que dibuja
  // el propio juego, sea cual sea el mapa y su gravedad.
  const montado = await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    window.__debug.forzarIntegridad!(0, 30);
    for (let fila = 1; fila <= 6; fila++) {
      for (let velocidad = 60; velocidad <= 140; velocidad += 20) {
        window.__debug.fijarObjetos!([{ tipo: "corazon", x: 40, y: (mundo.alto * fila) / 8, vx: velocidad, vy: 0 }]);
        const ruta = window.__debug.objetos![0].rutaPrevista;
        if (ruta.length < 181) continue;
        const punto = ruta[120];
        window.__debug.forzarPosicionNave!(0, punto.x, punto.y);
        // Con la nave ya en su sitio, el pronóstico se recalcula desde el estado.
        window.__debug.fijarObjetos!([{ tipo: "corazon", x: 40, y: (mundo.alto * fila) / 8, vx: velocidad, vy: 0 }]);
        const nueva = window.__debug.objetos![0].rutaPrevista;
        const ultimo = nueva[nueva.length - 1];
        if (nueva.length >= 10 && Math.hypot(ultimo.x - punto.x, ultimo.y - punto.y) <= 22) return { puntos: nueva.length };
      }
    }
    return null;
  });
  expect(montado, "ningún corazón de prueba tiene una ruta libre que cruce la nave 0").not.toBeNull();
  expect(montado!.puntos).toBeGreaterThanOrEqual(10);

  await expect(page.getByTestId("objeto-corazon")).toBeVisible();
  const caja = (await page.getByTestId("objeto-corazon").boundingBox())!;
  expect(caja.height).toBeGreaterThanOrEqual(16);
  const icono = (await page.getByTestId("objeto-corazon-icono").boundingBox())!;
  expect(icono.width).toBeGreaterThanOrEqual(16);

  // El humano dispara; al cierre del turno el corazón vuela su ventana y toca el casco.
  await page.getByTestId("disparar").click();
  const manejador = await page.waitForFunction(() => window.__debug.ultimosEventos?.find((evento) => evento.tipo === "objeto-alcanza") ?? false, undefined, { timeout: 200000 });
  const alcance = await manejador.jsonValue();
  expect(alcance).toMatchObject({ tipo: "objeto-alcanza", objeto: "corazon", nave: 0, cambio: 50 });
  expect(await page.evaluate(() => window.__debug.objetos)).toEqual([]);
  await expect(page.getByTestId("resultado-turno")).toContainText("¡Corazón galáctico!");
  await expect(page.getByTestId("objeto-corazon")).toHaveCount(0);
});

// obj-3: la tormenta se ve como otra forma (nube con rayo), con su leyenda.
test("tormenta: leyenda visible y distinta del corazón", async ({ page }) => {
  test.setTimeout(120000);
  await empezar(page);
  await page.evaluate(() => window.__debug.fijarObjetos!([{ tipo: "tormenta", x: 40, y: 100, vx: 80, vy: 0 }, { tipo: "corazon", x: 700, y: 100, vx: -80, vy: 0 }]));
  for (const id of ["objeto-tormenta", "objeto-corazon"]) {
    const caja = (await page.getByTestId(id).boundingBox())!;
    expect(caja.height).toBeGreaterThanOrEqual(16);
  }
  await expect(page.getByTestId("objeto-tormenta-icono")).toBeVisible();
  await expect(page.getByTestId("objeto-corazon-icono")).toBeVisible();
});
