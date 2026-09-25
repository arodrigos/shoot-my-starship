// Integración del proyectil bajo gravedad y deriva, en coordenadas de
// mundo. Es el mismo paso que usará el arma real del bloque
// balistica-armas y el trazado de la IA del bloque ia-personalidades (ia-2
// exige EXACTAMENTE la misma función para el proyectil real y para el
// trazado que descarta soluciones bloqueadas): por eso vive aparte de
// cualquier concepto de arma o de terreno, y solo sabe de física.
export interface EstadoProyectil {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

// Referencia en píxeles/s² para que "gravedad" en los parámetros de mundo
// sea un multiplicador legible (0,6x .. 1,4x, ver decisión de ambientación)
// y no un número mágico sin unidad.
export const GRAVEDAD_REFERENCIA_PX_S2 = 700;

export function crearProyectil(x: number, y: number, vx: number, vy: number): EstadoProyectil {
  return { x, y, vx, vy };
}

// gravedad: multiplicador sobre GRAVEDAD_REFERENCIA_PX_S2 (el parámetro de
// mundo declarado en el mapa, nunca una constante cableada aquí -- eso es
// lo que arma-7 comprobará sobre el catálogo de armas). deriva: aceleración
// lateral en px/s², positiva hacia +x. pasoS: PASO_FIJO_MS en segundos,
// siempre el mismo valor mientras el paso sea "fijo".
export function integrarPasoProyectil(
  proyectil: EstadoProyectil,
  gravedad: number,
  deriva: number,
  pasoS: number,
): EstadoProyectil {
  const vx = proyectil.vx + deriva * pasoS;
  const vy = proyectil.vy + gravedad * GRAVEDAD_REFERENCIA_PX_S2 * pasoS;
  return {
    x: proyectil.x + vx * pasoS,
    y: proyectil.y + vy * pasoS,
    vx,
    vy,
  };
}
