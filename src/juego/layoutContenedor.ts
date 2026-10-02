// encuadre-movil: única fuente de verdad del reparto vertical pantalla/zona
// de juego -- layout-dos-zonas fijaba este 58% directamente como CSS en
// PhaserGame.tsx, pero configurarTamanoMundo (constantes.ts) necesita el
// mismo número para calcular el tamaño real del contenedor sin depender de
// medir el DOM en los tests unitarios.
export const FRACCION_ALTO_ZONA_JUEGO = 0.58;

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
