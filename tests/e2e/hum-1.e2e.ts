import { test, expect } from "@playwright/test";
import { bancoDisparoDe, bancoImpactoDe } from "@/contenido/bancoBromas";

// hum-1 (camino_critico): diez turnos reales dejan una broma de disparo y
// otra de impacto en CADA turno, sin excepción, y cada frase corresponde a
// la nave que disparó de verdad y a la categoría de resultado que ocurrió
// de verdad -- no solo "el texto no está vacío".
//
// Corrección sobre la entrega anterior (feedback del Gatekeeper): el test
// anterior forzaba Despedida con forzarFinDePartida() (autoimpacto
// garantizado) y solo miraba el estado DESPUÉS de la ráfaga completa -- una
// muestra, no diez turnos -- comprobando longitud > 0 y que la categoría
// estuviera en la lista de las siete. Nunca cruzaba la frase mostrada
// contra bancoDisparoDe(voz)/bancoImpactoDe(voz, categoria) ni la categoría
// contra lo que de verdad pasó ese turno, así que vozDeNave podía devolver
// la voz cambiada, o la categoría publicada podía desincronizarse del
// resultado real, y esto seguía en verde.
//
// Ahora juega diez turnos reales con dispararRafagaTurbo (mismo
// dispararEntrada/avanzar() que un turno jugado a mano, empujando ella
// misma el reloj de animación -- ver proy-4) y lee
// window.__debug.historialBromas: un registro POR TURNO, con la nave que
// disparó, la voz usada, la categoría publicada y los eventos reales de
// ESE turno -- broma.ts (el store que ve el HUD) solo guarda la ÚLTIMA
// broma de cada tipo, insuficiente para comprobar "sin excepción" a lo
// largo de varios turnos.
//
// La voz esperada de cada nave se compara contra un valor conocido de
// antemano (jugador = "chispa", rival por defecto La Contable =
// "la-contable" -- ver vozDelJugador/vozDeNave en bancoBromas.ts), no
// contra el resultado de llamar a vozDeNave: reutilizar la misma función
// para comprobarla sería exactamente la clase de test circular que esta
// flota ya tuvo con un destino seguro (ver CLAUDE.md, proy-3).
//
// La categoría se contrasta contra los eventos reales solo para
// "autoimpacto" y "proyectil-perdido": son tipos de evento discretos y
// propios (evento.tipo), así que la comprobación es exacta en las dos
// direcciones. Para las otras cinco categorías (acierto, casi,
// fallo-lejano, impacto-planeta, impacto-escombro) no hay una señal
// igual de limpia en EventoSimulacion sin reconstruir el resultado físico
// completo (el evento "impacto" lleva `objetivo` fijo al rival SIEMPRE,
// haya tocado su casco o no, así que no basta para distinguir "acierto" de
// "casi"): esas cinco quedan cubiertas por hum-4, que sí fabrica cada
// categoría contra el resolutor real y el rastreador de casco.
//
// ?mapa=calma-de-los-restos (suelo plano, deriva 0), no modo espacial real:
// a diferencia de imp-11, aquí el modo de mapa no es el objeto del
// criterio (la broma reacciona a la MISMA categoría/voz sea cual sea el
// terreno) y dispararRafagaTurbo solo apunta con calcularSolucionBalistica
// (fórmula cerrada de suelo plano, ver su comentario en Partida.ts): en
// modo espacial real no hay solución cerrada, el ángulo/potencia que
// calcula no tiene sentido bajo gravedad multipozo y el proyectil puede no
// aterrizar nunca -- comprobado en la práctica (la ráfaga se queda
// colgada). Mismo motivo por el que proy-4 y proy-5, los únicos dos usos
// previos de dispararRafagaTurbo, ya usan este mismo mapa.
test("hum-1: en diez turnos reales, cada disparo y cada impacto tienen broma atribuida a la nave y la categoría reales", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/?mapa=calma-de-los-restos");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  const NUMERO_DE_TURNOS = 10;
  await page.evaluate((n) => window.__debug.dispararRafagaTurbo!(n), NUMERO_DE_TURNOS);
  await page.waitForFunction(
    (n) => (window.__debug.historialBromas?.length ?? 0) >= n,
    NUMERO_DE_TURNOS,
  );

  const historial = await page.evaluate(() => window.__debug.historialBromas);
  expect(historial).toBeDefined();
  expect(historial!.length).toBeGreaterThanOrEqual(NUMERO_DE_TURNOS);

  // RIVAL_POR_DEFECTO en Partida.ts es LA_CONTABLE: sin selector de rival en
  // este flujo (solo se pulsa "boton-jugar"), la nave 1 siempre es
  // "la-contable" y la nave 0 (jugador) toma vozDelJugador("la-contable"),
  // que es "chispa" -- fijo y conocido de antemano, no recalculado aquí.
  const VOZ_ESPERADA_POR_NAVE: Record<number, string> = {
    0: "chispa",
    1: "la-contable",
  };
  const CATEGORIAS_VALIDAS = [
    "acierto",
    "casi",
    "fallo-lejano",
    "autoimpacto",
    "impacto-planeta",
    "impacto-escombro",
    "proyectil-perdido",
  ];

  for (const entrada of historial!.slice(0, NUMERO_DE_TURNOS)) {
    // Sin excepción: las dos frases existen y no están vacías.
    expect(entrada.textoDisparo, `turno ${entrada.numeroTurno}: sin broma de disparo`).not.toBeNull();
    expect(entrada.textoDisparo!.length).toBeGreaterThan(0);
    expect(entrada.textoImpacto.length, `turno ${entrada.numeroTurno}: sin broma de impacto`).toBeGreaterThan(0);
    expect(CATEGORIAS_VALIDAS).toContain(entrada.categoria);

    // La nave que disparó determina la voz -- contra el valor fijo de
    // arriba, no contra vozDeNave.
    const vozEsperada = VOZ_ESPERADA_POR_NAVE[entrada.tirador];
    expect(entrada.voz, `turno ${entrada.numeroTurno}: voz de la nave ${entrada.tirador}`).toBe(vozEsperada);

    // La frase mostrada sale del banco de ESA voz (y, para el impacto, de
    // ESA categoría), no de otra: esto es lo que se podía intercambiar sin
    // que ningún test lo notara.
    expect(bancoDisparoDe(entrada.voz as Parameters<typeof bancoDisparoDe>[0])).toContain(entrada.textoDisparo);
    expect(
      bancoImpactoDe(
        entrada.voz as Parameters<typeof bancoImpactoDe>[0],
        entrada.categoria as Parameters<typeof bancoImpactoDe>[1],
      ),
    ).toContain(entrada.textoImpacto);

    // La categoría publicada corresponde al resultado real del turno, en
    // las dos direcciones, para los dos tipos de evento discretos y propios
    // que EventoSimulacion expone (ver comentario de cabecera).
    const huboAutoimpacto = entrada.eventos.some((evento) => evento.tipo === "autoimpacto");
    const huboProyectilPerdido = entrada.eventos.some((evento) => evento.tipo === "proyectil-perdido");

    expect(
      huboAutoimpacto,
      `turno ${entrada.numeroTurno}: categoría "autoimpacto" sin evento autoimpacto real`,
    ).toBe(entrada.categoria === "autoimpacto");
    expect(
      huboProyectilPerdido,
      `turno ${entrada.numeroTurno}: categoría "proyectil-perdido" sin evento proyectil-perdido real`,
    ).toBe(entrada.categoria === "proyectil-perdido");
  }
});
