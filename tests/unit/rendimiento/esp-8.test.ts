import { test } from "node:test";
import assert from "node:assert/strict";
import type Phaser from "phaser";
import { generarSistema } from "@/sim/sistema/generador";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { detenerseEnSuelo } from "@/sim/armas/resolver";
import { PASO_FIJO_MS } from "@/sim/tiempo";

// esp-8 (camino crítico): sustituto sin GPU de render-3/esp-7 -- el runner de
// CI (ubuntu-latest) no tiene GPU real, así que aquí se presupuesta el coste
// de CPU de la simulación y la preparación del dibujado por fotograma
// (AnimadorProyectil.actualizar: paso físico con gravedad de N cuerpos más
// setPosition del sprite) directamente con hrtime, sin navegador de por
// medio. El peor caso del diseño (6 planetas, 2 anillos, 40 asteroides) se
// construye con ParametrosForzados para no depender de encontrar una
// semilla con suerte.
function crearEscenaDeMentira(): Phaser.Scene {
  const punto = {
    setVisible: () => punto,
    setDepth: () => punto,
    setPosition: () => punto,
  };
  return { add: { circle: () => punto } } as unknown as Phaser.Scene;
}

const MUNDO_ANCHO = 1920;
const MUNDO_ALTO = 1080;
const NUM_FOTOGRAMAS = 600;
const P95_MAXIMO_MS = 8;

test("esp-8: coste de simulación+draw-prep por fotograma en el peor caso (6 planetas, 2 anillos, 40 asteroides) tiene p95 < 8ms en 600 fotogramas", () => {
  const sistema = generarSistema(20260926, MUNDO_ANCHO, MUNDO_ALTO, {
    numPlanetas: 6,
    numAnillos: 2,
    numAsteroides: 40,
  });
  assert.equal(sistema.planetas.length, 6);
  assert.equal(sistema.anillos.length, 2);
  assert.equal(sistema.asteroides.length, 40);

  // Origen dentro del corredor de aire superior (nunca toca un planeta por
  // construcción) con velocidad mínima: el objetivo no es un vuelo concreto
  // sino mantener el proyectil EN VUELO durante los 600 fotogramas medidos,
  // que es justo cuando se paga el coste por fotograma que este criterio
  // presupuesta -- un aterrizaje a mitad de medición dejaría de ejercer el
  // caso caro antes de completar la muestra.
  const detenerse = detenerseEnSuelo(sistema.mascara, MUNDO_ANCHO, MUNDO_ALTO);
  const inicial = crearProyectil(MUNDO_ANCHO / 2, 45, 5, -1);
  const animador = new AnimadorProyectil(crearEscenaDeMentira());
  animador.iniciar(inicial, 0, 0, detenerse, () => {}, sistema.planetas);

  const duracionesMs: number[] = [];
  for (let i = 0; i < NUM_FOTOGRAMAS; i++) {
    if (!animador.enVuelo()) break;
    const inicio = process.hrtime.bigint();
    animador.actualizar(PASO_FIJO_MS);
    const fin = process.hrtime.bigint();
    duracionesMs.push(Number(fin - inicio) / 1e6);
  }

  assert.ok(
    duracionesMs.length === NUM_FOTOGRAMAS,
    `el vuelo terminó antes de completar la muestra (${duracionesMs.length} de ${NUM_FOTOGRAMAS} fotogramas medidos)`,
  );

  duracionesMs.sort((a, b) => a - b);
  const indiceP95 = Math.floor(duracionesMs.length * 0.95);
  const p95 = duracionesMs[indiceP95];

  assert.ok(p95 < P95_MAXIMO_MS, `p95 de ${p95.toFixed(3)}ms supera el presupuesto de ${P95_MAXIMO_MS}ms`);
});
