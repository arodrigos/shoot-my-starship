import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { colocarNaves } from "@/sim/naves/colocacion";
import { avanzar } from "@/sim/partida/avanzar";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { ALMIRANTE_BISAGRA, LA_CONTABLE } from "@/sim/ia/personalidades";
import { calcularBandaPrevisualizacion } from "@/sim/armas/previsualizacion";
import { buscarArma } from "@/sim/armas/catalogo";
import { manejarPeticion } from "@/juego/motor/manejador";
import { esPeticion, type Peticion } from "@/juego/motor/protocolo";
import { respuestaVigente } from "@/juego/motor/clienteSim";
import type { EstadoPartida, IdNave, ParametrosMundo } from "@/sim/partida/tipos";
import { MUNDO_ALTO, MUNDO_ANCHO } from "../../utils/sistemaGenerado";

const MUNDO: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "" };

// Colocar naves cuesta más que el propio disparo: se reutilizan 12 mundos
// (4 semillas × 2 a 4 naves) y las 200 repeticiones varían arma, ángulo y potencia.
const SEMILLAS_MUNDO = [11, 257, 4099, 65537] as const;
const cacheEstados = new Map<string, EstadoPartida>();
function estadoDe(semilla: number, naves: number): EstadoPartida {
  const clave = `${semilla}:${naves}`;
  let estado = cacheEstados.get(clave);
  if (!estado) {
    estado = construirEstado(semilla, naves);
    cacheEstados.set(clave, estado);
  }
  return estado;
}

function construirEstado(semilla: number, naves: number): EstadoPartida {
  const colocacion = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), naves, Array(naves).fill(false));
  return {
    version: 1,
    mundo: MUNDO,
    mascara: colocacion.sistema.mascara,
    naves: colocacion.naves,
    ordenTurno: colocacion.naves.map((_n, id) => id),
    turno: 0,
    numeroTurno: 0,
    aleatorio: colocacion.aleatorio,
    resultado: { tipo: "en-curso" },
    planetas: colocacion.sistema.planetas,
  };
}

// El viaje de ida y vuelta del trabajador: copia estructurada de la petición
// y de la respuesta, exactamente lo que hace postMessage.
function porElTrabajador(peticion: Peticion) {
  assert.ok(esPeticion(structuredClone(peticion)));
  return structuredClone(manejarPeticion(structuredClone(peticion)));
}

const generadorCaso = fc.record({
  semilla: fc.constantFrom(...SEMILLAS_MUNDO),
  naves: fc.integer({ min: 2, max: 4 }),
  arma: fc.constantFrom(...CATALOGO_ARMAS.map((a) => a.id)),
  anguloGrados: fc.integer({ min: 0, max: 180 }),
  potencia: fc.integer({ min: 10, max: 100 }),
});

// res-2, invariante 1: resolverDisparo a través del trabajador es idéntico
// (incluido el EstadoAleatorio final, las detonaciones y el recorrido) a la
// llamada directa.
test("res-2: resolverDisparo por el trabajador == llamada directa (200 casos)", () => {
  fc.assert(
    fc.property(generadorCaso, (caso) => {
      const estado = estadoDe(caso.semilla, caso.naves);
      const entrada = { arma: caso.arma, anguloGrados: caso.anguloGrados, potencia: caso.potencia, objetivoId: 1 as IdNave };
      const directa = avanzar(estado, entrada);
      const respuesta = porElTrabajador({ tipo: "resolverDisparo", idPeticion: 1, idPartida: 1, estado, entrada });
      assert.equal(respuesta.tipo, "resolverDisparo");
      assert.deepEqual(respuesta.resultado, directa);
    }),
    { numRuns: 200 },
  );
});

