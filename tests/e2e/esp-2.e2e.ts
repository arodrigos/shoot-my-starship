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
// encuadre-movil (corrección): (72.5°, 79%), heredados de esp-1, dejaron de
// valer en cuanto el mundo pasó a reconfigurarse por el aspecto del
// contenedor -- con el viewport por defecto de Playwright (1280x720,
// layout-dos-zonas da el 58% del alto a la zona de juego) el mundo sale
// mucho más ancho y bajo que el 1920x1080 de siempre (2521x822, medido), y
// ESE disparo concreto ya no lo capturan los planetas: sale por el borde
// derecho del mundo todavía muy por encima de su parte visible (y ~ -6841),
// así que el "impacto" que detenerseEnSuelo reporta es en realidad una
// salida de mundo, no un choque con terreno -- el cráter que se talla ahí
// no tiene ningún efecto real y el segundo disparo repite el mismo punto
// (distancia medida: ~0,2px), justo el fallo que destapó este bloque.
//
// ia-punteria (corrección): (26°, 56%) con la semilla de producción
// (20260926) dejaron de valer -- colocarNaves (impacto-naves) ahora exige
// tiro viable EN LAS DOS DIRECCIONES (fix de ia-punteria-6), esa semilla ya
// no supera ni la recolocación ni las tres regeneraciones a 2521x822 (el
// mundo de este viewport por defecto) y cae al último recurso
// (colocacionUltimoRecurso), que coloca las naves en posiciones fijas sin
// ninguna garantía de tiro, con un sistema planetario distinto del que este
// disparo asumía. Se fija "?semilla=20" (sí coloca en el primer escalón de
// recolocación con esta mundo) y se rebuscan ángulo/potencia por el mismo
// barrido exhaustivo sobre la física real (resolverDisparo, con el
// rastreador de naves) para la colocación resultante: el primer disparo SÍ
// impacta dentro del mundo (contra un planeta), y el segundo, tras el
// cráter, continúa por la MISMA trayectoria determinista y aterriza ~497px
// más allá -- holgado frente al umbral de 30px.
const ANGULO_OBJETIVO_GRADOS = 126.5;
const POTENCIA_OBJETIVO = 23;

function esEventoImpacto(evento: EventoSimulacion): evento is Extract<EventoSimulacion, { tipo: "impacto" }> {
  return evento.tipo === "impacto";
}

test("un disparo repetido atraviesa el cráter del primero, y máscara y textura siguen coincidiendo", async ({ page }) => {
  // Ver esp-1: dos disparos con planetas pueden consumir buena parte de su
  // presupuesto de 12s simulados en tiempo real bajo contención de CPU --
  // aquí son DOS disparos completos (más el turno de la máquina entre
  // medias), así que 150s no bastó en la práctica (medido: supera los
  // 150000ms totales bajo contención alta); se sube al doble de margen.
  test.setTimeout(280000);
  await page.goto("/?semilla=20");
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
  await page.waitForFunction((antes) => window.__debug.numeroTurno! > antes, numeroTurnoAntes, { timeout: 120000 });

  const eventosPrimerDisparo = (await page.evaluate(() => window.__debug.ultimosEventos))!;
  const primerImpacto = eventosPrimerDisparo.find(esEventoImpacto);
  expect(primerImpacto).toBeDefined();

  // Segundo disparo: se espera a que el turno vuelva de verdad al jugador
  // (la máquina ya ha respondido y la animación ha terminado) antes de
  // repetir el mismo ajuste -- store.ts no reinicia `ajuste` entre turnos,
  // así que sigue apuntando exactamente igual sin un segundo gesto.
  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true, undefined, { timeout: 120000 });
  const ajusteAntesSegundo = await page.evaluate(() => window.__debug.control!.ajuste);
  expect(ajusteAntesSegundo.anguloGrados).toBeCloseTo(ANGULO_OBJETIVO_GRADOS, 0);
  expect(ajusteAntesSegundo.potencia).toBeCloseTo(POTENCIA_OBJETIVO, 0);

  numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno))!;
  await page.getByTestId("disparar").click();
  await page.waitForFunction((antes) => window.__debug.numeroTurno! > antes, numeroTurnoAntes, { timeout: 120000 });

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
  // comprobación previa por guion aparte (encuadre-movil, ver arriba) dio
  // ~474px de distancia real entre el primer y el segundo impacto para
  // este ángulo/potencia, así que 30px sigue siendo un margen holgado, no
  // un ajuste fino al resultado observado.
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
  // DESVIACIÓN (encuadre-movil): se lee window.__debug.mundo en vez de
  // asumir 1920x1080 -- este hito espacial también se reconfigura al
  // aspecto real del contenedor.
  const mundo = (await page.evaluate(() => window.__debug.mundo))!;
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
    { ancho: mundo.ancho, alto: mundo.alto, numeroDePuntos: NUM_PUNTOS },
  );
  expect(resultados).toHaveLength(NUM_PUNTOS);
  expect(resultados.every(Boolean)).toBe(true);
});
