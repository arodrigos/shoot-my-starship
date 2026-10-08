// Única función que resuelve peticiones: la ejecutan igual el trabajador, el
// adaptador en línea y el test de equivalencia, de modo que sacar la
// simulación del hilo principal no puede cambiar ningún resultado.
import { buscarArma } from "@/sim/armas/catalogo";
import { calcularBandaPrevisualizacion } from "@/sim/armas/previsualizacion";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { crearRastreadorImpactoNaves } from "@/sim/naves/impacto";
import { avanzar } from "@/sim/partida/avanzar";
import type { Peticion, Respuesta } from "@/juego/motor/protocolo";

export function manejarPeticion(peticion: Peticion, ahora: () => number = () => performance.now()): Respuesta {
  const { idPeticion, idPartida } = peticion;
  try {
    switch (peticion.tipo) {
      case "previsualizar": {
        const rastreadorNaves = peticion.navesVivas ? crearRastreadorImpactoNaves(peticion.navesVivas, peticion.tirador) : undefined;
        const inicio = ahora();
        const banda = calcularBandaPrevisualizacion({
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
        });
        return { tipo: "previsualizar", idPeticion, idPartida, resultado: { banda, duracionMs: ahora() - inicio } };
      }
      case "resolverDisparo":
        return { tipo: "resolverDisparo", idPeticion, idPartida, resultado: avanzar(peticion.estado, peticion.entrada) };
      case "decidirIA": {
        const fuente = crearFuenteIA(peticion.personalidad, peticion.ultimoIntento, peticion.usosPorArma, peticion.danioRecibidoDesdeSuTurno);
        return { tipo: "decidirIA", idPeticion, idPartida, resultado: fuente(peticion.estado) };
      }
    }
  } catch (error) {
    return { tipo: "error", idPeticion, idPartida, mensaje: error instanceof Error ? error.message : String(error) };
  }
}
