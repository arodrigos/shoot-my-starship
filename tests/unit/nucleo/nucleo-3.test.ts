import { test } from "node:test";
import assert from "node:assert/strict";
import { crearPartidaInicial, jugarPartida } from "@/sim/partida/motor";
import type { FuenteDeTurno } from "@/sim/partida/tipos";

const MUNDO = { ancho: 1920, alto: 1080, gravedad: 1.0, deriva: 0, etiquetaDeriva: "prueba" };

// Ángulo y potencia fijos que caen a ~15px de la nave contraria dada la
// distancia entre 300 y 1620: no necesita ningún solucionador balístico
// (eso es ia-personalidades) para que la partida progrese y termine.
const fuenteCentroFijo: FuenteDeTurno = (estado) => ({
  entrada: { arma: "referencia", anguloGrados: estado.turno === 0 ? 45 : 135, potencia: 60 },
  estado,
});

test("nucleo-3: una partida completa corre de principio a fin en Node puro, sin DOM", () => {
  // No hay jsdom en este proyecto (package.json no lo declara) y esta
  // prueba no importa nada que lo necesite: si src/sim tocara window o
  // document, esto explotaría aquí, no en un navegador.
  assert.equal(typeof window, "undefined");
  assert.equal(typeof document, "undefined");

  const inicial = crearPartidaInicial(MUNDO, 300, 1620, 99);
  const resultado = jugarPartida(inicial, [fuenteCentroFijo, fuenteCentroFijo], 200);

  assert.equal(resultado.agotada, false);
  assert.equal(resultado.estado.resultado.tipo, "terminada");
});
