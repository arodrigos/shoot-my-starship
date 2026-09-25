// Comprobación previa a instanciar Phaser (criterio andamiaje-4). Se hace
// con un canvas de usar y tirar, nunca con el propio canvas del juego: así
// el fallo se detecta ANTES de montar Phaser, y nunca llega a producirse la
// excepción no capturada ni el rectángulo negro que el criterio prohíbe.
export function hayWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return contexto !== null;
  } catch {
    return false;
  }
}
