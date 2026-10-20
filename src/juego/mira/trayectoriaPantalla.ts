// Geometría de la trayectoria estimada que se ve mientras se apunta. Se mide
// en PANTALLA y no en mundo: con zoom de cámara, una longitud en pasos de
// simulación cambiaría de tamaño en el dispositivo y dejaría de leerse igual.
export const LADO_REFERENCIA = "mayor" as const;
export const SEMIAPERTURA_TRAMO1_GRADOS = 9;
export const SEMIAPERTURA_TRAMO2_GRADOS = 45;
// La mosca es la más impredecible: el abanico tiene que dejarlo ver.
export const FACTOR_MOSCA = 2;
export const ID_ARMA_MOSCA = "mosca-cojonera";

export interface GeometriaTrayectoria {
  readonly L: number;
  readonly radioTramo1Px: number;
  readonly radioTramo2Px: number;
  readonly semiapertura1: number;
  readonly semiapertura2: number;
}

export function geometriaTrayectoria(entrada: { readonly anchoCss: number; readonly altoCss: number; readonly armaId: string }): GeometriaTrayectoria {
  const L = Math.max(entrada.anchoCss, entrada.altoCss);
  const factor = entrada.armaId === ID_ARMA_MOSCA ? FACTOR_MOSCA : 1;
  return {
    L,
    radioTramo1Px: L / 8,
    radioTramo2Px: L / 4,
    semiapertura1: SEMIAPERTURA_TRAMO1_GRADOS * factor,
    semiapertura2: SEMIAPERTURA_TRAMO2_GRADOS * factor,
  };
}

export interface PuntoPantalla {
  readonly x: number;
  readonly y: number;
}

export function longitudDeArco(puntos: readonly PuntoPantalla[]): number {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y);
  return total;
}

// Devuelve un prefijo de la polilínea: los segmentos enteros que caben más un
// último segmento recortado, de modo que la línea termina justo en la longitud.
export function cortarPorLongitudPantalla(puntos: readonly PuntoPantalla[], longitudPx: number): readonly PuntoPantalla[] {
  if (puntos.length === 0 || longitudPx <= 0) return puntos.slice(0, Math.min(1, puntos.length));
  const salida: PuntoPantalla[] = [puntos[0]];
  let acumulado = 0;
  for (let i = 1; i < puntos.length; i++) {
    const tramo = Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y);
    if (acumulado + tramo <= longitudPx) {
      salida.push(puntos[i]);
      acumulado += tramo;
      continue;
    }
    const resto = longitudPx - acumulado;
    if (tramo > 0 && resto > 0) {
      const t = resto / tramo;
      salida.push({ x: puntos[i - 1].x + (puntos[i].x - puntos[i - 1].x) * t, y: puntos[i - 1].y + (puntos[i].y - puntos[i - 1].y) * t });
    }
    break;
  }
  return salida;
}
