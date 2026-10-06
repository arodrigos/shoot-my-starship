// eco-4: mide si la IA se refugia en las armas gratis cuando podría pagar.
// Lo usan el informe `medir:ia -- --modo presupuesto` y su test, para que haya
// una sola medición y no dos que discrepen.
import { buscarArma, CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE } from "@/sim/ia/personalidades";
import type { Personalidad } from "@/sim/ia/tipos";
import { costeArma } from "@/sim/partida/economia";
import { avanzar } from "@/sim/partida/avanzar";
import { crearPartidaInicial } from "@/sim/partida/motor";
import type { EstadoPartida } from "@/sim/partida/tipos";
import { crearMascaraPlana } from "./terrenoPlano";

const MUNDO = { ancho: 1920, alto: 1080, gravedad: 1.0, deriva: 0, etiquetaDeriva: "medir-compra" };
const LIMITE_TURNOS = 40;
const POSICIONES_X = [200, 700, 1200, 1700];
// Tres perfiles juntos, con el agresivo repetido para llenar los 4 asientos.
const PERFILES: readonly Personalidad[] = [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA, ALMIRANTE_BISAGRA];

// El arma de pago de ataque más barata del catálogo: por debajo de ese saldo
// la IA no puede pagar nada útil y quedarse en las gratis es lo correcto.
const PRECIO_MINIMO_ATAQUE = Math.min(
  ...CATALOGO_ARMAS.filter((arma) => costeArma(arma) > 0 && arma.utilitaria !== true && arma.efecto.tipo !== "empuje" && arma.efecto.danioMaximo > 0).map(costeArma),
);

export interface InformeCompraIA {
  readonly turnosConSaldo: number;
  readonly turnosDePago: number;
  readonly porcentajeDePago: number;
}

export function medirCompraIA(semillas: number): InformeCompraIA {
  let turnosConSaldo = 0;
  let turnosDePago = 0;

  for (let semilla = 1; semilla <= semillas; semilla++) {
    const mascara = crearMascaraPlana(MUNDO.ancho, MUNDO.alto, 900);
    let estado: EstadoPartida = {
      ...crearPartidaInicial(MUNDO, mascara, POSICIONES_X, semilla),
      modo: "presupuesto",
      saldos: PERFILES.map(() => PRESUPUESTO_BASE),
    };
    const usos: Record<string, number>[] = PERFILES.map(() => ({}));

    while (estado.resultado.tipo === "en-curso" && estado.numeroTurno < LIMITE_TURNOS) {
      const asiento = estado.turno;
      const saldo = estado.saldos![asiento]!;
      const { entrada, estado: decidido } = crearFuenteIA(PERFILES[asiento], null, usos[asiento])(estado);
      const pagada = costeArma(buscarArma(entrada.arma)) > 0;
      if (saldo >= PRECIO_MINIMO_ATAQUE) {
        turnosConSaldo += 1;
        if (pagada) turnosDePago += 1;
      }
      usos[asiento][entrada.arma] = (usos[asiento][entrada.arma] ?? 0) + 1;
      estado = avanzar(decidido, entrada).estado;
    }
  }

  return { turnosConSaldo, turnosDePago, porcentajeDePago: turnosConSaldo === 0 ? 0 : (100 * turnosDePago) / turnosConSaldo };
}
