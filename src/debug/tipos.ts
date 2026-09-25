// Punto de observación que los tests de Playwright leen desde fuera del
// juego (window.__debug.*). Vive en un módulo aparte para que cada bloque
// añada sus propios campos sin que el núcleo de simulación (src/sim, que no
// puede depender de window) tenga que saber que existe.
export interface DebugTerreno {
  esSolido: (x: number, y: number) => boolean;
  // Compara máscara y textura en un lote de puntos con UNA sola lectura del
  // canvas (terreno-3): devuelve, para cada punto, si esSolido(x,y) coincide
  // con que el píxel de la textura tenga alfa > 0.
  comprobarPuntos: (puntos: { x: number; y: number }[]) => boolean[];
  aplicarHuella: (
    cx: number,
    cy: number,
    radio: number,
    signo: "restar" | "sumar",
  ) => { x: number; y: number; ancho: number; alto: number };
  // true en cuanto el guion de huellas de la escena de pruebas ha terminado
  // de aplicarse -- así el test no depende de una espera fija (issue #151).
  listo: boolean;
}

export interface DebugGlobal {
  ultimoPunto?: { x: number; y: number };
  terreno?: DebugTerreno;
}

declare global {
  interface Window {
    __debug: DebugGlobal;
  }
}
