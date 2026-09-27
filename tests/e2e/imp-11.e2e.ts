import { test, expect } from "@playwright/test";
import { buscarArma } from "@/sim/armas/catalogo";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

// imp-11 (camino_critico): las dos ramas del contrato de daño, de punta a
// punta y con entrada determinista -- un disparo bien apuntado (el mismo
// oráculo real que ya usa la IA, barridoRejilla, expuesto para el test como
// solucionMultipozoJugador) reduce la integridad del rival mostrada en el
// HUD en una cantidad coherente con el daño declarado del arma, y un disparo
// deliberadamente fuera del radio de daño del arma NO la reduce en absoluto.
// Viewport 360x640 (móvil de referencia).
//
// Corrección sobre la entrega anterior (feedback del Gatekeeper): esto se
// medía sobre window.__debug.naves[].integridad con ?mapa=calma-de-los-restos
// (suelo plano, deriva 0), un atajo que nunca pasa por modo espacial real ni
// por el HUD que de verdad ve quien juega. Ahora se navega a "/" (modo
// espacial real, gravedad multipozo) y la integridad se lee del HUD
// (IntegridadHUD, role=progressbar) igual que la vería una persona jugando,
// no del estado interno de depuración.
test("imp-11: un disparo bien apuntado reduce la integridad del rival según el catálogo, y uno fuera de radio no la reduce", async ({
  page,
}) => {
  // Cuatro vuelos animados de punta a punta (dos disparos del jugador y las
  // dos respuestas de la máquina) bajo WebGL por software (ver hueco de
  // render-3): el doble de carga que control-1, que ya necesita más que el
  // timeout por defecto para dos.
  //
  // impacto-naves (desviación, ver entregable): 60s por disparo no bastó en
  // la práctica bajo contención alta (medido: colgado hasta agotar ese
  // timeout sin resolver, pero terminando bien con más margen) -- mismo
  // síntoma que control-5/esp-1/esp-2, se sube al doble por el mismo motivo.
  test.setTimeout(280000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const armaBase = buscarArma((await page.evaluate(() => window.__debug.control!.ajuste.armaId))!);
  const efecto = armaBase.efecto;
  if (efecto.tipo !== "danio") {
    throw new Error("imp-11 espera que el arma de ajuste inicial sea de tipo daño");
  }

  async function integridadRival(): Promise<number> {
    const texto = await page.getByTestId("integridad-nave-1").getByRole("progressbar").getAttribute("aria-valuenow");
    expect(texto).not.toBeNull();
    return Number(texto);
  }

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

  // Dispara con el ángulo/potencia dados y espera SOLO a que este disparo
  // (no la respuesta de la máquina) quede resuelto.
  async function dispararYEsperarEsteDisparo(anguloObjetivo: number, potenciaObjetivo: number): Promise<void> {
    const numeroAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await arrastrarHasta(anguloObjetivo, potenciaObjetivo);
    await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
    await page.getByTestId("disparar").click();
    await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) >= n + 1, numeroAntes, { timeout: 120000 });
  }

  // Rama 1: disparo bien apuntado -- el mismo oráculo real (barridoRejilla,
  // imp-8/ia-multipozo) que ya usa la IA para apuntar, sobre el sistema
  // planetario en curso, con daño > 0 ya verificado contra el resolutor real
  // antes de disparar.
  const solucion = await page.evaluate(() => window.__debug.solucionMultipozoJugador!());
  expect(solucion).not.toBeNull();
  expect(solucion!.danio).toBeGreaterThan(0);

  const integridadAntesImpacto = await integridadRival();
  await dispararYEsperarEsteDisparo(solucion!.anguloGrados, solucion!.potencia);
  const integridadDespuesImpacto = await integridadRival();

  const danioCausado = integridadAntesImpacto - integridadDespuesImpacto;
  expect(danioCausado).toBeGreaterThan(0);
  expect(danioCausado).toBeLessThanOrEqual(efecto.danioMaximo);

  await page.screenshot({ path: "capturas/impacto-naves-16-imp11-impacto-directo.png" });

  // Deja que la respuesta de la máquina termine del todo antes de que el
  // jugador vuelva a apuntar (puedeDisparar solo será true de nuevo cuando
  // sea su turno).
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 120000 });

  // Rama 2: disparo deliberadamente vertical y de poca potencia, verificado
  // de antemano contra el resolutor real (danio === 0, probarDisparoMultipozoJugador)
  // -- no una suposición sobre geometría de suelo plano que ya no aplica en
  // modo espacial con gravedad multipozo.
  const anguloFallo = 90;
  const potenciaFallo = 12;
  const pruebaFallo = await page.evaluate(
    ({ angulo, potencia }) => window.__debug.probarDisparoMultipozoJugador!(angulo, potencia),
    { angulo: anguloFallo, potencia: potenciaFallo },
  );
  expect(pruebaFallo.danio).toBe(0);

  const integridadAntesFallo = await integridadRival();
  await dispararYEsperarEsteDisparo(anguloFallo, potenciaFallo);
  const integridadDespuesFallo = await integridadRival();

  expect(integridadDespuesFallo).toBe(integridadAntesFallo);

  await page.screenshot({ path: "capturas/impacto-naves-16-imp11-fuera-de-radio.png" });
});
