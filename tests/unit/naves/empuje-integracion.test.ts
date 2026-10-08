import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { barridoRejilla, RANGO_ANGULOS_JUGADOR } from "@/sim/balistica/rejilla";
import { colocarNaves } from "@/sim/naves/colocacion";
import { avanzar } from "@/sim/partida/avanzar";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { MUNDO_ALTO, MUNDO_ANCHO } from "../../utils/sistemaGenerado";

const MUNDO: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "" };
const ARMA_ID = "pepinazo-cortesia";
// Margen para lo que curvan los pozos en el primer tramo; el sorteo antiguo
// salía en una dirección cualquiera, así que 25° ya lo distingue de sobra.
const TOLERANCIA_GRADOS = 25;

function estadoParaSemilla(semilla: number): EstadoPartida {
  const colocacion = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), 2, [false, false]);
  return {
    version: 1,
    mundo: MUNDO,
    mascara: colocacion.sistema.mascara,
    naves: colocacion.naves,
    ordenTurno: [0, 1],
    turno: 0,
    numeroTurno: 0,
    aleatorio: colocacion.aleatorio,
    resultado: { tipo: "en-curso" },
    planetas: colocacion.sistema.planetas,
  };
}

// emp-1 sobre el simulador real: la nave golpeada sale en la dirección en que
// volaba el proyectil al detonar, y el resultado no consume EstadoAleatorio.
test("emp-1: tras un impacto real, el primer tramo del recorrido sigue la velocidad del proyectil", () => {
  const arma = buscarArma(ARMA_ID);
  let medidas = 0;
  for (let semilla = 1; semilla <= 40 && medidas < 5; semilla++) {
    const inicial = estadoParaSemilla(semilla);
    const candidatos = barridoRejilla({
      mascara: inicial.mascara,
      ancho: MUNDO.ancho,
      alto: MUNDO.alto,
      planetas: inicial.planetas,
      gravedad: MUNDO.gravedad,
      deriva: MUNDO.deriva,
      aleatorio: inicial.aleatorio,
      arma,
      naves: inicial.naves.map((nave, id) => ({ id, x: nave.x, y: nave.y as number })),
      tiradorId: 0,
      objetivoId: 1,
      rangoAngulos: RANGO_ANGULOS_JUGADOR,
      presupuestoIntentos: 120,
    });
    if (candidatos.length === 0) continue;
    const entrada = { arma: ARMA_ID, anguloGrados: candidatos[0].anguloGrados, potencia: candidatos[0].potencia, objetivoId: 1 };
    const turno = avanzar(inicial, entrada);
    const evento = turno.eventos.find((e) => e.tipo === "desplazamiento" && e.nave === 1);
    if (evento?.tipo !== "desplazamiento" || evento.puntos.length < 2) continue;
    // Sin primer paso válido por la línea del tiro (planeta pegado), la única
    // salida es el desvío lateral y su primer tramo no sigue la velocidad.
    if (evento.reserva === "lateral" && evento.puntos.length === 2) continue;

    const vuelo = resolverDisparo({
      mascara: inicial.mascara,
      gravedad: MUNDO.gravedad,
      deriva: MUNDO.deriva,
      aleatorio: inicial.aleatorio,
      arma,
      origenX: inicial.naves[0].x,
      origenY: inicial.naves[0].y,
      anguloGrados: entrada.anguloGrados,
      potencia: entrada.potencia,
      objetivoX: inicial.naves[1].x,
      objetivoY: inicial.naves[1].y as number,
      objetivoId: 1,
      ancho: MUNDO.ancho,
      alto: MUNDO.alto,
      planetas: inicial.planetas,
      naves: inicial.naves.map((nave, id) => ({ id, x: nave.x, y: nave.y as number })),
      tiradorId: 0,
      incluirDispersionPotencia: true,
    });
    const punto = vuelo.puntosDeImpacto[0];
    assert.ok(punto?.vx !== undefined && punto.vy !== undefined, "el punto de impacto lleva la velocidad");
    const [a, b] = evento.puntos;
    const cos = ((b.x - a.x) * punto.vx + (b.y - a.y) * punto.vy) / (Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(punto.vx, punto.vy));
    assert.ok((Math.acos(Math.min(1, cos)) * 180) / Math.PI <= TOLERANCIA_GRADOS, `semilla ${semilla}: ángulo ${Math.acos(cos)}`);
    assert.deepEqual(turno.estado.aleatorio, vuelo.aleatorio, "el desplazamiento no consume EstadoAleatorio");
    medidas += 1;
  }
  assert.ok(medidas >= 3, `muestra suficiente (${medidas})`);
});
