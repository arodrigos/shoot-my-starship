// Punto de observación que los tests de Playwright leen desde fuera del
// juego (window.__debug.*). Vive en un módulo aparte para que cada bloque
// añada sus propios campos sin que el núcleo de simulación (src/sim, que no
// puede depender de window) tenga que saber que existe.
export interface DebugGlobal {
  ultimoPunto?: { x: number; y: number };
}

declare global {
  interface Window {
    __debug: DebugGlobal;
  }
}
