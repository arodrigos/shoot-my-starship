import { test } from "node:test";
import assert from "node:assert/strict";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import {
  caeAlVacio,
  esTiroImposibleAcertado,
  estaEnterrada,
  huboDerivaTraiciona,
  idLiderDerrumbado,
} from "@/sim/partida/eventosHumor";
import type { ResultadoDisparo } from "@/sim/armas/resolver";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

// Base común: un ResultadoDisparo mínimo, con solo los campos que cada
// función de eventosHumor.ts realmente lee -- no hace falta pasar por
// resolverDisparo para probar la detección en sí, que es pura sobre estos
// datos (avanzar.test.ts / los tests de integración de armas ya cubren que
// resolverDisparo produce estos campos correctamente).
function resultado(parcial: Partial<ResultadoDisparo>): ResultadoDisparo {
  return {
    mascara: crearMascaraVacia(10, 10),
    aleatorio: crearEstadoAleatorio(0),
    puntosDeImpacto: [],
    danioPorPunto: [],
    danioObjetivo: 0,
    danioPropio: 0,
    impactoPropio: null,
    desplazamientoObjetivoPx: 0,
    origenY: 0,
    fallo: false,
    proyectilPerdido: false,
    ...parcial,
  };
}

test("eventosHumor: huboDerivaTraiciona -- sin deriva habría dado, con deriva no", () => {
  const real = resultado({ danioObjetivo: 0 });
  const sinDeriva = resultado({ danioObjetivo: 12 });
  assert.equal(huboDerivaTraiciona(real, sinDeriva), true);
});

test("eventosHumor: huboDerivaTraiciona -- si de todos modos acierta, no hay traición", () => {
  const real = resultado({ danioObjetivo: 12 });
  const sinDeriva = resultado({ danioObjetivo: 12 });
  assert.equal(huboDerivaTraiciona(real, sinDeriva), false);
});

test("eventosHumor: huboDerivaTraiciona -- un fallo de fiabilidad no cuenta como traición del viento", () => {
  const real = resultado({ danioObjetivo: 0, fallo: true });
  const sinDeriva = resultado({ danioObjetivo: 12 });
  assert.equal(huboDerivaTraiciona(real, sinDeriva), false);
});

test("eventosHumor: idLiderDerrumbado -- el suelo bajo el líder se hunde más del margen", () => {
  const antes = crearMascaraPlana(20, 100, 30); // superficie en y=30 en toda la anchura
  const despues = crearMascaraPlana(20, 100, 60); // el suelo ha cedido 30px bajo todo el mapa
  assert.equal(idLiderDerrumbado(80, 40, 5, 15, antes, despues), 0);
});

test("eventosHumor: idLiderDerrumbado -- empate de integridad no tiene líder", () => {
  const antes = crearMascaraPlana(20, 100, 30);
  const despues = crearMascaraPlana(20, 100, 60);
  assert.equal(idLiderDerrumbado(50, 50, 5, 15, antes, despues), null);
});

test("eventosHumor: idLiderDerrumbado -- un cambio menor que el margen no cuenta como derrumbe", () => {
  const antes = crearMascaraPlana(20, 100, 60);
  const despues = crearMascaraPlana(20, 100, 62); // sube 2px, por debajo de MARGEN_DERRUMBE_PX
  assert.equal(idLiderDerrumbado(80, 40, 5, 15, antes, despues), null);
});

test("eventosHumor: estaEnterrada -- el terreno sube más del margen en la misma columna", () => {
  const antes = crearMascaraPlana(20, 100, 60);
  const despues = crearMascaraPlana(20, 100, 30);
  assert.equal(estaEnterrada(5, antes, despues), true);
});

test("eventosHumor: estaEnterrada -- si el terreno baja (se destruye), no es enterramiento", () => {
  const antes = crearMascaraPlana(20, 100, 60);
  const despues = crearMascaraPlana(20, 100, 90);
  assert.equal(estaEnterrada(5, antes, despues), false);
});

test("eventosHumor: caeAlVacio -- transición de tener suelo a no tener ninguno", () => {
  const antes = crearMascaraPlana(20, 100, 60);
  const despues = crearMascaraVacia(20, 100); // sin nada de sólido
  assert.equal(caeAlVacio(5, antes, despues), true);
});

test("eventosHumor: caeAlVacio -- si ya no tenía suelo antes, no vuelve a dispararse", () => {
  const antes = crearMascaraVacia(20, 100);
  const despues = crearMascaraVacia(20, 100);
  assert.equal(caeAlVacio(5, antes, despues), false);
});

test("eventosHumor: caeAlVacio -- si sigue teniendo suelo, no dispara nada", () => {
  const antes = crearMascaraPlana(20, 100, 60);
  const despues = crearMascaraPlana(20, 100, 60);
  assert.equal(caeAlVacio(5, antes, despues), false);
});

test("eventosHumor: esTiroImposibleAcertado -- ángulo disparado lejos de la solución exacta y aun así acierta", () => {
  // Origen y objetivo a la misma altura, 400px de distancia, potencia 70:
  // las dos soluciones exactas rondan ~7° (tenso) y ~83° (mortero). 45° está
  // a más de 25° de las dos -- justo el caso "imposible acertado".
  const acierto = esTiroImposibleAcertado(0, 0, 400, 0, 1, 70, 45, resultado({ danioObjetivo: 10 }));
  assert.equal(acierto, true);
});

test("eventosHumor: esTiroImposibleAcertado -- si el disparo falla, no cuenta aunque el ángulo sea raro", () => {
  const acierto = esTiroImposibleAcertado(0, 0, 400, 0, 1, 70, 45, resultado({ danioObjetivo: 0, fallo: true }));
  assert.equal(acierto, false);
});

test("eventosHumor: esTiroImposibleAcertado -- si no hay daño al objetivo, no es un acierto que celebrar", () => {
  const acierto = esTiroImposibleAcertado(0, 0, 400, 0, 1, 70, 45, resultado({ danioObjetivo: 0 }));
  assert.equal(acierto, false);
});
