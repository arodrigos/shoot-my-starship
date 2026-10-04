import { test, expect } from "@playwright/test";
import { arrastrarBarraHasta } from "./utilesControl";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";

function fraccionDeAngulo(grados: number): number {
  return (grados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
}

function fraccionDePotencia(porcentaje: number): number {
  return (porcentaje - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);
}

// adrian-angulo-360 (camino crítico): feedback real de Adrián tras probar
// dev -- si el rival queda justo por debajo del tirador (una colocación
// real en el hito espacial, donde no hay "suelo" que garantice que el
// rival esté siempre por encima), el límite viejo de 2°-178° (siempre hacia
// arriba) hacía la partida injugable. Aquí se fuerza esa geometría de forma
// determinista (forzarPosicionNave, solo-test) y se comprueba que un solo
// control, girando por debajo del horizonte, encuentra un disparo real que
// hace daño.
test("el jugador apunta en los 360°: un rival justo debajo se puede alcanzar con el control de ángulo", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.naves !== undefined);
  if (await page.getByTestId("ayuda-cerrar").isVisible()) {
    await page.getByTestId("ayuda-cerrar").click();
  }

  expect(await page.evaluate(() => window.__debug.modoEspacial)).toBe(true);

  // Coloca al rival (nave 1) justo debajo del jugador (nave 0): misma x,
  // la primera y libre (sin terreno ni planeta de por medio) por debajo de
  // la del jugador. No se asume ninguna semilla concreta: se busca con el
  // mismo terreno/planetas reales de esta partida.
  const destino = await page.evaluate(() => {
    const jugador = window.__debug.naves!.find((nave) => nave.id === 0)!;
    const mundo = window.__debug.mundo!;
    const libre = (x: number, y: number): boolean => {
      if (x <= 0 || x >= mundo.ancho - 1 || y <= jugador.y || y >= mundo.alto - 1) return false;
      if (window.__debug.terreno!.esSolido(x, y)) return false;
      for (const planeta of window.__debug.planetas ?? []) {
        if (Math.hypot(x - planeta.cx, y - planeta.cy) < planeta.radio + 40) return false;
      }
      return true;
    };
    // "Justo debajo" admite un pequeño margen horizontal (menos de medio
    // radio de casco) para no depender de que la columna exacta del
    // jugador esté libre en una semilla concreta -- el disparo sigue
    // siendo mayoritariamente vertical (hacia abajo), nunca lateral.
    for (let distancia = 80; distancia <= mundo.alto; distancia += 20) {
      for (const deltaX of [0, 10, -10, 20, -20]) {
        const x = jugador.x + deltaX;
        const y = jugador.y + distancia;
        if (libre(x, y)) {
          window.__debug.forzarPosicionNave!(1, x, y);
          return { x, y, distancia };
        }
      }
    }
    return null;
  });
  expect(destino, "no se encontró hueco libre por debajo del jugador para esta semilla").not.toBeNull();

  const rivalTrasColocar = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!;
  expect(rivalTrasColocar.y).toBeGreaterThan((await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 0)!.y);

  // Barrido corto alrededor de "recto hacia abajo" (270°, fuera del rango
  // viejo de 2°-178°) y de potencia, sobre el resolutor real -- el mismo
  // patrón de verificación-antes-de-aplicar que imp-11/ia-punteria-6, nunca
  // una condición de parada propia del test.
  const disparo = await page.evaluate(() => {
    const angulos = [260, 265, 270, 275, 280];
    const potencias = [20, 35, 50, 65, 80, 95];
    for (const anguloGrados of angulos) {
      for (const potencia of potencias) {
        const resultado = window.__debug.probarDisparoMultipozoJugador!(anguloGrados, potencia);
        if (resultado.danio > 0) {
          return { anguloGrados, potencia, danio: resultado.danio };
        }
      }
    }
    return null;
  });
  expect(disparo, "ningún ángulo por debajo del horizonte encontró daño real contra el rival colocado debajo").not.toBeNull();
  expect(disparo!.anguloGrados).toBeGreaterThan(180);

  await arrastrarBarraHasta(page, "barra-angulo", fraccionDeAngulo(disparo!.anguloGrados));
  await arrastrarBarraHasta(page, "barra-potencia", fraccionDePotencia(disparo!.potencia));
  await page.waitForFunction(
    (esperado) => Math.abs(window.__debug.control!.ajuste.anguloGrados - esperado) <= 1,
    disparo!.anguloGrados,
  );
  await page.waitForFunction(
    (esperado) => Math.abs(window.__debug.control!.ajuste.potencia - esperado) <= 1,
    disparo!.potencia,
  );

  const integridadRivalAntes = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!.integridad;

  await page.waitForFunction(() => window.__debug.control!.puedeDisparar === true);
  const numeroTurnoAntes = (await page.evaluate(() => window.__debug.numeroTurno)) ?? 0;
  await page.getByTestId("disparar").click();
  await page.waitForFunction((n) => (window.__debug.numeroTurno ?? 0) > n, numeroTurnoAntes, { timeout: 60000 });

  const eventos = await page.evaluate(() => window.__debug.ultimosEventos);
  const impactoRival = eventos?.find(
    (evento) => evento.tipo === "impacto" && evento.objetivo === 1 && evento.danio > 0 && evento.impactoNave === 1,
  );
  expect(impactoRival, "el disparo hacia abajo no aplicó daño real al rival").toBeTruthy();

  const integridadRivalDespues = (await page.evaluate(() => window.__debug.naves))!.find((nave) => nave.id === 1)!.integridad;
  expect(integridadRivalDespues).toBeLessThan(integridadRivalAntes);
});
