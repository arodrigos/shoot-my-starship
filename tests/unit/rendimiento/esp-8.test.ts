import "../../entorno-phaser.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import type Phaser from "phaser";
import { generarSistema } from "@/sim/sistema/generador";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { detenerseEnSuelo } from "@/sim/armas/resolver";
import { PASO_FIJO_MS } from "@/sim/tiempo";
import { efectosRegistrados } from "@/juego/efectos/registroEfectos";
import { calcularPrevisualizacion } from "@/sim/armas/previsualizacion";
import { buscarArma } from "@/sim/armas/catalogo";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS } from "@/juego/control/apuntado";

// esp-8 (camino crítico): sustituto sin GPU de render-3/esp-7 -- el runner de
// CI (ubuntu-latest) no tiene GPU real, así que aquí se presupuesta el coste
// de CPU de la simulación y la preparación del dibujado por fotograma
// (AnimadorProyectil.actualizar: paso físico con gravedad de N cuerpos más
// setPosition del sprite) directamente con hrtime, sin navegador de por
// medio. El peor caso del diseño (6 planetas, 2 anillos, 40 asteroides) se
// construye con ParametrosForzados para no depender de encontrar una
// semilla con suerte.
//
// pre-2: además del vuelo, se paga el mismo barrido que un
// Phaser.GameObjects.Particles.ParticleEmitter real hace en su update() --
// recorrer sus partículas vivas y mover cada una -- a la escala que declara
// REGISTRO_EFECTOS para CADA efecto registrado, a su techo. Así el
// presupuesto mide de verdad el peor caso (vuelo + todos los efectos a
// tope), y un efecto futuro que suba su techo en el registro sube este
// coste sin que nadie tenga que acordarse de editar este test a mano.
interface ParticulaSimulada {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
}

function crearParticulasAlTechoDelRegistro(): ParticulaSimulada[] {
  const particulas: ParticulaSimulada[] = [];
  for (const efecto of efectosRegistrados()) {
    for (let i = 0; i < efecto.techoParticulas; i++) {
      particulas.push({ x: 0, y: 0, vx: 1, vy: -1, vida: 1 });
    }
  }
  return particulas;
}

function actualizarParticulasSimuladas(particulas: readonly ParticulaSimulada[], pasoMs: number): void {
  for (const particula of particulas) {
    particula.x += particula.vx * pasoMs;
    particula.y += particula.vy * pasoMs;
    particula.vida -= pasoMs / 1000;
  }
}
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

const MUNDO_ANCHO = 1920;
const MUNDO_ALTO = 1080;
const NUM_FOTOGRAMAS = 600;
const P95_MAXIMO_MS = 8;

test("esp-8: coste de simulación+draw-prep por fotograma en el peor caso (6 planetas, 2 anillos, 40 asteroides, todos los efectos del registro a su techo) tiene p95 < 8ms en 600 fotogramas", () => {
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
  const particulas = crearParticulasAlTechoDelRegistro();
  assert.ok(particulas.length > 0, "el registro de efectos está vacío: pre-2 no está ejerciendo nada");

  const duracionesMs: number[] = [];
  for (let i = 0; i < NUM_FOTOGRAMAS; i++) {
    if (!animador.enVuelo()) break;
    const inicio = process.hrtime.bigint();
    animador.actualizar(PASO_FIJO_MS);
    actualizarParticulasSimuladas(particulas, PASO_FIJO_MS);
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

// prevision-real (pvr-3, camino crítico): la mira se recalcula cada
// fotograma mientras se arrastra el control de ángulo o de potencia -- y a
// diferencia del vuelo+efectos de arriba, eso ocurre SIN proyectil en vuelo
// (jugable == true es, por construcción, "sin animación en curso"), así que
// es un presupuesto propio, no una suma sobre el de arriba. Se cubren las
// cuatro ramas de comportamiento que calcularPrevisualizacion trata
// distinto (impacto-simple, erratico, mecha, adherente-con-mecha) con un
// arma real del catálogo cada una, sobre el mismo peor sistema (6 planetas,
// 2 anillos, 40 asteroides) que el resto de esp-8.
const ARMAS_REPRESENTATIVAS_PREVISUALIZACION = [
  "pepinazo-cortesia",
  "mosca-cojonera",
  "granada-de-espoleta",
  "gancho-pegajoso",
] as const;

test("esp-8 (pvr-3, camino crítico): recalcular la previsualización cada fotograma cambiando el ángulo tiene p95 < 8ms en el peor sistema, para cada comportamiento de vuelo del catálogo", () => {
  const sistema = generarSistema(20260926, MUNDO_ANCHO, MUNDO_ALTO, {
    numPlanetas: 6,
    numAnillos: 2,
    numAsteroides: 40,
  });

  for (const armaId of ARMAS_REPRESENTATIVAS_PREVISUALIZACION) {
    const arma = buscarArma(armaId);
    // mos-1/pvr-3: el mismo EstadoAleatorio hilvanado se reutiliza en TODAS
    // las lecturas, nunca se hilvana de vuelta -- exactamente como hace
    // Partida.ts al leer estado.aleatorio cada fotograma mientras se apunta.
    const aleatorio = crearEstadoAleatorio(99);
    const duracionesMs: number[] = [];

    for (let i = 0; i < NUM_FOTOGRAMAS; i++) {
      // Simula el barrido completo de un arrastre real de ángulo, un grado
      // distinto cada fotograma, dentro del rango que expone el control.
      const anguloGrados = ANGULO_MINIMO_GRADOS + (i % Math.floor(ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS));
      const inicio = process.hrtime.bigint();
      calcularPrevisualizacion({
        mascara: sistema.mascara,
        gravedad: 1,
        deriva: 0,
        ancho: MUNDO_ANCHO,
        alto: MUNDO_ALTO,
        planetas: sistema.planetas,
        origenX: MUNDO_ANCHO / 2,
        origenY: 45,
        anguloGrados,
        potencia: 70,
        comportamiento: arma.comportamiento,
        aleatorio,
      });
      const fin = process.hrtime.bigint();
      duracionesMs.push(Number(fin - inicio) / 1e6);
    }

    duracionesMs.sort((a, b) => a - b);
    const indiceP95 = Math.floor(duracionesMs.length * 0.95);
    const p95 = duracionesMs[indiceP95];

    assert.ok(
      p95 < P95_MAXIMO_MS,
      `${armaId}: p95 de ${p95.toFixed(3)}ms de recalcular la previsualización supera el presupuesto de ${P95_MAXIMO_MS}ms`,
    );
  }
});
