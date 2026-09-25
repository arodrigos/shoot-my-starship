import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { SOLIDO, esSolido, type Mascara } from "@/sim/terreno/mascara";
import { trazarIntentos } from "@/sim/ia/trazado";
import { decidirTurnoIA } from "@/sim/ia/decidir";
import { LA_CONTABLE } from "@/sim/ia/personalidades";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const ORIGEN_X = 300;
const OBJETIVO_X = 900;

function conBloqueRectangular(mascara: Mascara, x0: number, x1: number, y0: number, y1: number): Mascara {
  const copia: Mascara = { ancho: mascara.ancho, alto: mascara.alto, datos: new Uint8Array(mascara.datos) };
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      copia.datos[y * copia.ancho + x] = SOLIDO;
    }
  }
  return copia;
}

// Muro bajo entre tirador y objetivo: alto hasta y=700 (200px sobre el
// suelo en y=900), demasiado bajo para cortar la raíz de mortero (que pasa
// muy por encima) pero justo en la trayectoria rasante del tiro tenso.
function crearEscenarioMuroBajo(): Mascara {
  return conBloqueRectangular(crearMascaraPlana(ANCHO, ALTO, 900), 590, 610, 700, 900);
}

// Añade un techo pegado al origen: como el solucionador dispara siempre a
// potencia máxima, la raíz de mortero alcanza cientos de píxeles de altura
// casi verticalmente sobre el propio cañón -- un techo bajo muy cerca del
// origen la intercepta sin tocar la trayectoria rasante, que se mantiene a
// ras de suelo en ese mismo tramo de x.
function crearEscenarioMuroYTecho(): Mascara {
  return conBloqueRectangular(crearEscenarioMuroBajo(), 303, 345, 100, 700);
}

function puntoTocaSolido(mascara: Mascara, x: number, x0: number, x1: number, y0: number, y1: number): boolean {
  return x >= x0 && x < x1 && esSolido(mascara, Math.round(x), Math.round((y0 + y1) / 2));
}

test("ia-2: sin obstáculo, las dos raíces (mortero y tenso) son viables", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const intentos = trazarIntentos(mascara, ORIGEN_X, OBJETIVO_X, 1.0, 0, ANCHO, ALTO);
  assert.equal(intentos.length, 2);
  for (const intento of intentos) {
    assert.equal(intento.viable, true, `raíz ${intento.esMortero ? "mortero" : "tenso"}: debería ser viable sin obstáculos`);
  }
});

test("ia-2: con un muro bajo, la raíz tenso queda bloqueada y la de mortero sigue viable", () => {
  const mascara = crearEscenarioMuroBajo();
  const intentos = trazarIntentos(mascara, ORIGEN_X, OBJETIVO_X, 1.0, 0, ANCHO, ALTO);
  const tenso = intentos.find((i) => !i.esMortero);
  const mortero = intentos.find((i) => i.esMortero);
  assert.ok(tenso && mortero);
  assert.equal(tenso.viable, false, "la raíz tenso debería chocar contra el muro bajo");
  assert.equal(mortero.viable, true, "la raíz mortero debería pasar por encima del muro bajo");

  // La trayectoria elegida (la viable) no debe pisar el muro: es la
  // comprobación punto a punto que pide ia-2, no solo la etiqueta "viable".
  assert.equal(puntoTocaSolido(mascara, mortero.puntoDeImpacto.x, 590, 610, 700, 900), false);
});

test("ia-2: con muro y techo, ninguna raíz es viable y la IA dispara a otra cosa en vez de fallar", () => {
  const mascara = crearEscenarioMuroYTecho();
  const intentos = trazarIntentos(mascara, ORIGEN_X, OBJETIVO_X, 1.0, 0, ANCHO, ALTO);
  for (const intento of intentos) {
    assert.equal(intento.viable, false, `raíz ${intento.esMortero ? "mortero" : "tenso"}: no debería ser viable con muro y techo`);
  }

  const decision = decidirTurnoIA({
    mascara,
    origenX: ORIGEN_X,
    objetivoX: OBJETIVO_X,
    gravedad: 1.0,
    deriva: 0,
    ancho: ANCHO,
    alto: ALTO,
    personalidad: LA_CONTABLE,
    aleatorio: crearEstadoAleatorio(1),
    ultimoIntento: null,
  });

  // No hay excepción, no hay bucle: se devuelve una EntradaDeTurno de
  // verdad, con el arma de desbloqueo declarada (dispara al obstáculo en
  // vez de repetir el tiro imposible cada turno).
  assert.equal(decision.bloqueada, true);
  assert.equal(decision.entrada.arma, "zanjadora-manolita");
  assert.equal(Number.isFinite(decision.entrada.anguloGrados), true);
  assert.equal(Number.isFinite(decision.entrada.potencia), true);
});
