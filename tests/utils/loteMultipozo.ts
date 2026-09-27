import { crearEstadoAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { colocarNaves } from "@/sim/naves/colocacion";
import type { SistemaGenerado } from "@/sim/sistema/generador";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import { MUNDO_ANCHO, MUNDO_ALTO } from "./sistemaGenerado";

// ia-multipozo: mundo de referencia compartido por ia-n1/n9/n10 -- el mismo
// tamaño real que ya usa nav-3 (1920x1080), para que "colocación válida" en
// estos tests signifique lo mismo que en producción, no un mundo de
// laboratorio más pequeño donde la rejilla se comporta distinto.
export const MUNDO_MULTIPOZO: ParametrosMundo = {
  ancho: MUNDO_ANCHO,
  alto: MUNDO_ALTO,
  gravedad: 1,
  deriva: 0,
  etiquetaDeriva: "ninguna",
};

export interface SistemaColocado {
  readonly semilla: number;
  readonly sistema: SistemaGenerado;
  readonly naveA: { readonly id: 0; readonly x: number; readonly y: number };
  readonly naveB: { readonly id: 1; readonly x: number; readonly y: number };
  readonly aleatorio: EstadoAleatorio;
}

// Un sistema colocado por semilla, 0..n-1: la MISMA colocación (viabilidad ya
// garantizada por imp-8/imp-9) que usarían nav-3/imp-8 para esas semillas,
// así que "colocación válida" aquí es literalmente la que el juego real
// produciría, nunca un escenario de laboratorio a medida del test.
export function generarLoteDeSistemas(n: number, mundo: ParametrosMundo = MUNDO_MULTIPOZO): readonly SistemaColocado[] {
  const lote: SistemaColocado[] = [];
  for (let semilla = 0; semilla < n; semilla++) {
    const { sistema, naves, aleatorio } = colocarNaves(semilla, mundo, crearEstadoAleatorio(semilla));
    const [a, b] = naves;
    lote.push({
      semilla,
      sistema,
      naveA: { id: 0, x: a.x, y: a.y as number },
      naveB: { id: 1, x: b.x, y: b.y as number },
      aleatorio,
    });
  }
  return lote;
}
