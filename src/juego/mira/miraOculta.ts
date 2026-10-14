// mira-oculta-timeouts: la mira que se oculta por superar su presupuesto de
// cómputo no se vuelve a calcular a cada movimiento del apuntado. Con el
// ajuste cambiando cada fotograma, recalcular una mira que ya ha costado de
// más solo repetía el gasto que la había ocultado.

// Margen de la escena antes de reintentar una vez. Más corto reintenta en
// mitad de un arrastre; más largo deja al jugador sin mira demasiado rato.
export const REINTENTO_MIRA_OCULTA_MS = 1500;

export interface MiraOculta {
  readonly desdeMs: number;
  // Una mira forzada desde las pruebas no reintenta sola: así el contador de
  // cálculos no depende de cuánto tarde el test.
  readonly forzada: boolean;
}

export function ocultarMira(ahoraMs: number, forzada: boolean): MiraOculta {
  return { desdeMs: ahoraMs, forzada };
}

// true cuando ya toca pedir un único cálculo nuevo con el ajuste vigente.
export function tocaReintentarMira(oculta: MiraOculta, ahoraMs: number): boolean {
  return !oculta.forzada && ahoraMs - oculta.desdeMs >= REINTENTO_MIRA_OCULTA_MS;
}
