import { test, expect } from "@playwright/test";
import { puntoLibreDeArrastre } from "./utilesApuntado";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

const MUNDO_ANCHO = 1920;
const MUNDO_ALTO = 1080;

// Elementos de HUD opacos que pueden de verdad tapar el proyectil a la
// vista -- "superficie-arrastre" queda fuera a propósito: es la capa
// transparente de captura de gesto (touchAction: none, sin fondo), no dibuja
// nada, así que no puede "tapar" nada aunque cubra toda la pantalla.
const TESTIDS_HUD_OPACO = [
  "resultado-turno",
  "reticulo",
  "paso-angulo-mas",
  "paso-angulo-menos",
  "selector-arma-abrir",
  "repetir-disparo",
  "disparar",
];

// proy-5 (camino_critico): de punta a punta en móvil (360x640), durante un
// vuelo real el proyectil tiene que ser visible dentro del lienzo y no
// tapado por el HUD en el 90% o más de los fotogramas muestreados, y su
// silueta debe corresponder al arma seleccionada -- no a la de catálogo por
// defecto, que es la que ya cubrían proy-1..3.
//
// El muestreo ocurre DENTRO del propio vuelo real (animacionEnCurso true),
// sondeando a intervalo corto -- no es una espera fija a un resultado
// (issue #151), es la única forma de observar un estado que cambia
// continuamente mientras dura.
test("proy-5: en móvil, el proyectil real se ve dentro del lienzo y sin tapar por el HUD durante el vuelo", async ({
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

  // Arma explícitamente distinta de la de catálogo por defecto (proy-1..3 ya
  // cubrieron esa) -- así la comprobación de silueta prueba de verdad que la
  // vista sigue al arma elegida, no a la inicial.
  const ARMA_ELEGIDA = "mortero-lamentable";
  await page.getByTestId("selector-arma-abrir").click();
  await page.getByTestId(`arma-${ARMA_ELEGIDA}`).click();
  await page.waitForFunction(
    (id) => window.__debug.control!.ajuste.armaId === id,
    ARMA_ELEGIDA,
  );

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);

  async function arrastrarHasta(anguloObjetivo: number, potenciaObjetivo: number): Promise<void> {
    const ajusteAntes = (await page.evaluate(() => window.__debug.control!.ajuste))!;
    const deltaY = -(anguloObjetivo - ajusteAntes.anguloGrados) / GANANCIA_ANGULO_GRADOS;
    const deltaX = (potenciaObjetivo - ajusteAntes.potencia) / GANANCIA_POTENCIA;

    const inicio = await puntoLibreDeArrastre(page);
    const fin = { x: inicio.x + deltaX * 360, y: inicio.y + deltaY * 640 };
    await page.mouse.move(inicio.x, inicio.y);
    await page.mouse.down();
    await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
    await page.mouse.move(fin.x, fin.y, { steps: 5 });
    await page.mouse.up();
  }

  // No hace falta un impacto exacto (proy-5 no comprueba daño): un ángulo
  // bajo y una potencia alta dan un arco que se mantiene dentro del campo
  // de batalla completo (MUNDO_ALTO=1080, el mismo que ya cubre la cámara
  // fija de render-4) -- la solución balística exacta del jugador puede ser
  // un mortero de arco muy alto que sale por arriba del propio mundo, que
  // es un vuelo real pero no el más representativo para comprobar
  // visibilidad de punta a punta.
  await arrastrarHasta(18, 90);

  // Rectángulos fijos del HUD y del lienzo: se leen UNA vez porque ninguno
  // de los dos se mueve durante el vuelo (ni cámara ni layout responsive
  // cambian a mitad de turno).
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

  // El propio disparo de la máquina se encadena en el onComplete de este
  // (ver dispararRafagaTurbo), así que animacionEnCurso puede pasar
  // directamente de este vuelo al de la respuesta rival sin pasar por
  // false entre medias -- por eso el muestreo se corta también en cuanto
  // numeroTurno avanza, no solo cuando termina la animación.
  //
  // imp/proy-5 (fallo intermitente diagnosticado en desarrollo-18): leer
  // animacionEnCurso/numeroTurno y proyectilEnVuelo en dos evaluate()
  // separados no es atómico -- cada uno es un viaje de ida y vuelta al
  // navegador, y entre ambos puede correr el fotograma exacto en el que
  // termina el vuelo del jugador y arranca (síncronamente, mismo tick) el
  // de la IA con OTRA arma. El resultado observado era una muestra
  // ocasional con el armaId del rival. Se leen los tres campos dentro de
  // UN solo evaluate(): la función se ejecuta de un tirón en el hilo de la
  // página, así que la muestra siempre es del mismo instante.
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();

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
      muestras.push({
        visible: dentro && !tapado,
        armaId: punto.armaId,
      });
      if (!capturado) {
        await page.screenshot({ path: "capturas/proyectiles-visibles-13-proy5-vuelo-visible.png" });
        capturado = true;
      }
    }
    await page.waitForTimeout(30);
  }

  expect(muestras.length).toBeGreaterThan(5);
  expect(muestras.every((m) => m.armaId === ARMA_ELEGIDA)).toBe(true);

  const visibles = muestras.filter((m) => m.visible).length;
  expect(visibles / muestras.length).toBeGreaterThanOrEqual(0.9);
});
