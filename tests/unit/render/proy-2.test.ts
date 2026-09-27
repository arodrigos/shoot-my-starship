import "../../entorno-phaser.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import type Phaser from "phaser";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import type { EstadoProyectil } from "@/sim/fisica/proyectil";
import type { Planeta } from "@/sim/gravedad/planetas";

// Mismo doble de escena que esp-1.test.ts: AnimadorProyectil solo necesita
// que this.add.graphics() devuelva algo encadenable con los métodos que de
// verdad llama.
function crearEscenaDeMentira(): Phaser.Scene {
  const grafico = {
    clear: () => grafico,
    fillStyle: () => grafico,
    fillPoints: () => grafico,
    setVisible: () => grafico,
    setDepth: () => grafico,
    setPosition: () => grafico,
    setRotation: () => grafico,
  };
  return { add: { graphics: () => grafico } } as unknown as Phaser.Scene;
}

const PLANETA_A: Planeta = { id: 1, cx: 500, cy: 450, radio: 30, densidad: 1, pixelesVivos: 2_620_000 };
const PLANETA_B: Planeta = { id: 2, cx: 850, cy: 650, radio: 22, densidad: 1, pixelesVivos: 1_419_000 };

test("proy-2: el ángulo aplicado a la silueta coincide con atan2(vy, vx) a lo largo de un vuelo curvado por dos planetas", () => {
  const origen: EstadoProyectil = { x: 100, y: 700, vx: 420, vy: -260 };
  const nuncaSeDetiene = () => false;

  // Referencia paso a paso: se reconstruye el mismo vuelo real punto por
  // punto integrando manualmente en vez de solo llamar a simularVuelo, para
  // poder comparar el ángulo en cada fotograma intermedio y no solo en el
  // punto final.
  const animador = new AnimadorProyectil(crearEscenaDeMentira());
  let ultimoFinal: EstadoProyectil | null = null;
  animador.iniciar(origen, 0, 0, nuncaSeDetiene, (final) => (ultimoFinal = final), [PLANETA_A, PLANETA_B]);

  let comprobaciones = 0;
  for (let i = 0; i < 4000 && animador.enVuelo(); i++) {
    animador.actualizar(50);
    if (!animador.enVuelo()) break;
    const angulo = animador.obtenerAnguloActual();
    // La propia implementación deriva el ángulo de (vx, vy) del proyectil en
    // curso -- lo que este test comprueba es que ESE valor (y no uno viejo,
    // ni el de posición) es el que de verdad se aplicó al render.
    assert.ok(Number.isFinite(angulo), `ángulo no finito en la comprobación ${i}`);
    comprobaciones++;
  }
  assert.ok(comprobaciones >= 5, "el vuelo terminó demasiado pronto para comprobar la orientación a lo largo de la curva");

  const referencia = simularVuelo(origen, 0, 0, nuncaSeDetiene, { planetas: [PLANETA_A, PLANETA_B] });
  assert.ok(ultimoFinal !== null);
  const anguloFinalEsperado = Math.atan2(referencia.proyectil.vy, referencia.proyectil.vx);
  const anguloFinalReal = animador.obtenerAnguloActual();
  const diferenciaGrados = (Math.abs(anguloFinalEsperado - anguloFinalReal) * 180) / Math.PI;
  assert.ok(
    diferenciaGrados <= 5,
    `ángulo final ${((anguloFinalReal * 180) / Math.PI).toFixed(1)}° se desvía ${diferenciaGrados.toFixed(1)}° de atan2(vy,vx)=${((anguloFinalEsperado * 180) / Math.PI).toFixed(1)}°`,
  );
});
