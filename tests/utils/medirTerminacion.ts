// ms-1: mide si las partidas solo de IAs terminan con la muerte súbita activa.
// Lo usa `medir:ia -- --naves N --semillas S`, con el simulador real y todas las
// mecánicas encendidas (universo, compra al usar con la modalidad elegida).
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE } from "@/sim/ia/personalidades";
import type { Personalidad } from "@/sim/ia/tipos";
import { colocarNaves } from "@/sim/naves/colocacion";
import { avanzar } from "@/sim/partida/avanzar";
import { conMuerteSubita, RONDA_MUERTE_SUBITA } from "@/sim/partida/muerteSubita";
import type { EstadoPartida, ModoJuego, ParametrosMundo } from "@/sim/partida/tipos";
import { conUniverso } from "@/sim/universo/efectos";

const MUNDO: ParametrosMundo = { ancho: 1200, alto: 1600, gravedad: 0, deriva: 0, etiquetaDeriva: "medir-terminacion" };
const LIMITE_TURNOS = 200;
const PERFILES: readonly Personalidad[] = [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA, ALMIRANTE_BISAGRA];

export interface InformeTerminacion {
  readonly partidas: number;
  readonly terminadas: number;
  readonly empates: number;
  readonly turnoMedio: number;
  readonly turnoMaximo: number;
  readonly cotaTurnos: number;
}

export function medirTerminacion(naves: number, semillas: number, modo: ModoJuego): InformeTerminacion {
  const cotaTurnos = naves * (RONDA_MUERTE_SUBITA + 5) + 1;
  let terminadas = 0;
  let empates = 0;
  let suma = 0;
  let maximo = 0;
  for (let semilla = 1; semilla <= semillas; semilla++) {
    const colocacion = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), naves, Array.from({ length: naves }, () => true));
    let estado: EstadoPartida = conMuerteSubita(
      conUniverso({
        version: 1,
        mundo: MUNDO,
        mascara: colocacion.sistema.mascara,
        naves: colocacion.naves,
        ordenTurno: colocacion.naves.map((_, id) => id),
        turno: 0,
        numeroTurno: 0,
        aleatorio: colocacion.aleatorio,
        resultado: { tipo: "en-curso" },
        planetas: colocacion.sistema.planetas,
        modo,
        ...(modo === "presupuesto" ? { saldos: colocacion.naves.map(() => PRESUPUESTO_BASE) } : {}),
      }),
    );
    const usos: Record<string, number>[] = colocacion.naves.map(() => ({}));
    while (estado.resultado.tipo === "en-curso" && estado.numeroTurno < LIMITE_TURNOS) {
      const asiento = estado.turno;
      const { entrada, estado: decidido } = crearFuenteIA(PERFILES[asiento], null, usos[asiento])(estado);
      usos[asiento][entrada.arma] = (usos[asiento][entrada.arma] ?? 0) + 1;
      estado = avanzar(decidido, entrada).estado;
    }
    if (estado.resultado.tipo === "terminada") {
      terminadas += 1;
      if (estado.resultado.ganador === null) empates += 1;
    }
    suma += estado.numeroTurno;
    maximo = Math.max(maximo, estado.numeroTurno);
  }
  return { partidas: semillas, terminadas, empates, turnoMedio: suma / semillas, turnoMaximo: maximo, cotaTurnos };
}
