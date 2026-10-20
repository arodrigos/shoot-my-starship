// Única función que resuelve peticiones: la ejecutan igual el trabajador, el
// adaptador en línea y el test de equivalencia, de modo que sacar la
// simulación del hilo principal no puede cambiar ningún resultado.
import { buscarArma } from "@/sim/armas/catalogo";
import { calcularAbanicoPrevisualizacion, calcularBandaPrevisualizacion } from "@/sim/armas/previsualizacion";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { crearRastreadorImpactoNaves } from "@/sim/naves/impacto";
import { avanzar, cerrarTurnoTrasImpacto, contadoresDeCalculo, reiniciarContadoresDeCalculo, resolverImpacto } from "@/sim/partida/avanzar";
import type { Peticion, Respuesta } from "@/juego/motor/protocolo";

function vuelosContados(): number {
  return contadoresDeCalculo.resolverDisparo + contadoresDeCalculo.existeTiroViable;
}

export function manejarPeticion(peticion: Peticion, ahora: () => number = () => performance.now()): Respuesta {
  const { idPeticion, idPartida } = peticion;
  try {
    switch (peticion.tipo) {
      case "previsualizar": {
        const rastreadorNaves = peticion.navesVivas ? crearRastreadorImpactoNaves(peticion.navesVivas, peticion.tirador) : undefined;
        const inicio = ahora();
        const base = {
          mascara: peticion.mascara,
          gravedad: peticion.gravedad,
          deriva: peticion.deriva,
          ancho: peticion.ancho,
          alto: peticion.alto,
          planetas: peticion.planetas,
          rastreadorNaves,
          origenX: peticion.origenX,
          origenY: peticion.origenY,
          anguloGrados: peticion.anguloGrados,
          potencia: peticion.potencia,
          comportamiento: buscarArma(peticion.armaId).comportamiento,
          aleatorio: peticion.aleatorio,
        };
        if (peticion.abanico) {
          const { semiapertura1, semiapertura2, longitudMundoMax } = peticion.abanico;
          const abanico = calcularAbanicoPrevisualizacion({ ...base, longitudMundoMax }, semiapertura1, semiapertura2);
          const banda = { centro: abanico.centro, extremoMenor: abanico.centro, extremoMayor: abanico.centro, amplitudGrados: 0 };
          return { tipo: "previsualizar", idPeticion, idPartida, resultado: { banda, abanico, duracionMs: ahora() - inicio } };
        }
        const banda = calcularBandaPrevisualizacion(base);
        return { tipo: "previsualizar", idPeticion, idPartida, resultado: { banda, duracionMs: ahora() - inicio } };
      }
      case "resolverDisparo":
        return { tipo: "resolverDisparo", idPeticion, idPartida, resultado: avanzar(peticion.estado, peticion.entrada) };
      case "resolverImpacto": {
        reiniciarContadoresDeCalculo();
        const inicio = ahora();
        const fase = resolverImpacto(peticion.estado, peticion.entrada);
        return { tipo: "resolverImpacto", idPeticion, idPartida, resultado: fase, metricas: { duracionMs: ahora() - inicio, vuelos: vuelosContados() } };
      }
      case "cerrarTurno": {
        reiniciarContadoresDeCalculo();
        const inicio = ahora();
        const resultado = cerrarTurnoTrasImpacto(peticion.fase);
        return { tipo: "cerrarTurno", idPeticion, idPartida, resultado, metricas: { duracionMs: ahora() - inicio, vuelos: vuelosContados() } };
      }
      case "decidirIA": {
        const fuente = crearFuenteIA(peticion.personalidad, peticion.ultimoIntento, peticion.usosPorArma, peticion.danioRecibidoDesdeSuTurno);
        return { tipo: "decidirIA", idPeticion, idPartida, resultado: fuente(peticion.estado) };
      }
    }
  } catch (error) {
    return { tipo: "error", idPeticion, idPartida, mensaje: error instanceof Error ? error.message : String(error) };
  }
}
