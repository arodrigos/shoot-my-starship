import { test, expect } from "@playwright/test";

// humor-1: forzarFinDePartida() dispara Despedida (daño y autodaño
// garantizado, fiabilidad 1) en cada turno hasta que alguien llega a 0 -- así
// que SIEMPRE emite al menos un "autoimpacto" antes de terminar, el mismo
// mecanismo ya usado por render-7 para acotar el número de turnos. Es la
// única forma de forzar un evento de humor concreto sin depender de que la
// IA lo produzca por azar en un número razonable de turnos.
test("humor-1: un evento de humor dispara una reacción visible y mueve la cámara en el mismo turno", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  // El banner se oculta solo a los 2,6 s, y con la consola superpuesta el
  // lienzo pinta más: leerlo con varios viajes al navegador (visible, tipo,
  // texto) dejaba que expirara entre uno y otro. Un observador dentro de la
  // página anota cada banner que aparece, así la comprobación no depende de
  // cuándo llegue el test a mirar.
  await page.evaluate(() => {
    const vistos: Array<{ tipo: string | null; texto: string }> = [];
    (window as unknown as { __bannersVistos: typeof vistos }).__bannersVistos = vistos;
    const anotar = () => {
      const el = document.querySelector('[data-testid="reaccion-texto"]');
      if (!el) return;
      const texto = el.textContent ?? "";
      const tipo = el.getAttribute("data-tipo-evento");
      const ultimo = vistos[vistos.length - 1];
      if (!ultimo || ultimo.tipo !== tipo || ultimo.texto !== texto) vistos.push({ tipo, texto });
    };
    new MutationObserver(anotar).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    anotar();
  });

  await page.evaluate(() => window.__debug.forzarFinDePartida!());

  // La sacudida dura solo 220ms: si el polling arrancara después de las
  // comprobaciones del banner (varios viajes de ida y vuelta al navegador),
  // podría empezar a mirar cuando la sacudida ya ha terminado, dando un falso
  // negativo. Se lanza el polling ya mismo, en paralelo con el resto de
  // comprobaciones, para que la ventana de observación empiece lo antes
  // posible tras el turno que la dispara.
  const sacudidaDetectada = expect
    .poll(async () => page.evaluate(() => window.__debug.sacudiendoCamara === true), {
      timeout: 5000,
      intervals: [20, 50],
    })
    .toBe(true);

  await page.waitForFunction(() => window.__debug.naves!.some((nave) => nave.integridad <= 0));

  const eventos = await page.evaluate(() => window.__debug.ultimosEventos ?? []);
  expect(eventos.some((evento) => evento.tipo === "autoimpacto")).toBe(true);

  // El turno final puede traer más de un evento de humor (p.ej. un derrumbe
  // encadenado tras el autoimpacto): reaccionarAHumor procesa el turno en
  // orden y el banner se queda con el último, así que se comprueba que lo
  // mostrado es de verdad uno de los eventos de ESTE turno, no que sea
  // necesariamente el autoimpacto que garantizó que hubiera alguno.
  const bannersVistos = await page.evaluate(
    () => (window as unknown as { __bannersVistos: Array<{ tipo: string | null; texto: string }> }).__bannersVistos,
  );
  expect(bannersVistos.length).toBeGreaterThan(0);
  expect(bannersVistos.some((b) => b.texto.length > 0 && eventos.some((evento) => evento.tipo === b.tipo))).toBe(true);

  // Comprobado por polling (lanzado más arriba, antes de las demás
  // comprobaciones), porque la sacudida es una animación de 220ms, no un
  // salto instantáneo, y shakeEffect transforma la matriz de render de la
  // cámara -- nunca su worldView/scroll -- así que no hay forma de detectarla
  // comparando el rectángulo de cámara entre dos instantes.
  await sacudidaDetectada;
});
