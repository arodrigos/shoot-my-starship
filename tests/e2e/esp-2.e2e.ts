import { test, expect } from "@playwright/test";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import { ANGULO_INICIAL_GRADOS, POTENCIA_INICIAL, GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

// esp-2 (camino crítico): lo que se renderiza es lo que colisiona. Un mismo
// disparo (mismo ángulo, misma potencia, mismo origen -- las naves no se
// mueven en el hito espacial) repetido dos veces debe atravesar el cráter
// que abrió el primero: si el segundo impacto cayera en el mismo punto que
// el primero, el resolvedor estaría colisionando contra una máscara que ya
// no coincide con lo que la textura (y el jugador) ve. Comprobado además con
// el mismo contrato de terreno-3/render-2 (máscara y textura coinciden en un
// muestreo amplio) tras los dos impactos reales.
//
// Ángulo/potencia (56°, 54%) son los mismos que esp-1: se comprobó aparte
// (ver esp-1.e2e.ts) que para la semilla por defecto ese disparo impacta de
// verdad dentro del mundo, así que sirve igual para comprobar qué pasa al
// repetirlo.
const ANGULO_OBJETIVO_GRADOS = 56;
const POTENCIA_OBJETIVO = 54;

function esEventoImpacto(evento: EventoSimulacion): evento is Extract<EventoSimulacion, { tipo: "impacto" }> {
  return evento.tipo === "impacto";
}

test("un disparo repetido atraviesa el cráter del primero, y máscara y textura siguen coincidiendo", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const viewport = page.viewportSize()!;
  const deltaVerticalFraccion = (ANGULO_OBJETIVO_GRADOS - ANGULO_INICIAL_GRADOS) / GANANCIA_ANGULO_GRADOS;
  const deltaHorizontalFraccion = (POTENCIA_OBJETIVO - POTENCIA_INICIAL) / GANANCIA_POTENCIA;
  const inicio = { x: viewport.width * 0.5, y: viewport.height * 0.85 };
  const fin = {
    x: inicio.x + deltaHorizontalFraccion * viewport.width,
    y: inicio.y - deltaVerticalFraccion * viewport.height,
  };
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
  await page.mouse.move(fin.x, fin.y, { steps: 5 });
  await page.mouse.up();

  await page.waitForFunction(
    (objetivo) =>
      Math.abs(window.__debug.control!.ajuste.anguloGrados - objetivo.angulo) < 0.5 &&
      Math.abs(window.__debug.control!.ajuste.potencia - objetivo.potencia) < 0.5,
    { angulo: ANGULO_OBJETIVO_GRADOS, potencia: POTENCIA_OBJETIVO },
  );

  // Primer disparo: se espera solo a que suba numeroTurno (el disparo del
  // jugador ya resuelto), no a que la máquina termine de responder -- en ese
  // punto ultimosEventos describe todavía solo este primer disparo (ver el
  // mismo razonamiento en esp-1.e2e.ts).
  let numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno))!;
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  await page.getByTestId("disparar").click();
  await page.waitForFunction((antes) => window.__debug.numeroTurno! > antes, numeroTurnoAntes, { timeout: 30000 });

  const eventosPrimerDisparo = (await page.evaluate(() => window.__debug.ultimosEventos))!;
  const primerImpacto = eventosPrimerDisparo.find(esEventoImpacto);
  expect(primerImpacto).toBeDefined();

  // Segundo disparo: se espera a que el turno vuelva de verdad al jugador
  // (la máquina ya ha respondido y la animación ha terminado) antes de
  // repetir el mismo ajuste -- store.ts no reinicia `ajuste` entre turnos,
  // así que sigue apuntando exactamente igual sin un segundo gesto.
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 30000 });
  const ajusteAntesSegundo = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(ajusteAntesSegundo.anguloGrados).toBeCloseTo(ANGULO_OBJETIVO_GRADOS, 0);
  expect(ajusteAntesSegundo.potencia).toBeCloseTo(POTENCIA_OBJETIVO, 0);

  numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno))!;
  await page.getByTestId("disparar").click();
  await page.waitForFunction((antes) => window.__debug.numeroTurno! > antes, numeroTurnoAntes, { timeout: 30000 });

  const eventosSegundoDisparo = (await page.evaluate(() => window.__debug.ultimosEventos))!;
  const segundoImpacto = eventosSegundoDisparo.find(esEventoImpacto);
  expect(segundoImpacto).toBeDefined();

  // El segundo impacto tiene que caer en un punto distinto (más allá,
  // atravesando el cráter) del primero -- si cayera en el mismo punto,
  // el proyectil se habría detenido contra un sólido que el propio primer
  // disparo ya había convertido en aire.
  const dx = segundoImpacto!.x - primerImpacto!.x;
  const dy = segundoImpacto!.y - primerImpacto!.y;
  const distancia = Math.sqrt(dx * dx + dy * dy);
  // El diseño fija el umbral en 30px (ver bloque render-espacio, esp-2); la
  // comprobación previa por guion aparte dio ~44.7px de distancia real entre
  // el primer y el segundo impacto para este ángulo/potencia, así que 30px
  // sigue siendo un margen holgado, no un ajuste fino al resultado observado.
  expect(distancia).toBeGreaterThan(30);

  // El punto del primer cráter debe seguir siendo aire (no sólido) tras el
  // segundo disparo -- nadie ha vuelto a rellenarlo.
  const primerPuntoSigueAbierto = await page.evaluate(
    (p) => !window.__debug.terreno!.esSolido(Math.round(p.x), Math.round(p.y)),
    { x: primerImpacto!.x, y: primerImpacto!.y },
  );
  expect(primerPuntoSigueAbierto).toBe(true);

  // Máscara y textura siguen coincidiendo en un muestreo amplio tras los dos
  // impactos reales (mismo contrato que terreno-3/render-2).
  const MUNDO_ANCHO = 1920;
  const MUNDO_ALTO = 1080;
  const NUM_PUNTOS = 3000;
  const resultados = await page.evaluate(
    ({ ancho, alto, numeroDePuntos }) => {
      let estado = 20260926;
      const siguiente = () => {
        estado = (estado * 1103515245 + 12345) & 0x7fffffff;
        return estado / 0x7fffffff;
      };
      const puntos = Array.from({ length: numeroDePuntos }, () => ({
        x: Math.floor(siguiente() * ancho),
        y: Math.floor(siguiente() * alto),
      }));
      return window.__debug.terreno!.comprobarPuntos(puntos);
    },
    { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, numeroDePuntos: NUM_PUNTOS },
  );
  expect(resultados).toHaveLength(NUM_PUNTOS);
  expect(resultados.every(Boolean)).toBe(true);
});
