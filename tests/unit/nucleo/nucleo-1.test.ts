import { test } from "node:test";
import assert from "node:assert/strict";
import { crearProyectil, integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { acumuladorInicial, avanzarConAcumulador, PASO_FIJO_MS } from "@/sim/tiempo";

const GRAVEDAD = 1.15;
const DERIVA = 140;
const SUELO_Y = 1000;

// Mismos deltas "reales" que un requestAnimationFrame entregaría: 16,6 ms es
// 60 fps constante; la secuencia irregular es lo que se ve en un móvil bajo
// carga variable, sin ningún patrón limpio. Los dos suman exactamente el
// mismo tiempo total cuando se recortan a totalMs (ver avanzarTiempoTotal):
// eso es lo que hace comparable el resultado, no el número de llamadas.
const DELTAS_CONSTANTES = [1000 / 60];
const DELTAS_IRREGULARES = [8, 33, 50, 12, 41];

// Margen para el recorte del último trozo: 1000/60 es un decimal periódico,
// y sumarlo N veces con += no da bit a bit lo mismo que N * (1000/60). Sin
// este margen, ese redondeo deja el recorte una micra por debajo de
// PASO_FIJO_MS y el acumulador se traga un paso entero de menos -- justo el
// no-determinismo que este test existe para descartar.
const EPSILON_MS = 1e-6;

// Compara el estado tras exactamente totalMs de tiempo transcurrido,
// repartido en trozos de tamaño distinto según deltasMs. El acumulador
// garantiza que solo importa la suma acumulada, no cómo se trocea -- por
// eso se recorta el último trozo para no pasarse de totalMs, que si no
// invalidaría la comparación entre patrones.
function avanzarTiempoTotal(
  inicial: EstadoProyectil,
  totalMs: number,
  deltasMs: readonly number[],
): EstadoProyectil {
  const pasoS = PASO_FIJO_MS / 1000;
  const paso = (p: EstadoProyectil) => integrarPasoProyectil(p, GRAVEDAD, DERIVA, pasoS);

  let proyectil = inicial;
  let acumulador = acumuladorInicial();
  let transcurrido = 0;
  let indice = 0;

  while (totalMs - transcurrido > EPSILON_MS) {
    const delta = Math.min(deltasMs[indice % deltasMs.length], totalMs - transcurrido + EPSILON_MS);
    indice++;
    transcurrido += delta;
    const resultado = avanzarConAcumulador(proyectil, acumulador, delta, paso);
    proyectil = resultado.estado;
    acumulador = resultado.acumulador;
  }

  return proyectil;
}

// Tiempo total (en pasos fijos) que tarda este disparo en llegar al suelo,
// calculado con simularVuelo -- la misma resolución que usa avanzar() en
// producción, sin acumulador, como referencia de "cuánto dura el vuelo".
function totalMsHastaElSuelo(inicial: EstadoProyectil): number {
  const { pasos } = simularVuelo(inicial, GRAVEDAD, DERIVA, (p) => p.y >= SUELO_Y);
  return pasos * PASO_FIJO_MS;
}

test("nucleo-1: el mismo disparo aterriza en el mismo punto con deltas constantes e irregulares", () => {
  const inicial = crearProyectil(200, 500, 600, -520);
  const totalMs = totalMsHastaElSuelo(inicial);

  const conConstantes = avanzarTiempoTotal(inicial, totalMs, DELTAS_CONSTANTES);
  const conIrregulares = avanzarTiempoTotal(inicial, totalMs, DELTAS_IRREGULARES);

  assert.ok(
    Math.abs(conConstantes.x - conIrregulares.x) <= 0.5,
    `x difiere más de 0,5px: ${conConstantes.x} vs ${conIrregulares.x}`,
  );
  assert.ok(
    Math.abs(conConstantes.y - conIrregulares.y) <= 0.5,
    `y difiere más de 0,5px: ${conConstantes.y} vs ${conIrregulares.y}`,
  );
});

test("nucleo-1: el patrón de deltas no cambia el resultado para varias combinaciones de ángulo y potencia", () => {
  const casos: [number, number][] = [
    [700, -300],
    [900, -900],
    [-500, -700],
    [300, -1200],
  ];

  for (const [vx, vy] of casos) {
    const inicial = crearProyectil(500, 400, vx, vy);
    const totalMs = totalMsHastaElSuelo(inicial);

    const a = avanzarTiempoTotal(inicial, totalMs, DELTAS_CONSTANTES);
    const b = avanzarTiempoTotal(inicial, totalMs, DELTAS_IRREGULARES);
    assert.ok(Math.abs(a.x - b.x) <= 0.5, `caso vx=${vx},vy=${vy}: x difiere ${a.x} vs ${b.x}`);
    assert.ok(Math.abs(a.y - b.y) <= 0.5, `caso vx=${vx},vy=${vy}: y difiere ${a.y} vs ${b.y}`);
  }
});
