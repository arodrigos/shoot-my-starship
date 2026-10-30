// Geometría de la trayectoria estimada que se ve mientras se apunta. Se mide
// en PANTALLA y no en mundo: con zoom de cámara, una longitud en pasos de
// simulación cambiaría de tamaño en el dispositivo y dejaría de leerse igual.
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

// Borde de un tramo del abanico entre dos radios de pantalla. Si el vuelo de ese
// borde choca antes de llegar al radio inicial (la mosca abre ±90° y con la nave
// posada un borde cae enseguida en el planeta), queda en el punto de choque
// repetido: la franja se pinta igualmente, cerrada en ese punto, en vez de
// desaparecer por tener un solo punto.
export function tramoEntre(puntos: readonly PuntoPantalla[], desde: number, hasta: number): PuntoPantalla[] {
  const a = cortarPorLongitudPantalla(puntos, desde);
  const b = cortarPorLongitudPantalla(puntos, hasta);
  if (a.length === 0) return [];
  // Si `desde` cae a mitad de segmento, el último punto de `a` es interpolado y
  // ocupa el índice del siguiente vértice real, que no hay que saltarse.
  const inicio = a[a.length - 1];
  const vertice = puntos[a.length - 1];
  const interpolado = inicio.x !== vertice.x || inicio.y !== vertice.y;
  const salida = [inicio, ...b.slice(interpolado ? a.length - 1 : a.length)];
  if (salida.length === 1) salida.push(salida[0]);
  return salida;
}

// Franja ancha del abanico como tiras entre trayectorias vecinas, cada una
// recortada entre r1 y r2. Una tira cuyo borde choca pronto queda cerrada en
// ese punto y el resto del sector se sigue pintando con las demás.
export function tirasTramo2(rayos: readonly (readonly PuntoPantalla[])[], desde: number, hasta: number): PuntoPantalla[][] {
  const bordes = rayos.map((r) => tramoEntre(r, desde, hasta));
  const tiras: PuntoPantalla[][] = [];
  for (let i = 1; i < bordes.length; i++) {
    const poligono = [...bordes[i - 1], ...[...bordes[i]].reverse()];
    if (areaPoligono(poligono) > 0) tiras.push(poligono);
  }
  return tiras;
}

export function areaPoligono(puntos: readonly PuntoPantalla[]): number {
  let doble = 0;
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i];
    const b = puntos[(i + 1) % puntos.length];
    doble += a.x * b.y - b.x * a.y;
  }
  return Math.abs(doble) / 2;
}
