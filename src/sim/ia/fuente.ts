import { decidirTurnoIA } from "@/sim/ia/decidir";
import type { Personalidad } from "@/sim/ia/tipos";
import { naveContraria, type EstadoPartida, type FuenteDeTurno } from "@/sim/partida/tipos";

// Envuelve decidirTurnoIA como FuenteDeTurno para que una personalidad
// pueda jugar una partida completa con jugarPartida/jugarTurno (ia-3, ia-6):
// el azar de la decisión sale de estado.aleatorio y vuelve a él, nunca de un
// generador aparte -- es lo que mantiene la partida entera dentro del mismo
// generador con semilla que nucleo-4 exige.
//
// La corrección de ia-5 (el intento anterior contra el mismo objetivo) NO
// se enhebra aquí: esta fuente no ve el resultado real de su propio disparo
// -- eso lo resuelve avanzar() después de que jugarTurno ya ha llamado a
// esta función -- y aproximarlo aquí sería adivinar en vez de usar el dato
// real. decidirTurnoIA ya soporta `ultimoIntento`; la integración con el
// resultado real de cada turno es del bloque que construya el bucle de
// partida en vivo (partida-completa), que sí puede leer el evento de
// impacto real antes del turno siguiente.
export function crearFuenteIA(personalidad: Personalidad): FuenteDeTurno {
  return (estado: EstadoPartida) => {
    const tirador = estado.turno;
    const objetivoId = naveContraria(tirador);

    const resultado = decidirTurnoIA({
      mascara: estado.mascara,
      origenX: estado.naves[tirador].x,
      objetivoX: estado.naves[objetivoId].x,
      gravedad: estado.mundo.gravedad,
      deriva: estado.mundo.deriva,
      ancho: estado.mundo.ancho,
      alto: estado.mundo.alto,
      personalidad,
      aleatorio: estado.aleatorio,
      ultimoIntento: null,
    });

    return {
      entrada: resultado.entrada,
      estado: { ...estado, aleatorio: resultado.aleatorio },
    };
  };
}
