import { buscarArma } from "@/sim/armas/catalogo";
import { PRESUPUESTO_VUELOS_RIVAL_TURNO, valorarRival } from "@/sim/ia/busquedaMultipozo";
import { decidirCompraTurno } from "@/sim/ia/compra";
import { debeActivarEscudoIA } from "@/sim/ia/equipo";
import { ARMA_BASE_ID, decidirTurnoIA, type UltimoIntentoIA } from "@/sim/ia/decidir";
import type { Personalidad } from "@/sim/ia/tipos";
import type { NavePosicion } from "@/sim/naves/impacto";
import { idsNavesVivas, type EstadoPartida, type FuenteDeTurno, type IdNave } from "@/sim/partida/tipos";

// nucleo-n-naves-5: con más de un rival vivo la IA elige a quién apunta por
// valor neto esperado (daño menos autodaño ponderado), no por cercanía: un
// rival cercano pero tapado por un planeta vale menos que uno lejano con
// línea de tiro. Cada rival paga una porción de PRESUPUESTO_ELECCION_OBJETIVO
// vuelos de rejilla gruesa y el ganador hace la búsqueda completa con lo que
// quede del techo de 192 por turno, así que el turno nunca pasa de ese techo.
// Con un solo rival no hay nada que elegir y no se gasta ni un vuelo: es lo
// que mantiene idénticas, bit a bit, las partidas 1vIA. El empate (también
// "ningún rival alcanzable") se rompe por cercanía horizontal.
export const PRESUPUESTO_ELECCION_OBJETIVO = 90;

interface EleccionObjetivo {
  readonly objetivoId: IdNave;
  readonly vuelosGastados: number;
}

function elegirObjetivo(tirador: IdNave, estado: EstadoPartida): EleccionObjetivo {
  const naveTiradora = estado.naves[tirador];
  const rivales = idsNavesVivas(estado).filter((id) => id !== tirador);
  const distancia = (id: IdNave): number => Math.abs(estado.naves[id].x - naveTiradora.x);
  const masCercano = (ids: readonly IdNave[]): IdNave => ids.reduce((mejor, id) => (distancia(id) < distancia(mejor) ? id : mejor));

  const modoEspacial = naveTiradora.y !== undefined && rivales.every((id) => estado.naves[id].y !== undefined);
  if (rivales.length === 1 || !modoEspacial) {
    return { objetivoId: masCercano(rivales), vuelosGastados: 0 };
  }

  const navesVivas: readonly NavePosicion[] = estado.naves
    .map((nave, id) => ({ id: id as IdNave, nave }))
    .filter(({ nave }) => nave.integridad > 0)
    .map(({ id, nave }) => ({ id, x: nave.x, y: nave.y as number, integridad: nave.integridad }));
  const porRival = Math.floor(PRESUPUESTO_ELECCION_OBJETIVO / rivales.length);
  const valores = rivales.map((id) => ({
    id,
    valor: valorarRival(
      {
        mascara: estado.mascara,
        ancho: estado.mundo.ancho,
        alto: estado.mundo.alto,
        planetas: estado.planetas,
        gravedad: estado.mundo.gravedad,
        deriva: estado.mundo.deriva,
        aleatorio: estado.aleatorio,
        arma: buscarArma(ARMA_BASE_ID),
        naves: navesVivas,
        tiradorId: tirador,
        objetivoId: id,
      },
      porRival,
    ),
  }));
  const mejorValor = Math.max(...valores.map(({ valor }) => valor));
  const empatados = valores.filter(({ valor }) => valor === mejorValor).map(({ id }) => id);
  return { objetivoId: masCercano(empatados), vuelosGastados: porRival * rivales.length };
}

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
export function crearFuenteIA(
  personalidad: Personalidad,
  ultimoIntento: UltimoIntentoIA | null = null,
  // ia-autodanio-3: cuántas veces lleva disparada cada arma esta nave en la
  // partida -- quien llama (Partida.ts para la partida en vivo, el lote de
  // medición para medir:ia) lo trackea y lo pasa aquí por el mismo motivo que
  // ultimoIntento: esta función no ve el resultado de turnos anteriores.
  usosPorArma: Readonly<Record<string, number>> = {},
  // escudo-y-propulsores: quien llama lleva la cuenta (esta fuente no ve los
  // turnos anteriores); por defecto la IA no se protege, que es lo de siempre.
  danioRecibidoDesdeSuTurno = false,
): FuenteDeTurno {
  return (estado: EstadoPartida) => {
    const tirador = estado.turno;
    const naveTiradora = estado.naves[tirador];
    const { objetivoId, vuelosGastados } = elegirObjetivo(tirador, estado);
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
          .map(({ id, nave }) => ({ id, x: nave.x, y: nave.y as number, integridad: nave.integridad }))
      : undefined;

    // economia-rectificada: con saldo, la IA decide su compra antes de apuntar
    // y el azar de esa decisión sale del mismo estado que el resto del turno.
    const saldo = estado.modo === "presupuesto" ? estado.saldos?.[tirador] : undefined;
    const compra =
      saldo === undefined
        ? undefined
        : decidirCompraTurno(personalidad, saldo, Math.floor(estado.numeroTurno / estado.ordenTurno.length), estado.aleatorio, usosPorArma);

    if (debeActivarEscudoIA({ integridad: naveTiradora.integridad, saldo, danioRecibidoDesdeSuTurno, escudoActivo: (naveTiradora.escudoTurnosRestantes ?? 0) > 0 })) {
      return { entrada: { accion: "escudo", arma: "escudo", anguloGrados: 0, potencia: 0, objetivoId }, estado };
    }

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
      aleatorio: compra?.aleatorio ?? estado.aleatorio,
      armaElegida: compra?.armaId,
      ultimoIntento,
      planetas: estado.planetas,
      naves,
      tiradorId: modoEspacial ? tirador : undefined,
      objetivoId,
      usosPorArma,
      // Solo cuando hubo elección entre rivales: con uno solo se deja el
      // valor por defecto para no tocar el camino 1vIA.
      ...(vuelosGastados > 0 ? { presupuestoVuelosMax: PRESUPUESTO_VUELOS_RIVAL_TURNO - vuelosGastados } : {}),
    });

    return {
      entrada: { ...resultado.entrada, objetivoId },
      estado: { ...estado, aleatorio: resultado.aleatorio },
    };
  };
}
