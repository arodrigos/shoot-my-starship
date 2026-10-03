// encuadre-movil: única fuente de verdad del reparto vertical pantalla/zona
// de juego -- layout-dos-zonas fijaba este 58% directamente como CSS en
// PhaserGame.tsx, pero configurarTamanoMundo (constantes.ts) necesita el
// mismo número para calcular el tamaño real del contenedor sin depender de
// medir el DOM en los tests unitarios.
// hud-canales (novena corrección): la octava corrección bajó esto a 0,551
// para liberarle sitio a fila-avisos, pero no comprobó el efecto sobre
// configurarTamanoMundo (constantes.ts): su reducción de área solo se
// aplica cuando el contenedor es más alto que ancho (aspecto < 1), y a
// 0,551 el contenedor de 360x640 pasa a ser más ANCHO que alto (360 >
// 640*0,551=352,6) -- cruza justo el borde donde esa reducción se desactiva
// de golpe, y la nave deja de verse 1,6x más grande que en dev
// (encuadre-movil-2, CI del PR #104: 0,247 contra el 0,3 exigido). El
// margen seguro más próximo al borde (aspecto < 1 con holgura) está hacia
// 0,563 y libera menos de 10px -- ni de lejos el sitio que fila-avisos
// necesitaba. El hueco se cierra acortando el texto del aviso en
// ControlHUD.tsx (la causa real medida: el aviso solo ya gastaba 52 de los
// 78px disponibles, sin dejar sitio ni para el mínimo de la broma), no
// tocando esta fracción, así que aquí se vuelve al valor que no arriesga
// el criterio de escala.
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
