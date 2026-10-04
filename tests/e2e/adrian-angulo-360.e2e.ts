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

  // Coloca primero al jugador (nave 0) en un punto con margen de sobra por
  // debajo (el tamaño de mundo depende del contenedor real renderizado, así
  // que no se puede asumir que la colocación aleatoria del sistema deje a
  // la nave 0 lejos del borde inferior) y luego busca al rival (nave 1)
  // debajo de ese punto, con una banda horizontal amplia en vez de una
  // columna estrecha, para no depender de que una franja concreta de 40 px
  // esté libre en una semilla o geometría concretas.
  //
  // adrian-angulo-360 (corrección): un único candidato de altura para el
  // jugador (el cuarto superior) fallaba de verdad en CI -- el sistema
  // planetario que colocarNaves acaba usando no es siempre el de la semilla
  // base (puede regenerarse hasta MAX_REGENERACIONES_SISTEMA veces si la
  // colocación inicial no es viable), así que la franja libre a esa altura
  // exacta no está garantizada para ningún sistema concreto. Se prueban
  // varias alturas candidatas, de arriba abajo, hasta que una tenga hueco
  // para el jugador Y para el rival por debajo.
  const destino = await page.evaluate(() => {
    const mundo = window.__debug.mundo!;
    const libre = (x: number, y: number, yMin: number): boolean => {
      if (x <= 0 || x >= mundo.ancho - 1 || y <= yMin || y >= mundo.alto - 1) return false;
      if (window.__debug.terreno!.esSolido(x, y)) return false;
      for (const planeta of window.__debug.planetas ?? []) {
        if (Math.hypot(x - planeta.cx, y - planeta.cy) < planeta.radio + 40) return false;
      }
      return true;
    };

    const buscarPuntoLibre = (y: number, yMin: number): { x: number; y: number } | null => {
      for (let dx = 0; dx <= mundo.ancho / 2; dx += 20) {
        for (const x of dx === 0 ? [mundo.ancho / 2] : [mundo.ancho / 2 + dx, mundo.ancho / 2 - dx]) {
          if (libre(x, y, yMin)) return { x, y };
        }
      }
      return null;
    };

    const buscarRivalDebajo = (puntoJugador: { x: number; y: number }): { x: number; y: number; distancia: number } | null => {
      for (let distancia = 80; distancia <= mundo.alto - puntoJugador.y; distancia += 20) {
        for (let dx = 0; dx <= mundo.ancho / 2; dx += 20) {
          for (const deltaX of dx === 0 ? [0] : [dx, -dx]) {
            const x = puntoJugador.x + deltaX;
            const y = puntoJugador.y + distancia;
            if (libre(x, y, puntoJugador.y)) return { x, y, distancia };
          }
        }
      }
      return null;
    };

    // adrian-angulo-360 (segunda corrección): ni siquiera un puñado de
    // fracciones de altura candidatas está garantizado -- el tamaño real
    // del mundo depende del contenedor DOM tal como lo mide
    // configurarTamanoMundo (encuadre-movil), que no es 1920x1080 ni ningún
    // valor fijo asumible desde el test. En vez de adivinar alturas,
    // se recorre TODA la altura del mundo con un paso denso (barato: cada
    // intento es, como mucho, un centenar de comprobaciones de libre()) y
    // se usa la primera que tenga hueco para el jugador Y para el rival por
    // debajo -- de arriba abajo, porque cuanto más arriba el jugador, más
    // margen queda por debajo para el rival.
    const PASO_Y_BUSQUEDA = 15;
    for (let yJugador = 40; yJugador < mundo.alto - 1; yJugador += PASO_Y_BUSQUEDA) {
      const puntoJugador = buscarPuntoLibre(yJugador, 0);
      if (!puntoJugador) continue;
      const rival = buscarRivalDebajo(puntoJugador);
      if (!rival) continue;
      window.__debug.forzarPosicionNave!(0, puntoJugador.x, puntoJugador.y);
      window.__debug.forzarPosicionNave!(1, rival.x, rival.y);
      return rival;
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
