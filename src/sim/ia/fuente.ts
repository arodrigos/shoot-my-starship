import { decidirTurnoIA, type UltimoIntentoIA } from "@/sim/ia/decidir";
import type { Personalidad } from "@/sim/ia/tipos";
import type { NavePosicion } from "@/sim/naves/impacto";
import { naveContraria, type EstadoPartida, type FuenteDeTurno, type IdNave } from "@/sim/partida/tipos";

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
    const naveTiradora = estado.naves[tirador];
    const naveObjetivo = estado.naves[objetivoId];

    // ia-multipozo: mismo criterio que Partida.ts para decidir si hay casco
    // real que rastrear -- ambas naves con `y` es "modo espacial", el único
    // caso en el que existe más de un pozo de gravedad y decidirTurnoIA debe
    // cambiar a la búsqueda numérica. Sin él (terreno llano de siempre,
    // ia-1..ia-6), naves/tiradorId/objetivoId viajan undefined y
    // decidirTurnoIA reproduce el camino de siempre bit a bit.
    const modoEspacial = naveTiradora.y !== undefined && naveObjetivo.y !== undefined;
    const naves: readonly NavePosicion[] | undefined = modoEspacial
      ? estado.naves
          .map((nave, id) => ({ id: id as IdNave, nave }))
          .filter(({ nave }) => nave.integridad > 0)
          .map(({ id, nave }) => ({ id, x: nave.x, y: nave.y as number }))
      : undefined;

    const resultado = decidirTurnoIA({
      mascara: estado.mascara,
      origenX: naveTiradora.x,
      origenY: naveTiradora.y,
      objetivoX: naveObjetivo.x,
      objetivoY: naveObjetivo.y,
      gravedad: estado.mundo.gravedad,
      deriva: estado.mundo.deriva,
      ancho: estado.mundo.ancho,
      alto: estado.mundo.alto,
      personalidad,
      aleatorio: estado.aleatorio,
      ultimoIntento,
      planetas: estado.planetas,
      naves,
      tiradorId: modoEspacial ? tirador : undefined,
      objetivoId: modoEspacial ? objetivoId : undefined,
    });

    return {
      entrada: resultado.entrada,
      estado: { ...estado, aleatorio: resultado.aleatorio },
    };
  };
}
