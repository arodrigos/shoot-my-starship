import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { detenerseEnSuelo } from "@/sim/armas/resolver";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const ORIGEN_X = 300;
const ORIGEN_Y = 900;
const GRAVEDAD = 1;
const DERIVA = 0;
const MAGNITUD_MOSCA_PX_S2 = 90;

function volarMosca(semilla: number, anguloGrados: number, potencia: number) {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const detenerse = detenerseEnSuelo(mascara, ANCHO, ALTO);
  const rad = (anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(potencia);
  const inicial = crearProyectil(ORIGEN_X, ORIGEN_Y - 26, v * Math.cos(rad), -v * Math.sin(rad));
  return simularVuelo(inicial, GRAVEDAD, DERIVA, detenerse, {
    grabarTrayectoria: true,
    perturbacion: { magnitudPxS2: MAGNITUD_MOSCA_PX_S2, aleatorio: crearEstadoAleatorio(semilla) },
  });
}

// mos-1 (camino crítico): la misma terna (semilla, ángulo, potencia) produce
// una trayectoria idéntica PUNTO A PUNTO -- no solo el mismo impacto final
// (eso ya lo cubre vex-3 para el cimiento), sino cada paso intermedio,
// porque es la trayectoria animada completa la que el jugador ve volar
// (mos-3) y la que decide "cruza N veces" (mos-2).
test("mos-1: la misma terna (semilla, ángulo, potencia) produce una trayectoria idéntica punto a punto, en 200 repeticiones", () => {
  const [solucion] = resolverSolucionesBalisticas(ORIGEN_X, ORIGEN_Y, ORIGEN_X + 900, ORIGEN_Y, GRAVEDAD);
  const referencia = volarMosca(2026, solucion.anguloGrados, solucion.potencia);

  for (let i = 0; i < 200; i++) {
    const repeticion = volarMosca(2026, solucion.anguloGrados, solucion.potencia);
    assert.deepEqual(
      repeticion.trayectoria,
      referencia.trayectoria,
      `repetición ${i}: la trayectoria punto a punto no coincide con la de referencia`,
    );
  }
});

// mos-1: la misma comprobación, pero en un SEGUNDO PROCESO de Node -- nunca
// basta con que dos llamadas en el mismo proceso coincidan si el estado
// hilvanado se filtrara por alguna variable de módulo compartida (el motivo
// real por el que "misma-semilla-mismo-resultado" es una amenaza declarada,
// scripts/comprobar-sin-math-random.mjs). Se compara un hash de la
// trayectoria completa, no solo el punto final.
test("mos-1: la misma terna produce la misma trayectoria en dos procesos distintos", () => {
  const [solucion] = resolverSolucionesBalisticas(ORIGEN_X, ORIGEN_Y, ORIGEN_X + 900, ORIGEN_Y, GRAVEDAD);
  const referencia = volarMosca(4242, solucion.anguloGrados, solucion.potencia);
  const hashReferencia = JSON.stringify(referencia.trayectoria);

  const script = [
    "const { crearProyectil } = require('@/sim/fisica/proyectil');",
    "const { simularVuelo } = require('@/sim/fisica/vuelo');",
    "const { crearEstadoAleatorio } = require('@/sim/aleatorio');",
    "const { detenerseEnSuelo } = require('@/sim/armas/resolver');",
    "const { crearMascaraPlana } = require('../../utils/terrenoPlano');",
    `const mascara = crearMascaraPlana(${ANCHO}, ${ALTO}, 900);`,
    "const detenerse = detenerseEnSuelo(mascara, mascara.ancho, mascara.alto);",
    `const rad = (${solucion.anguloGrados} * Math.PI) / 180;`,
    "const { velocidadDesdePotencia } = require('@/sim/balistica/potencia');",
    `const v = velocidadDesdePotencia(${solucion.potencia});`,
    `const inicial = crearProyectil(${ORIGEN_X}, ${ORIGEN_Y} - 26, v * Math.cos(rad), -v * Math.sin(rad));`,
    `const resultado = simularVuelo(inicial, ${GRAVEDAD}, ${DERIVA}, detenerse, { grabarTrayectoria: true, perturbacion: { magnitudPxS2: ${MAGNITUD_MOSCA_PX_S2}, aleatorio: crearEstadoAleatorio(4242) } });`,
    "process.stdout.write(JSON.stringify(resultado.trayectoria));",
  ].join("\n");

  const salida = execFileSync(process.execPath, ["--import", "tsx", "-e", script], {
    cwd: __dirname,
    encoding: "utf8",
  });

  assert.equal(salida, hashReferencia, "la trayectoria del segundo proceso no coincide bit a bit con la del primero");
});
