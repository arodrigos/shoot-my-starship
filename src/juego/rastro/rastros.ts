// rastro-ultimo-disparo: estado y reglas puras del rastro del último tiro. Sin
// Phaser, para poder comprobar las invariantes con property tests.
export interface PuntoRastro {
  readonly x: number;
  readonly y: number;
}

export interface Rastro {
  readonly asiento: number;
  readonly puntos: readonly PuntoRastro[];
  // null cuando el tiro salió del mundo: no hay silueta de impacto.
  readonly impacto: PuntoRastro | null;
}

export interface EstadoRastros {
  readonly ultimo: Rastro | null;
}

export const MAXIMO_PUNTOS_RASTRO = 64;
export const GUION_RASTRO_U = 8;
export const HUECO_RASTRO_U = 6;
export const ALFA_RASTRO = 0.4;
export const GROSOR_RASTRO_U = 2;
export const ESCALA_SILUETA_RASTRO = 0.6;

export const ESTADO_RASTROS_VACIO: EstadoRastros = { ultimo: null };

// Se queda con el primer y el último punto y reparte el resto a intervalos
// regulares: el primero es el cañón y el último el impacto, que no pueden
// perderse al aligerar.
export function diezmarTrayectoria<T>(puntos: readonly T[], maximo: number = MAXIMO_PUNTOS_RASTRO): readonly T[] {
  if (puntos.length <= maximo) return puntos;
  if (maximo < 2) return puntos.length === 0 ? puntos : [puntos[puntos.length - 1]];
  const resultado: T[] = [];
  const ultimo = puntos.length - 1;
  for (let i = 0; i < maximo; i += 1) {
    resultado.push(puntos[Math.round((i * ultimo) / (maximo - 1))]);
  }
  return resultado;
}

// Hay un único rastro: el del último disparo, sea de quien sea.
export function registrarRastro(asiento: number, puntos: readonly PuntoRastro[], impacto: PuntoRastro | null): EstadoRastros {
  if (puntos.length === 0) return { ultimo: null };
  return { ultimo: { asiento, puntos: diezmarTrayectoria(puntos), impacto } };
}

export function borrarRastro(): EstadoRastros {
  return ESTADO_RASTROS_VACIO;
}

export function rastroVisible(estado: EstadoRastros, activo: boolean): Rastro | null {
  return activo ? estado.ultimo : null;
}

export interface Segmento {
  readonly desde: PuntoRastro;
  readonly hasta: PuntoRastro;
}

// Parte la polilínea en tramos de `guion` unidades separados por `hueco`; el
// patrón continúa entre vértices para que las curvas no reinicien el guion.
export function segmentosDiscontinuos(puntos: readonly PuntoRastro[], guion: number = GUION_RASTRO_U, hueco: number = HUECO_RASTRO_U): readonly Segmento[] {
  const segmentos: Segmento[] = [];
  const periodo = guion + hueco;
  let recorrido = 0;
  for (let i = 1; i < puntos.length; i += 1) {
    const a = puntos[i - 1];
    const b = puntos[i];
    const largo = Math.hypot(b.x - a.x, b.y - a.y);
    if (largo === 0) continue;
    let t = 0;
    while (t < largo) {
      const fase = (recorrido + t) % periodo;
      const resto = fase < guion ? guion - fase : periodo - fase;
      const fin = Math.min(largo, t + resto);
      if (fase < guion) {
        segmentos.push({
          desde: { x: a.x + ((b.x - a.x) * t) / largo, y: a.y + ((b.y - a.y) * t) / largo },
          hasta: { x: a.x + ((b.x - a.x) * fin) / largo, y: a.y + ((b.y - a.y) * fin) / largo },
        });
      }
      t = fin;
    }
    recorrido += largo;
  }
  return segmentos;
}
