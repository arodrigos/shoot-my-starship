import { test } from "node:test";
import assert from "node:assert/strict";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { crearProyectil, integrarPasoProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { detenerseEnSuelo } from "@/sim/armas/resolver";
import { crearRastreadorImpactoNaves, RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";
import { PASO_FIJO_MS } from "@/sim/tiempo";

const ANCHO = 3000;
const ALTO = 1000;
const PASO_S = PASO_FIJO_MS / 1000;

// Referencia deliberadamente ingenua (lo que este bloque NO hace): mirar solo
// la posición al final de cada paso de integración, nunca el segmento
// recorrido dentro de ese paso.
function impactaPorPuntoFinal(inicial: EstadoProyectil, pasos: number, naveX: number, naveY: number, radio: number): boolean {
  let proyectil = inicial;
  for (let i = 0; i < pasos; i++) {
    proyectil = integrarPasoProyectil(proyectil, 0, 0, PASO_S);
    if (Math.hypot(proyectil.x - naveX, proyectil.y - naveY) <= radio) {
      return true;
    }
  }
  return false;
}

test("imp-2: el barrido de segmento atrapa el túnel a alta velocidad que un muestreo por punto final se saltaría", () => {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  const detenerse = detenerseEnSuelo(mascara, ANCHO, ALTO);

  // 90px por paso (vx * PASO_S = 90): el primer paso va de x=1000 a x=1090,
  // pasando de largo por delante y por detrás del casco (radio 22px) sin que
  // ningún extremo de ese paso quede dentro de él -- el centro del casco cae
  // justo en el punto MEDIO del primer paso, a 45px de cada extremo.
  const inicial = crearProyectil(1000, 500, 90 / PASO_S, 0);
  const objetivo = { id: 1 as const, x: 1045, y: 500 };

  const rastreador = crearRastreadorImpactoNaves([{ id: 0, x: 0, y: 0 }, objetivo], 0);
  const resultado = simularVuelo(inicial, 0, 0, detenerse, { rastreadorNaves: rastreador });

  assert.equal(resultado.impactoNave?.nave, 1, "el barrido de segmento debe detectar el casco cruzado dentro del paso");

  // La comprobación de referencia, sobre la MISMA trayectoria: ningún punto
  // final de los primeros pasos cae dentro del radio del casco.
  const detectadoPorPuntoFinal = impactaPorPuntoFinal(inicial, 5, objetivo.x, objetivo.y, RADIO_CASCO_NAVE_PX);
  assert.equal(
    detectadoPorPuntoFinal,
    false,
    "la comprobación por punto final NO debería detectar este mismo casco -- si lo hiciera, este test no demostraría nada",
  );
});
