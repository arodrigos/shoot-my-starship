import { test, expect } from "@playwright/test";

// render-2: tras una partida guionizada de 10 turnos reales (con
// explosiones de verdad, misma avanzar() que un jugador), máscara y textura
// deben seguir coincidiendo en un muestreo amplio -- el mismo contrato de
// terreno-3, pero después de que el terreno ya no sea el inicial -- y cada
// nave renderizada debe seguir apoyada en la superficie de la máscara
// actual, no en la del turno 0.
test("tras una partida guionizada de 10 turnos, terreno y naves renderizados coinciden con el estado", async ({
  page,
}) => {
  await page.goto("/?mapa=desguace-del-ecuador");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true);

  await page.evaluate(() => window.__debug.jugarTurnosGuionizados!(10));

  const MUNDO_ANCHO = 1920;
  const MUNDO_ALTO = 1080;
  const NUM_PUNTOS = 2000;

  const resultados = await page.evaluate(
    ({ ancho, alto, numeroDePuntos }) => {
      let estado = 13371337;
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

  const naves = await page.evaluate(() => window.__debug.naves);
  expect(naves).toHaveLength(2);

  // Cada nave debe estar apoyada exactamente sobre la superficie de la
  // máscara actual: sólido justo debajo, aire justo encima -- si el render
  // arrastrase la posición del turno 0 (el bug de referencia congelada que
  // corrigió este mismo bloque, ver desviaciones), esta comprobación fallaría
  // en cuanto una explosión cambiase el perfil bajo alguna de las dos naves.
  const apoyos = await page.evaluate(
    (navesLeidas) =>
      navesLeidas!.map((nave) => ({
        solidoDebajo: window.__debug.terreno!.esSolido(Math.round(nave.x), Math.round(nave.y) + 1),
        aireEncima: !window.__debug.terreno!.esSolido(Math.round(nave.x), Math.round(nave.y) - 2),
      })),
    naves,
  );

  for (const apoyo of apoyos) {
    expect(apoyo.solidoDebajo).toBe(true);
    expect(apoyo.aireEncima).toBe(true);
  }
});
