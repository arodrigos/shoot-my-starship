// encuadre-movil: única fuente de verdad del reparto vertical pantalla/zona
// de juego -- layout-dos-zonas fijaba este 58% directamente como CSS en
// PhaserGame.tsx, pero configurarTamanoMundo (constantes.ts) necesita el
// mismo número para calcular el tamaño real del contenedor sin depender de
// medir el DOM en los tests unitarios.
// hud-canales (octava corrección): bajado de 0,58 a 0,551 -- el mínimo que
// deja lay-1 (>=55% del alto) es 0,55; el margen de 0,001 es para que el
// redondeo de punto flotante no tire la comprobación por debajo del límite.
// El 0,8% que se libera (18,5px a 360x640) es justo lo que fila-avisos
// necesita para que el aviso de "espera a que termine el disparo" y la
// broma del disparo quepan los DOS a la vez sin recortarse -- se solapan en
// todo turno propio, porque el aviso depende de !puedeDisparar (que es
// cierto durante el vuelo y durante el turno rival) y la broma se publica
// sin excepción al resolver (hum-1).
export const FRACCION_ALTO_ZONA_JUEGO = 0.551;

export interface TamanoContenedor {
  readonly ancho: number;
  readonly alto: number;
}

// Replica el flex: 0 0 58% que aplica PhaserGame.tsx al div #game-container:
// el ancho es el del viewport completo, el alto es la fracción reservada.
export function calcularTamanoContenedorJuego(anchoViewport: number, altoViewport: number): TamanoContenedor {
  return {
    ancho: anchoViewport,
    alto: altoViewport * FRACCION_ALTO_ZONA_JUEGO,
  };
}
