// ia-autodanio-3/5: el harness de medición que usan tanto scripts/medir-ia.ts
// (el informe que se publica) como los tests de umbral y reproducibilidad.
// Vive junto a loteAleatorio.ts porque depende del mismo jugador patrón
// (fuenteAleatoria) y del mismo mundo (MUNDO_LOTE): dos implementaciones del
// mismo harness medirían cosas distintas sin que nada lo avisara.
import { crearFuenteIA } from "@/sim/ia/fuente";
import type { Personalidad } from "@/sim/ia/tipos";
import { comprobarInvariante, crearPartidaInicial, jugarTurno } from "@/sim/partida/motor";
import type { EstadoPartida, FuenteDeTurno } from "@/sim/partida/tipos";
import { generarMascara } from "@/sim/terreno/generador";
import { fuenteAleatoria, LIMITE_TURNOS_LOTE, MUNDO_LOTE, NAVE0_X, NAVE1_X, semillasDelLote } from "./loteAleatorio";

// cal-6c: las mediciones recorren cinco semillas maestras y exigen que las
// bandas se cumplan en al menos cuatro. Una sola semilla elegida a mano (antes
// se reelegía cada vez que la colocación sembrada cambiaba) deja el resultado
// a merced del ruido de muestreo de ese mapa concreto. ia-autodanio-5 sigue
// pidiendo que "jugador patrón" sea un único concepto documentado: el lote de
// semillas es ese concepto.
export const SEMILLAS_MAESTRAS_MEDICION_IA: readonly number[] = [2024, 2028, 3031, 4057, 5099];
// Semillas en las que tiene que cumplirse una banda.
export const SEMILLAS_MINIMAS_EN_BANDA = 4;
// El criterio pide "al menos 200 partidas sembradas".
export const NUM_PARTIDAS_MEDICION_IA = 200;

export interface InformePersonalidad {
  readonly personalidad: string;
  readonly partidas: number;
  readonly tasaVictoria: number;
  // null solo si la personalidad no llegó a disparar en ninguna partida del
  // lote -- no ocurre con el catálogo y las 200 partidas actuales, pero una
  // media sobre cero disparos sería NaN, no un hueco silencioso.
  readonly errorMedioImpactoPx: number | null;
  readonly tasaAutoimpacto: number | null;
  readonly disparos: number;
  // Partidas donde comprobarInvariante encontró algo (nucleo-5 ya las vigila
  // en su propio test): se cuentan aquí en vez de abortar la medición entera
  // por un problema fuera del alcance de este bloque -- ia-autodanio no es
  // quien arregla nucleo-5, solo quien no debe esconder que pasó.
  readonly partidasConProblemas: number;
}

// Distancia horizontal entre el punto de impacto y la posición del objetivo
// EN EL MOMENTO DEL DISPARO (antes de que ese mismo disparo pueda
// desplazarlo con un empuje): es "cuánto se aparta el disparo de dar en el
// blanco real", no la dispersión interna de decidir.ts que ya mide ia-n4
// (esa compara contra su propia solución exacta, no contra el objetivo).
function medirPartida(personalidad: Personalidad, semilla: number, mascara: ReturnType<typeof generarMascara>) {
  let estado: EstadoPartida = crearPartidaInicial(MUNDO_LOTE, mascara, [NAVE0_X, NAVE1_X], semilla);

  let gano = false;
  let disparos = 0;
  let autoimpactos = 0;
  let sumaErrorImpacto = 0;
  let conteoErrorImpacto = 0;
  // ia-autodanio-3: la IA en vivo (Partida.ts) trackea esto fuera de
  // crearFuenteIA -- aquí lo hace el propio bucle de medición, que es quien
  // ve los eventos "disparo" reales de cada turno.
  let usosPorArma: Record<string, number> = {};

  while (estado.resultado.tipo === "en-curso" && estado.numeroTurno < LIMITE_TURNOS_LOTE) {
    const turnoDeEsteTurno = estado.turno;
    const objetivoXAntes = estado.naves[1].x;
    const fuentes: readonly [FuenteDeTurno, FuenteDeTurno] = [crearFuenteIA(personalidad, null, usosPorArma), fuenteAleatoria];
    const resultado = jugarTurno(estado, fuentes);
    estado = resultado.estado;
    for (const evento of resultado.eventos) {
      if (evento.tipo === "disparo" && evento.nave === 0) {
        disparos++;
        usosPorArma = { ...usosPorArma, [evento.arma]: (usosPorArma[evento.arma] ?? 0) + 1 };
      }
      if (evento.tipo === "autoimpacto" && evento.nave === 0) autoimpactos++;
      if (evento.tipo === "impacto" && turnoDeEsteTurno === 0) {
        sumaErrorImpacto += Math.abs(evento.x - objetivoXAntes);
        conteoErrorImpacto++;
      }
      if (evento.tipo === "partida-fin" && evento.ganador === 0) gano = true;
    }
  }

  const problemas = comprobarInvariante(estado);
  return { gano, disparos, autoimpactos, sumaErrorImpacto, conteoErrorImpacto, problemas };
}

// Pura en función de (personalidad, semillaMaestra, numPartidas): misma
// entrada, mismo informe, siempre -- es justo lo que ia-autodanio-5 exige
// comprobar.
export function medirPersonalidad(personalidad: Personalidad, semillaMaestra: number, numPartidas: number = NUM_PARTIDAS_MEDICION_IA): InformePersonalidad {
  const mascara = generarMascara(semillaMaestra, MUNDO_LOTE.ancho, MUNDO_LOTE.alto);
  const semillas = semillasDelLote(semillaMaestra, numPartidas);

  let victorias = 0;
  let disparos = 0;
  let autoimpactos = 0;
  let sumaErrorImpacto = 0;
  let conteoErrorImpacto = 0;
  let partidasConProblemas = 0;

  for (const semilla of semillas) {
    const resultado = medirPartida(personalidad, semilla, mascara);
    if (resultado.gano) victorias++;
    disparos += resultado.disparos;
    autoimpactos += resultado.autoimpactos;
    sumaErrorImpacto += resultado.sumaErrorImpacto;
    conteoErrorImpacto += resultado.conteoErrorImpacto;
    if (resultado.problemas.length > 0) partidasConProblemas++;
  }

  return {
    personalidad: personalidad.nombre,
    partidas: numPartidas,
    tasaVictoria: victorias / numPartidas,
    errorMedioImpactoPx: conteoErrorImpacto > 0 ? sumaErrorImpacto / conteoErrorImpacto : null,
    tasaAutoimpacto: disparos > 0 ? autoimpactos / disparos : null,
    disparos,
    partidasConProblemas,
  };
}

// Un informe por semilla maestra, en el orden de SEMILLAS_MAESTRAS_MEDICION_IA.
export function medirEnSemillas(personalidad: Personalidad, numPartidas: number = NUM_PARTIDAS_MEDICION_IA): readonly InformePersonalidad[] {
  return SEMILLAS_MAESTRAS_MEDICION_IA.map((semilla) => medirPersonalidad(personalidad, semilla, numPartidas));
}
