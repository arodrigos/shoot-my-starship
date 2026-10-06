import { test, expect } from "@playwright/test";
import { GANANCIA_ANGULO_GRADOS, GANANCIA_POTENCIA } from "@/juego/control/apuntado";

// cie-1 (camino_critico): de punta a punta sobre el despliegue (ver
// desviaciones del entregable -- se ejecuta contra el mismo servidor de
// producción local, npm run start, que usa el resto de la suite de e2e, no
// contra una URL de Vercel: el proyecto de Vercel de este producto se crea en
// la etapa de traspaso, DESPUÉS de que Gatekeeper apruebe este mismo bloque
// -- ver el comentario de .github/workflows/ci.yml, job "e2e"). Dos sistemas
// SEGUIDOS, cada uno con su propia semilla y su propio rival, jugados de
// verdad hasta que hay un ganador, sin ningún error de consola en ninguno.
//
// Corrección sobre la entrega anterior (feedback del Gatekeeper): jugaba
// ?mapa=... (el modo de suelo plano heredado -- Partida.ts llama
// fijarModoEspacial(false) y monta el estado sin un solo planeta) y
// comparaba mapa.id en vez de contar planetas; y alcanzaba el ganador con
// forzarFinDePartida(), que dispara Despedida con autodaño garantizado
// (fiabilidad 1) CON INDEPENDENCIA de si el tiro real acierta -- así que
// nunca ejercitaba la física nueva que este bloque tiene que probar de
// punta a punta. Ahora:
//   - navega a "/?semilla=<n>" (modo espacial real, nunca ?mapa=) con dos
//     semillas explícitas distintas, y afirma sobre window.__debug.planetas
//     (cie-2) -- número y disposición reales del sistema -- no sobre un
//     identificador de mapa;
//   - dispara turno tras turno con el mismo oráculo real que ya usa imp-11
//     (solucionMultipozoJugador, barridoRejilla sobre el vuelo real y la
//     parada real) hasta que una nave llega a 0 de integridad por daño de
//     verdad, con la respuesta real del rival (ia-multipozo) resolviéndose
//     entre disparo y disparo -- nunca con un atajo que decida el ganador
//     por fuera del resolutor real.
//
// apuntado-y-relevo: la colocación humana ahora mide 0-360°, así que las
// semillas 1001 y 777777 dejaron de dar una partida con un solo ganador (el
// rival se autoinflige daño en el mismo turno que remata y quedan las dos
// naves a 0). Se rebuscaron con avanzar(), el oráculo real y la IA real:
// 1006 (Almirante) y 777778 (La Contable) terminan en 6 y 4 rondas con la
// nave del jugador viva.
const NUMERO_MAXIMO_DE_RONDAS = 10;

