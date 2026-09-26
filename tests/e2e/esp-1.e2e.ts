import { test, expect } from "@playwright/test";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import { generarSistema } from "@/sim/sistema/generador";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { detenerseEnSuelo, ALTURA_CANON_PX } from "@/sim/armas/resolver";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { MUNDO_ANCHO, MUNDO_ALTO } from "@/juego/constantes";
import { SEMILLA_SISTEMA_POR_DEFECTO } from "@/juego/mundos/mapas";
import { ANGULO_INICIAL_GRADOS, POTENCIA_INICIAL, GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

// esp-1 (camino crítico): apuntar y disparar de verdad, con el mismo gesto
// que usaría un jugador, produce un proyectil que la gravedad de los
// planetas curva más de 40px respecto a la línea recta que habría seguido
// sin ellos (mundo.gravedad es 0 en el hito espacial: sin planetas, un
// proyectil vuela en línea recta, no en parábola), y el turno termina en
// impacto o en "perdido en órbita" declarado -- nunca en una excepción ni en
// una animación que no termina. El turno debe avanzar en cualquier caso.
//
// Ángulo y potencia (56°, 54%) no son arbitrarios: se buscaron por barrido
// exhaustivo sobre exactamente la misma física que usa el juego real
// (simularVuelo, ver scratch-buscar-tiro.mts descartado tras encontrarlos)
// para garantizar, para la semilla por defecto, un disparo que SÍ impacta
// dentro del mundo (no se pierde en órbita ni sale por el borde) y que se
// desvía holgadamente más de 40px de su equivalente sin planetas.
const ANGULO_OBJETIVO_GRADOS = 56;
const POTENCIA_OBJETIVO = 54;
const DESVIO_MINIMO_PX = 40;

test("apuntar y disparar produce un vuelo curvado por la gravedad planetaria que termina en impacto y avanza el turno", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  expect(await page.evaluate(() => window.__debug.modoEspacial)).toBe(true);

  const nave0 = (await page.evaluate(() => window.__debug.naves))![0];
  const origenX = nave0.x;
  const origenY = nave0.y - ALTURA_CANON_PX;

  // Referencia sin planetas (línea recta: mundo.gravedad es 0 en el hito
  // espacial) calculada con la MISMA física que usa el resolvedor real, no
  // una fórmula aparte -- para que la comparación mida de verdad el efecto
  // de la gravedad de los planetas, no una discrepancia entre dos modelos.
  const sistema = generarSistema(SEMILLA_SISTEMA_POR_DEFECTO, MUNDO_ANCHO, MUNDO_ALTO);
  const detenerse = detenerseEnSuelo(sistema.mascara, MUNDO_ANCHO, MUNDO_ALTO);
  const rad = (ANGULO_OBJETIVO_GRADOS * Math.PI) / 180;
  const v = velocidadDesdePotencia(POTENCIA_OBJETIVO);
  const inicial = crearProyectil(origenX, origenY, v * Math.cos(rad), -v * Math.sin(rad));
  const sinPlanetas = simularVuelo(inicial, 0, 0, detenerse);

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

  const ajusteTrasArrastre = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(ajusteTrasArrastre.anguloGrados).toBeCloseTo(ANGULO_OBJETIVO_GRADOS, 0);
  expect(ajusteTrasArrastre.potencia).toBeCloseTo(POTENCIA_OBJETIVO, 0);

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno))!;
  await page.getByTestId("disparar").click();

  // numeroTurno sube en cuanto avanzar() resuelve el disparo del jugador --
  // antes de que la máquina encadene el suyo (ver Partida.ts,
  // aplicarResultadoTurno/dispararTurnoIA) -- así que este es el punto en el
  // que window.__debug.ultimosEventos todavía describe SOLO el disparo del
  // jugador, no el de la máquina que le sigue.
  await page.waitForFunction(
    (antes) => window.__debug.numeroTurno! > antes,
    numeroTurnoAntes,
    { timeout: 30000 },
  );

  const eventos = await page.evaluate(() => window.__debug.ultimosEventos);
  const impacto = eventos!.find(
    (evento): evento is Extract<EventoSimulacion, { tipo: "impacto" }> => evento.tipo === "impacto",
  );
  const perdido = eventos!.some((evento) => evento.tipo === "proyectil-perdido");

  expect(impacto || perdido).toBeTruthy();

  if (impacto) {
    const dx = impacto.x - sinPlanetas.proyectil.x;
    const dy = impacto.y - sinPlanetas.proyectil.y;
    const desvio = Math.sqrt(dx * dx + dy * dy);
    expect(desvio).toBeGreaterThan(DESVIO_MINIMO_PX);
  }

  const numeroTurnoDespues = await page.evaluate(() => window.__debug.numeroTurno);
  expect(numeroTurnoDespues!).toBeGreaterThan(numeroTurnoAntes!);
});
