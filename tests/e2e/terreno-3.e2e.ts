import { test, expect } from "@playwright/test";

// terreno-3: tras aplicar el guion de huellas de la escena de pruebas,
// máscara y textura deben coincidir en todos los puntos muestreados, con una
// única lectura del lienzo (comprobarPuntos hace un solo getImageData, ver
// exponerTerreno.ts). Se espera a `listo` en vez de a un timeout fijo
// (issue #151): el guion de 200 huellas tarda lo que tarde en cada máquina.
test("máscara y textura del terreno coinciden tras aplicar el guion de huellas", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true);

  const MUNDO_ANCHO = 1920;
  const MUNDO_ALTO = 1080;
  const NUM_PUNTOS = 5000;

  const resultados = await page.evaluate(
    ({ ancho, alto, numeroDePuntos }) => {
      // PRNG determinista dentro de la propia página: no depende de
      // Math.random del proceso de test ni del núcleo de simulación, solo
      // necesita ser reproducible para poder depurar un fallo si aparece.
      let estado = 987654321;
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