test("dos sistemas seguidos, cada uno con su propio rival, jugados de verdad con el oráculo real hasta que hay un ganador, sin errores de consola", async ({
  page,
}) => {
  // Hasta 10 rondas de disparo real (jugador + respuesta del rival) por
  // sistema, cada una un vuelo animado bajo WebGL por software: ver
  // imp-11/esp-1 para el orden de magnitud por vuelo bajo contención alta.
  test.setTimeout(1800000);
  await page.setViewportSize({ width: 360, height: 740 });

  const erroresDeConsola: string[] = [];
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") erroresDeConsola.push(mensaje.text());
  });
  page.on("pageerror", (error) => erroresDeConsola.push(String(error)));

  async function jugarUnSistemaHastaGanar(rivalId: string) {
    await expect(page.getByTestId(`rival-${rivalId}`)).toBeVisible();
    await page.getByTestId(`rival-${rivalId}`).click();
    await expect(page.getByTestId(`rival-${rivalId}`)).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("boton-jugar").click();
    await page.waitForSelector("#game-container canvas");
    await page.waitForFunction(
      () => window.__debug.control !== undefined && window.__debug.planetas !== undefined,
    );
    if (await page.getByTestId("ayuda-cerrar").isVisible()) {
      await page.getByTestId("ayuda-cerrar").click();
    }

    expect(await page.evaluate(() => window.__debug.modoEspacial)).toBe(true);

    // Sistema real, no un identificador de mapa: cuántos planetas hay y
    // dónde, para poder comparar de verdad dos sistemas entre sí.
    const planetas = (await page.evaluate(() => window.__debug.planetas))!;
    expect(planetas.length).toBeGreaterThan(0);

    for (let ronda = 0; ronda < NUMERO_MAXIMO_DE_RONDAS; ronda++) {
      // Alguna personalidad rival puede acabar la partida en su propio turno
      // (autodaño, ver la humorada "un almirante se autoinflige disciplina"),
      // es decir DESPUÉS del último "numeroTurno avanzó" que vio la ronda
      // anterior -- por eso "hay ganador" tiene que ser parte de esta misma
      // espera, no una comprobación aparte de antemano: si se mirara antes y
      // no después, esta espera se quedaría colgada hasta agotar el timeout
      // porque puedeDisparar ya no vuelve a ponerse a true nunca.
      await page.waitForFunction(
        () => window.__debug.control!.puedeDisparar === true || window.__debug.naves!.some((nave) => nave.integridad <= 0),
        undefined,
        { timeout: 120000 },
      );
      const navesAntes = (await page.evaluate(() => window.__debug.naves))!;
      if (navesAntes.some((nave) => nave.integridad <= 0)) break;

      // Mismo oráculo real que ya usa la IA (imp-11): un disparo con daño
      // > 0 verificado contra el resolutor real, nunca una condición de
      // parada inventada por el test.
      const solucion = await page.evaluate(() => window.__debug.solucionMultipozoJugador!());
      expect(solucion, `ronda ${ronda}: el oráculo real no encontró disparo viable`).not.toBeNull();

      const ajusteAntes = (await page.evaluate(() => window.__debug.control!.ajuste))!;
      const deltaY = -(solucion!.anguloGrados - ajusteAntes.anguloGrados) / GANANCIA_ANGULO_GRADOS;
      const deltaX = (solucion!.potencia - ajusteAntes.potencia) / GANANCIA_POTENCIA;
      const inicio = { x: 180, y: 620 };
      const fin = { x: inicio.x + deltaX * 360, y: inicio.y + deltaY * 740 };
      await page.mouse.move(inicio.x, inicio.y);
      await page.mouse.down();
      await page.mouse.move((inicio.x + fin.x) / 2, (inicio.y + fin.y) / 2, { steps: 5 });
      await page.mouse.move(fin.x, fin.y, { steps: 5 });
      await page.mouse.up();

      await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
      const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
      await page.getByTestId("disparar").click();
      // Basta con que ESTE disparo quede resuelto (no hace falta esperar
      // también a la respuesta del rival antes de mirar si ya hay ganador):
      // la siguiente vuelta del bucle espera puedeDisparar de nuevo, que no
      // llega hasta que el rival ha respondido.
      await page.waitForFunction(
        (antes) =>
          (window.__debug.numeroTurno ?? 0) > antes || window.__debug.naves!.some((nave) => nave.integridad <= 0),
        numeroTurnoAntes,
        { timeout: 120000 },
      );
    }

    const navesFinal = (await page.evaluate(() => window.__debug.naves))!;
    const ganador = navesFinal.find((nave) => nave.integridad > 0);
    const perdedor = navesFinal.find((nave) => nave.integridad <= 0);
    expect(ganador, `sin ganador tras ${NUMERO_MAXIMO_DE_RONDAS} rondas reales`).toBeDefined();
    expect(perdedor).toBeDefined();
    expect(perdedor!.integridad).toBe(0);

    await expect(page.getByTestId("parte-de-guerra")).toBeVisible();
    const parte = await page.evaluate(() => window.__debug.parteDeGuerra);
    expect(parte).not.toBeNull();
    expect(parte!.estadisticas.disparos).toBeGreaterThan(0);

    return planetas;
  }

  await page.goto("/?semilla=1006");
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  const planetasSistema1 = await jugarUnSistemaHastaGanar("almirante-bisagra");

  // Nueva navegación completa (no "otra partida"): para tener un sistema
  // DISTINTO de verdad, no basta con confiar en el sorteo de "otra
  // partida" (podría repetir disposición por azar); una semilla explícita
  // distinta sí lo garantiza.
  await page.goto("/?semilla=777778");
  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();
  const planetasSistema2 = await jugarUnSistemaHastaGanar("la-contable");

  // Dos sistemas distintos por número o disposición de planetas: nunca un
  // identificador de mapa, siempre los propios planetas.
  const disposicionDistinta =
    planetasSistema1.length !== planetasSistema2.length ||
    planetasSistema1.some((planeta, indice) => {
      const equivalente = planetasSistema2[indice];
      return (
        !equivalente ||
        planeta.cx !== equivalente.cx ||
        planeta.cy !== equivalente.cy ||
        planeta.radio !== equivalente.radio
      );
    });
  expect(disposicionDistinta).toBe(true);

  expect(erroresDeConsola).toEqual([]);
});
