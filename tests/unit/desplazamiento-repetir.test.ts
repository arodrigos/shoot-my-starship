import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma, CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { radioEfectoEnMundo } from "@/sim/armas/radioEfecto";
import { barridoRejilla, RANGO_ANGULOS_JUGADOR } from "@/sim/balistica/rejilla";
import { colocarNaves } from "@/sim/naves/colocacion";
import { distanciaMinimaDesplazamiento, octavoDelMundo } from "@/sim/naves/desplazamiento";
import { avanzar } from "@/sim/partida/avanzar";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { MUNDO_ALTO, MUNDO_ANCHO } from "../utils/sistemaGenerado";
import { muestra } from "../utils/muestra";

const MUNDO: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "" };
const SEMILLAS = muestra(200);
const ARMA_ID = "pepinazo-cortesia";
const MINIMO_PROPORCION_SIN_ACIERTO = 0.95;

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

// des-1: sobre el simulador real, tras un impacto con daño el rival se mueve y
// repetir exactamente el mismo disparo ya no le da (≥ 95 % de las semillas).
test("des-1: repetir el mismo disparo tras un impacto no vuelve a acertar (pepinazo)", () => {
  const arma = buscarArma(ARMA_ID);
  const radioEfecto = radioEfectoEnMundo(arma, MUNDO.ancho, MUNDO.alto);
  assert.ok(22 + radioEfecto + 8 <= octavoDelMundo(MUNDO), "el arma entra en la propiedad");

  let medidas = 0;
  let sinAcierto = 0;
  for (let semilla = 1; semilla <= SEMILLAS; semilla++) {
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

    const turno1 = avanzar(inicial, entrada);
    const rivalAntes = inicial.naves[1];
    const rivalDespues = turno1.estado.naves[1];
    if (rivalDespues.integridad >= rivalAntes.integridad || turno1.estado.resultado.tipo === "terminada") continue;

    const desplazamiento = turno1.eventos.find((e) => e.tipo === "desplazamiento" && e.nave === 1);
    assert.ok(desplazamiento && desplazamiento.tipo === "desplazamiento", `semilla ${semilla}: el rival dañado se recoloca`);
    const distancia = Math.hypot(desplazamiento.x - desplazamiento.desdeX, desplazamiento.y - desplazamiento.desdeY);
    const minima = distanciaMinimaDesplazamiento(MUNDO, radioEfecto);
    if (desplazamiento.reserva === "ninguna") {
      assert.ok(distancia >= minima - 1e-6 && distancia <= octavoDelMundo(MUNDO) + 1e-6, `semilla ${semilla}: distancia ${distancia} fuera de [${minima}, ${octavoDelMundo(MUNDO)}]`);
    }

    // El rival pasa su turno sin disparar: el turno vuelve al tirador.
    const turno3 = avanzar({ ...turno1.estado, turno: 0 }, entrada);
    medidas += 1;
    if (turno3.estado.naves[1].integridad >= rivalDespues.integridad) sinAcierto += 1;
  }

  assert.ok(medidas >= Math.floor(SEMILLAS / 4), `muestra suficiente (${medidas} de ${SEMILLAS})`);
  assert.ok(
    sinAcierto / medidas >= MINIMO_PROPORCION_SIN_ACIERTO,
    `repetir el disparo no acierta en ${sinAcierto} de ${medidas} semillas (mínimo ${MINIMO_PROPORCION_SIN_ACIERTO * 100} %)`,
  );
});

// El criterio pide que las armas fuera de la propiedad se listen, no que se oculten.
test("des-1: las armas cuyo área no cabe en el octavo quedan listadas", () => {
  const fuera = CATALOGO_ARMAS.filter((arma) => 22 + radioEfectoEnMundo(arma, MUNDO.ancho, MUNDO.alto) + 8 > octavoDelMundo(MUNDO)).map(
    (arma) => arma.nombre,
  );
  console.log(`des-1: armas fuera de la propiedad (${fuera.length}): ${fuera.join(", ") || "ninguna"}`);
  assert.ok(Array.isArray(fuera));
});
