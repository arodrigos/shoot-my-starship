import { test, expect, type Page } from "@playwright/test";

// premios-parte (pp-1..pp-4): la pantalla final con una tarjeta por asiento.
// Cuatro humanos con nombres ficticios; el final se fuerza con el gancho del
// juego para no depender de que alguien gane por puntería.
const VIEWPORTS = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
];
const NOMBRE_LARGO = "0123456789ABCDEF";

async function empezarCuatro(page: Page): Promise<void> {
  await page.goto("/?muerte=1&modo=barra-libre");
  await page.getByTestId("humanos-4").click();
  await page.getByTestId("nombre-jugador-0").pressSequentially("Ana");
  await page.getByTestId("nombre-jugador-1").pressSequentially("Luis");
  await page.getByTestId("nombre-jugador-2").pressSequentially(NOMBRE_LARGO);
  await page.getByTestId("nombre-jugador-3").pressSequentially("Eva");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(
    () => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.forzarFinDePartida !== undefined,
  );
  if (await page.getByTestId("ayuda-cerrar").isVisible()) await page.getByTestId("ayuda-cerrar").click();
  await page.waitForFunction(
    () => window.__debug.control!.puedeDisparar === true || document.querySelector('[data-testid="relevo-confirmar"]') !== null,
    undefined,
    { timeout: 60000 },
  );
  const confirmar = page.getByTestId("relevo-confirmar");
  if (await confirmar.isVisible()) await confirmar.click();
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 60000 });
}

for (const { ancho, alto } of VIEWPORTS) {
  test(`pp-1..pp-4: parte con premios por asiento a ${ancho}x${alto}`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: ancho, height: alto });
    await empezarCuatro(page);
    const clavesAntes = await page.evaluate(() => Object.keys(localStorage).sort());

    // El escudo gasta el turno sin depender de la puntería y el drenaje de la
    // muerte súbita deja una sola nave en pie: final determinista con 4 asientos.
    await page.evaluate(() => window.__debug.fijarMuerteSubita!({ ronda: 13, integridades: [40, 1, 1, 2] }));
    await page.getByTestId("selector-arma-abrir").click();
    await page.getByTestId("pestana-equipo").click();
    await page.getByTestId("equipo-escudo").click();
    await page.getByTestId("disparar").click();
    await page.waitForFunction(() => window.__debug.parteDeGuerra != null, undefined, { timeout: 120000 });
    await expect(page.getByTestId("parte-de-guerra")).toBeVisible();

    // pp-1: una tarjeta por asiento, con 1-2 premios cuya cifra sale de __debug.
    const premios = await page.evaluate(() => window.__debug.parteDeGuerra!.premios);
    expect(premios).toHaveLength(4);
    for (let asiento = 0; asiento < 4; asiento++) {
      const tarjeta = page.getByTestId(`premio-asiento-${asiento}`);
      await expect(tarjeta).toBeVisible();
      const pintados = tarjeta.getByTestId("premio");
      const cuantos = await pintados.count();
      expect(cuantos).toBeGreaterThanOrEqual(1);
      expect(cuantos).toBeLessThanOrEqual(2);
      expect(cuantos).toBe(premios[asiento].length);
      for (let i = 0; i < cuantos; i++) {
        const texto = (await pintados.nth(i).innerText()).replace(/\s+/g, " ");
        expect(texto).toContain(premios[asiento][i].nombre);
        expect(texto).toContain(premios[asiento][i].texto);
        // La cifra que justifica el premio aparece en el texto pintado.
        expect(texto).toContain(String(premios[asiento][i].cifra));
      }
      // Un nombre largo no desborda la tarjeta.
      const caja = await tarjeta.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
      expect(caja.sw).toBeLessThanOrEqual(caja.cw);
    }
    await expect(page.getByTestId("premio-asiento-nombre-2")).toContainText(NOMBRE_LARGO);

    // pp-2: «Otra partida» cabe en el viewport sin desplazar.
    const boton = await page.getByTestId("otra-partida").boundingBox();
    expect(boton).not.toBeNull();
    expect(boton!.y).toBeGreaterThanOrEqual(0);
    expect(boton!.y + boton!.height).toBeLessThanOrEqual(alto);
    await page.screenshot({ path: `capturas/premios-parte-14-final-${ancho}x${alto}.png` });

    // pp-3: «Ver números» despliega una fila por asiento y vuelve a plegarse.
    const ver = page.getByTestId("ver-numeros");
    await expect(ver).toHaveAttribute("aria-expanded", "false");
    await ver.click();
    await expect(ver).toHaveAttribute("aria-expanded", "true");
    for (let asiento = 0; asiento < 4; asiento++) await expect(page.getByTestId(`fila-numeros-${asiento}`)).toBeVisible();
    await page.screenshot({ path: `capturas/premios-parte-14-numeros-${ancho}x${alto}.png` });
    await ver.click();
    await expect(page.getByTestId("tabla-numeros")).toHaveCount(0);

    // pp-4: no se guarda nada nuevo entre partidas.
    const clavesDespues = await page.evaluate(() => Object.keys(localStorage).sort());
    const nuevas = clavesDespues.filter((k) => !clavesAntes.includes(k));
    expect(nuevas.filter((k) => !/partida/i.test(k))).toEqual([]);

    // pp-2: tocar «Otra partida» arranca la partida nueva con los mismos jugadores.
    await page.getByTestId("otra-partida").click();
    await page.waitForFunction(() => window.__debug.parteDeGuerra == null, undefined, { timeout: 60000 });
    const nombres = await page.evaluate(() => window.__debug.controladores!.map((c) => c.nombre));
    expect(nombres).toEqual(["Ana", "Luis", NOMBRE_LARGO, "Eva"]);
  });
}
