import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { calcularAbanicoPrevisualizacion, calcularBandaPrevisualizacion } from "@/sim/armas/previsualizacion";
import { colocarNaves } from "@/sim/naves/colocacion";
import { crearRastreadorImpactoNaves } from "@/sim/naves/impacto";
import { avanzar, resolverImpacto } from "@/sim/partida/avanzar";
import { manejarPeticion } from "@/juego/motor/manejador";
import type { PeticionPrevisualizar } from "@/juego/motor/protocolo";
import type { EntradaDeTurno, EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { MUNDO_ALTO, MUNDO_ANCHO } from "../../utils/sistemaGenerado";

const MUNDO: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "" };
const SEMILLA = 4099;

function construirEstado(): EstadoPartida {
  const colocacion = colocarNaves(SEMILLA, MUNDO, crearEstadoAleatorio(SEMILLA), 2, [false, false]);
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

const ESTADO = construirEstado();
const ENTRADA: EntradaDeTurno = { arma: "pepinazo-cortesia", anguloGrados: 60, potencia: 70, objetivoId: 1 };

// Reloj falso: cada lectura avanza 5 ms, así duracionMs es exacto.
function relojDePasos(): () => number {
  let t = 0;
  return () => (t += 5);
}

function peticionPrevisualizar(extra: Partial<PeticionPrevisualizar> = {}): PeticionPrevisualizar {
  const nave = ESTADO.naves[0];
  return {
    tipo: "previsualizar",
    idPeticion: 7,
    idPartida: 3,
    mascara: ESTADO.mascara,
    gravedad: MUNDO.gravedad,
    deriva: MUNDO.deriva,
    ancho: MUNDO.ancho,
    alto: MUNDO.alto,
    planetas: ESTADO.planetas,
    tirador: 0,
    origenX: nave.x,
    origenY: nave.y as number,
    anguloGrados: 50,
    potencia: 60,
    armaId: "pepinazo-cortesia",
    aleatorio: ESTADO.aleatorio,
    ...extra,
  };
}

describe("manejarPeticion: fases del turno", () => {
  it("resolverImpacto y luego cerrarTurno dan lo mismo que avanzar de una vez", () => {
    const impacto = manejarPeticion({ tipo: "resolverImpacto", idPeticion: 1, idPartida: 9, estado: ESTADO, entrada: ENTRADA }, relojDePasos());
    assert.equal(impacto.tipo, "resolverImpacto");
    if (impacto.tipo !== "resolverImpacto") return;
    assert.equal(impacto.idPeticion, 1);
    assert.equal(impacto.idPartida, 9);
    assert.equal(impacto.metricas.duracionMs, 5);
    assert.ok(impacto.metricas.vuelos >= 1);
    assert.deepEqual(impacto.resultado, resolverImpacto(ESTADO, ENTRADA));

    const cierre = manejarPeticion({ tipo: "cerrarTurno", idPeticion: 2, idPartida: 9, fase: impacto.resultado }, relojDePasos());
    assert.equal(cierre.tipo, "cerrarTurno");
    if (cierre.tipo !== "cerrarTurno") return;
    assert.equal(cierre.metricas.duracionMs, 5);
    assert.ok(cierre.metricas.vuelos >= 0);
    assert.deepEqual(cierre.resultado, avanzar(ESTADO, ENTRADA));
  });

  it("los contadores de vuelos se reinician en cada petición", () => {
    const peticion = { tipo: "resolverImpacto", idPeticion: 1, idPartida: 1, estado: ESTADO, entrada: ENTRADA } as const;
    const a = manejarPeticion(peticion);
    const b = manejarPeticion(peticion);
    assert.ok(a.tipo === "resolverImpacto" && b.tipo === "resolverImpacto");
    assert.equal(a.metricas.vuelos, b.metricas.vuelos);
  });

  it("una excepción del núcleo vuelve como respuesta de error con su cabecera", () => {
    const terminada: EstadoPartida = { ...ESTADO, resultado: { tipo: "terminada", ganador: 0 } };
    const respuesta = manejarPeticion({ tipo: "resolverImpacto", idPeticion: 4, idPartida: 2, estado: terminada, entrada: ENTRADA });
    assert.deepEqual(respuesta, { tipo: "error", idPeticion: 4, idPartida: 2, mensaje: "avanzar: la partida ya ha terminado, no admite más turnos" });
  });

  it("un arma desconocida en la previsualización también vuelve como error", () => {
    const respuesta = manejarPeticion(peticionPrevisualizar({ armaId: "no-existe" }));
    assert.equal(respuesta.tipo, "error");
    assert.equal(respuesta.idPeticion, 7);
  });
});

describe("manejarPeticion: previsualizar", () => {
  it("con naves vivas usa el rastreador del tirador, igual que la llamada directa", () => {
    const navesVivas = ESTADO.naves.map((n, id) => ({ id, x: n.x, y: n.y as number }));
    const peticion = peticionPrevisualizar({ navesVivas });
    const respuesta = manejarPeticion(peticion, relojDePasos());
    assert.equal(respuesta.tipo, "previsualizar");
    if (respuesta.tipo !== "previsualizar") return;
    assert.equal(respuesta.resultado.duracionMs, 5);
    assert.equal(respuesta.resultado.abanico, undefined);
    const directa = calcularBandaPrevisualizacion({
      mascara: peticion.mascara,
      gravedad: peticion.gravedad,
      deriva: peticion.deriva,
      ancho: peticion.ancho,
      alto: peticion.alto,
      planetas: peticion.planetas,
      rastreadorNaves: crearRastreadorImpactoNaves(navesVivas, 0),
      origenX: peticion.origenX,
      origenY: peticion.origenY,
      anguloGrados: peticion.anguloGrados,
      potencia: peticion.potencia,
      comportamiento: buscarArma("pepinazo-cortesia").comportamiento,
      aleatorio: peticion.aleatorio,
    });
    assert.deepEqual(respuesta.resultado.banda, directa);
  });

  it("con abanico devuelve el abanico y una banda degenerada en su centro", () => {
    const abanicoPedido = { semiapertura1: 2, semiapertura2: 6, longitudMundoMax: 400 };
    const peticion = peticionPrevisualizar({ abanico: abanicoPedido });
    const respuesta = manejarPeticion(peticion, relojDePasos());
    assert.equal(respuesta.tipo, "previsualizar");
    if (respuesta.tipo !== "previsualizar") return;
    const directo = calcularAbanicoPrevisualizacion(
      {
        mascara: peticion.mascara,
        gravedad: peticion.gravedad,
        deriva: peticion.deriva,
        ancho: peticion.ancho,
        alto: peticion.alto,
        planetas: peticion.planetas,
        origenX: peticion.origenX,
        origenY: peticion.origenY,
        anguloGrados: peticion.anguloGrados,
        potencia: peticion.potencia,
        comportamiento: buscarArma("pepinazo-cortesia").comportamiento,
        aleatorio: peticion.aleatorio,
        longitudMundoMax: abanicoPedido.longitudMundoMax,
      },
      abanicoPedido.semiapertura1,
      abanicoPedido.semiapertura2,
    );
    assert.deepEqual(respuesta.resultado.abanico, directo);
    assert.deepEqual(respuesta.resultado.banda, {
      centro: directo.centro,
      extremoMenor: directo.centro,
      extremoMayor: directo.centro,
      amplitudGrados: 0,
    });
    assert.equal(respuesta.resultado.duracionMs, 5);
  });
});
