import { decidirTurnoIA, type UltimoIntentoIA } from "@/sim/ia/decidir";
import type { Personalidad } from "@/sim/ia/tipos";
import { naveContraria, type EstadoPartida, type FuenteDeTurno } from "@/sim/partida/tipos";

// Envuelve decidirTurnoIA como FuenteDeTurno para que una personalidad
// pueda jugar una partida completa con jugarPartida/jugarTurno (ia-3, ia-6):
// el azar de la decisión sale de estado.aleatorio y vuelve a él, nunca de un
// generador aparte -- es lo que mantiene la partida entera dentro del mismo
// generador con semilla que nucleo-4 exige.
//
// La corrección de ia-5 (el intento anterior contra el mismo objetivo) NO se
// puede calcular DENTRO de esta función: no ve el resultado real de su
// propio disparo -- eso lo resuelve avanzar() después de que jugarTurno ya
// ha llamado a esta función. Por eso se recibe como parámetro en vez de
// adivinarlo: el lote de simulación (loteAleatorio.ts) y los guiones fijos
// de depuración (jugarTurnosGuionizados) siguen pasando null (el mismo
// disparo antes/después de esta función no distingue de quién es el turno
// entre llamadas), y el bucle de partida en vivo (partida-completa,
// Partida.ts) sí puede leer el evento de impacto real antes del turno
// siguiente y pasarlo aquí.
export function crearFuenteIA(personalidad: Personalidad, ultimoIntento: UltimoIntentoIA | null = null): FuenteDeTurno {
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
      ultimoIntento,
      // Opcionales y aditivos (ia-multipozo): estado.planetas solo existe en
      // partidas de espacio abierto (Partida.ts, colocacion-naves) -- el
      // lote de simulación y los guiones de depuración en terreno llano
      // nunca lo tienen, así que decidirTurnoIA sigue su camino de siempre.
      origenY: estado.naves[tirador].y,
      objetivoY: estado.naves[objetivoId].y,
      planetas: estado.planetas,
    });

    return {
      entrada: resultado.entrada,
      estado: { ...estado, aleatorio: resultado.aleatorio },
    };
  };
}
