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
import { SuperficieEspacio, type GeometriaPlaneta } from "@/juego/terreno/SuperficieEspacio";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";

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
  const escena = crearEscenaDeMentira();
  let animador = new AnimadorProyectil(escena);
  animador.iniciar(inicial, 0, 0, detenerse, () => {}, sistema.planetas);
  const particulas = crearParticulasAlTechoDelRegistro();
  assert.ok(particulas.length > 0, "el registro de efectos está vacío: pre-2 no está ejerciendo nada");

  // gravedad-calibracion: con CONSTANTE_GRAVITACIONAL en 1200 (antes 6), NO
  // existe ningún punto del mundo donde un proyectil se quede en vuelo 10s
  // reales sin ser arrastrado a tierra -- la propia calibración exige que
  // caer sea rápido (gravedad-calibracion-1). El coste por fotograma que
  // este criterio presupuesta (N cuerpos + draw-prep) no depende de CUÁNTO
  // lleva volando el proyectil, solo de que haya 6 planetas que sumar cada
  // paso -- así que, al aterrizar, se relanza el mismo vuelo desde el
  // mismo origen en vez de exigir una física imposible con los valores
  // nuevos.
  const duracionesMs: number[] = [];
  for (let i = 0; i < NUM_FOTOGRAMAS; i++) {
    if (!animador.enVuelo()) {
      animador = new AnimadorProyectil(escena);
      animador.iniciar(inicial, 0, 0, detenerse, () => {}, sistema.planetas);
    }
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

// crateres-y-escombros (crt-3): el borde quemado añade un barrido por vecinos
// (clasificarPixelVisual) a los dos caminos de dibujo de terreno que antes
// eran O(1) por píxel -- este presupuesto existe para que ese coste nuevo no
// se cuele sin que nadie lo mida. Doble de CanvasTexture con el mismo
// contrato que SuperficieEspacio usa de verdad (fillRect/clearRect en el
// camino de impacto, createImageData/putImageData solo en la pasada
// completa), sin canvas real -- igual que crearEscenaDeMentira de arriba,
// aquí no hace falta pintar de verdad para medir el coste de CPU.
function crearTexturaDeMentira(ancho: number, alto: number): Phaser.Textures.CanvasTexture {
  const contexto = {
    fillStyle: "",
    fillRect: () => {},
    clearRect: () => {},
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {},
  };
  return { context: contexto, width: ancho, height: alto, update: () => {} } as unknown as Phaser.Textures.CanvasTexture;
}

test("esp-8 (crt-3, camino crítico): pintarCompleta del peor sistema tiene coste acotado (una sola pasada, nunca por fotograma)", () => {
  const sistema = generarSistema(20260926, MUNDO_ANCHO, MUNDO_ALTO, {
    numPlanetas: 6,
    numAnillos: 2,
    numAsteroides: 40,
  });
  const geometrias = new Map<number, GeometriaPlaneta>(
    sistema.planetas.map((planeta) => [planeta.id, { cx: planeta.cx, cy: planeta.cy, radio: planeta.radio }]),
  );
  const superficie = new SuperficieEspacio(crearTexturaDeMentira(MUNDO_ANCHO, MUNDO_ALTO), geometrias);

  const inicio = process.hrtime.bigint();
  superficie.pintarCompleta(sistema.mascara);
  const duracionMs = Number(process.hrtime.bigint() - inicio) / 1e6;

  // Presupuesto generoso (no es un coste por fotograma, se paga una vez al
  // generar el mapa): solo existe para detectar una regresión gruesa, no
  // para presupuestar al milisegundo -- medido en ~300ms en CI, el margen
  // es amplio a propósito para no ser un test intermitente por carga de la
  // máquina (issue #151).
  assert.ok(duracionMs < 1000, `pintarCompleta tardó ${duracionMs.toFixed(1)}ms, por encima del presupuesto de 1000ms`);
});

test("esp-8 (crt-3, camino crítico): refrescar el rectángulo de un impacto, con el planeta ya muy dañado, tiene p95 < 8ms", () => {
  const sistema = generarSistema(20260926, MUNDO_ANCHO, MUNDO_ALTO, {
    numPlanetas: 6,
    numAnillos: 2,
    numAsteroides: 40,
  });
  const geometrias = new Map<number, GeometriaPlaneta>(
    sistema.planetas.map((planeta) => [planeta.id, { cx: planeta.cx, cy: planeta.cy, radio: planeta.radio }]),
  );
  const superficie = new SuperficieEspacio(crearTexturaDeMentira(MUNDO_ANCHO, MUNDO_ALTO), geometrias);
  const planeta = sistema.planetas[0];

  // "Terreno muy dañado": acribilla el primer planeta de cráteres solapados
  // ANTES de medir, para que el barrido de vecinos del bloque tenga que
  // cruzar de verdad muchos bordes quemados, no un disco intacto.
  for (let i = 0; i < 60; i++) {
    const anguloRad = (i * 137) % 360 * (Math.PI / 180);
    const distancia = (i * 7) % Math.max(1, planeta.radio - 10);
    const cx = planeta.cx + Math.cos(anguloRad) * distancia;
    const cy = planeta.cy + Math.sin(anguloRad) * distancia;
    aplicarHuellaCircular(sistema.mascara, cx, cy, 8, "restar");
  }

  const duracionesMs: number[] = [];
  for (let i = 0; i < 100; i++) {
    const anguloRad = (i * 53) % 360 * (Math.PI / 180);
    const cx = planeta.cx + Math.cos(anguloRad) * (planeta.radio * 0.5);
    const cy = planeta.cy + Math.sin(anguloRad) * (planeta.radio * 0.5);
    const rectangulo = aplicarHuellaCircular(sistema.mascara, cx, cy, 15, "restar");

    const inicio = process.hrtime.bigint();
    superficie.refrescarRectangulo(sistema.mascara, rectangulo);
    duracionesMs.push(Number(process.hrtime.bigint() - inicio) / 1e6);
  }

  duracionesMs.sort((a, b) => a - b);
  const p95 = duracionesMs[Math.floor(duracionesMs.length * 0.95)];

  assert.ok(p95 < P95_MAXIMO_MS, `refrescarRectangulo en terreno muy dañado: p95 de ${p95.toFixed(3)}ms supera el presupuesto de ${P95_MAXIMO_MS}ms`);
});
