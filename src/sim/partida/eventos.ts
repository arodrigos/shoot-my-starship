import type { IdNave } from "@/sim/partida/tipos";

// Unión discriminada, deliberadamente mínima en este bloque: los eventos
// con nombre de humor (autoimpacto, deriva-traiciona, enterrado...) que
// describe la arquitectura los añade el bloque humor-sistemico sobre esta
// misma unión, cuando el catálogo de armas y sus efectos existan de verdad.
// Ampliar una unión discriminada es aditivo; no hay que tocar avanzar() ni
// este fichero para que ese bloque añada variantes nuevas.
export type EventoSimulacion =
  | {
      readonly tipo: "disparo";
      readonly nave: IdNave;
      readonly arma: string;
      readonly anguloGrados: number;
      readonly potencia: number;
    }
  | {
      readonly tipo: "impacto";
      readonly x: number;
      readonly y: number;
      readonly objetivo: IdNave;
      readonly danio: number;
      // Solo lo produce el Gravitón de Segunda Mano (balistica-armas):
      // positivo hacia +x. Opcional para no romper los eventos ya emitidos
      // por armas sin efecto de empuje.
      readonly desplazamientoPx?: number;
    }
  | { readonly tipo: "turno-fin"; readonly siguienteTurno: IdNave }
  | { readonly tipo: "partida-fin"; readonly ganador: IdNave };
