// Tiro de la partida de medición: se elige entre los que el simulador real
// resuelve, no apuntando a ojo. Apuntar a una fracción de la solución balística
// del rival no garantiza dar en nada en un sistema con planetas: el tiro salía
// del mundo y el tramo se quedaba sin la cifra impacto→explosión.

export interface ResultadoTiroMedicion {
  readonly proyectilPerdido: boolean;
  readonly fallo: boolean;
  readonly detonaciones: number;
  readonly danioObjetivo: number;
  readonly danioPropio: number;
  readonly autoimpacto: boolean;
}

export interface TiroMedicion {
  readonly anguloGrados: number;
  readonly potencia: number;
}

export const ANGULOS_MEDICION: readonly number[] = Array.from({ length: 72 }, (_, i) => i * 5);
export const POTENCIAS_MEDICION: readonly number[] = [40, 55, 70, 85, 100];

// Un tiro sirve si detona, no se pierde, no se hace daño a sí mismo y deja con
// vida al rival (una partida acabada a mitad de recorrido deja tramos sin medir).
// De los que sirven gana el que menos daño hace; a igualdad, el primero.
export function elegirTiroMedicion(simular: (anguloGrados: number, potencia: number) => ResultadoTiroMedicion, integridadRival: number): TiroMedicion | null {
  let mejor: { tiro: TiroMedicion; danio: number } | null = null;
  for (const potencia of POTENCIAS_MEDICION) {
    for (const anguloGrados of ANGULOS_MEDICION) {
      const r = simular(anguloGrados, potencia);
      if (r.proyectilPerdido || r.fallo || r.detonaciones === 0 || r.autoimpacto || r.danioPropio > 0) continue;
      if (r.danioObjetivo >= integridadRival) continue;
      if (mejor === null || r.danioObjetivo < mejor.danio) mejor = { tiro: { anguloGrados, potencia }, danio: r.danioObjetivo };
    }
  }
  return mejor?.tiro ?? null;
}