test("res-2: previsualizar por el trabajador == llamada directa (200 casos)", () => {
  fc.assert(
    fc.property(generadorCaso, (caso) => {
      const estado = estadoDe(caso.semilla, caso.naves);
      const nave = estado.naves[0];
      const origenY = nave.y as number;
      const peticion: Peticion = {
        tipo: "previsualizar",
        idPeticion: 1,
        idPartida: 1,
        mascara: estado.mascara,
        gravedad: MUNDO.gravedad,
        deriva: MUNDO.deriva,
        ancho: MUNDO.ancho,
        alto: MUNDO.alto,
        planetas: estado.planetas,
        tirador: 0,
        origenX: nave.x,
        origenY,
        anguloGrados: caso.anguloGrados,
        potencia: caso.potencia,
        armaId: caso.arma,
        aleatorio: estado.aleatorio,
      };
      const directa = calcularBandaPrevisualizacion({
        mascara: estado.mascara,
        gravedad: MUNDO.gravedad,
        deriva: MUNDO.deriva,
        ancho: MUNDO.ancho,
        alto: MUNDO.alto,
        planetas: estado.planetas,
        origenX: nave.x,
        origenY,
        anguloGrados: caso.anguloGrados,
        potencia: caso.potencia,
        comportamiento: buscarArma(caso.arma).comportamiento,
        aleatorio: estado.aleatorio,
      });
      const respuesta = porElTrabajador(peticion);
      assert.equal(respuesta.tipo, "previsualizar");
      assert.deepEqual(respuesta.resultado.banda, directa);
    }),
    { numRuns: 200 },
  );
});

// La búsqueda de la IA cuesta ~1 s por caso y el espacio es de 4 mundos × 3 tamaños
// × 2 personalidades = 24 combinaciones: 24 repeticiones las cubren casi todas.
test("res-2: decidirIA por el trabajador == llamada directa (24 combinaciones)", () => {
  fc.assert(
    fc.property(fc.constantFrom(...SEMILLAS_MUNDO), fc.integer({ min: 2, max: 4 }), fc.boolean(), (semilla, naves, contable) => {
      const estado = estadoDe(semilla, naves);
      const personalidad = contable ? LA_CONTABLE : ALMIRANTE_BISAGRA;
      const directa = crearFuenteIA(personalidad, null, {}, false)(estado);
      const respuesta = porElTrabajador({
        tipo: "decidirIA",
        idPeticion: 1,
        idPartida: 1,
        estado,
        personalidad,
        ultimoIntento: null,
        usosPorArma: {},
        danioRecibidoDesdeSuTurno: false,
      });
      assert.equal(respuesta.tipo, "decidirIA");
      assert.deepEqual(respuesta.resultado, directa);
    }),
    { numRuns: 24 },
  );
});

// res-2, invariante 2: para cualquier orden de llegada, solo se aplica la
// respuesta que coincide con el último idPeticion emitido de su tipo y con la
// partida vigente.
test("res-2: solo se aplica la respuesta del último idPeticion y la partida vigente", () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({ id: fc.integer({ min: 1, max: 30 }), partida: fc.integer({ min: 1, max: 3 }) }), { minLength: 1, maxLength: 20 }),
      fc.integer({ min: 1, max: 30 }),
      fc.integer({ min: 1, max: 3 }),
      (llegadas, ultimoId, partidaVigente) => {
        const aplicadas = llegadas.filter((l) =>
          respuestaVigente({ tipo: "resolverDisparo", idPeticion: l.id, idPartida: l.partida }, { resolverDisparo: ultimoId }, partidaVigente),
        );
        for (const l of aplicadas) {
          assert.equal(l.id, ultimoId);
          assert.equal(l.partida, partidaVigente);
        }
        // Un tipo distinto con el mismo id no cuela, y un error nunca se aplica.
        assert.equal(respuestaVigente({ tipo: "previsualizar", idPeticion: ultimoId, idPartida: partidaVigente }, { resolverDisparo: ultimoId }, partidaVigente), false);
        assert.equal(respuestaVigente({ tipo: "error", idPeticion: ultimoId, idPartida: partidaVigente }, { resolverDisparo: ultimoId }, partidaVigente), false);
      },
    ),
    { numRuns: 200 },
  );
});

test("res-2: un mensaje mal formado no pasa por esPeticion", () => {
  for (const malo of [null, 3, "x", {}, { tipo: "otro", idPeticion: 1, idPartida: 1 }, { tipo: "decidirIA" }]) {
    assert.equal(esPeticion(malo), false);
  }
});
