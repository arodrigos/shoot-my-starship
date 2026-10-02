// Tamaño lógico del mundo del juego. Arranca en el valor histórico (16:9 de
// escritorio) pero encuadre-movil lo hace reconfigurable con
// configurarTamanoMundo antes de construir la escena de partida: son
// "export let" a propósito, no "const" -- el resto del código (Partida.ts,
// main.ts, geometriaProyectil.ts...) las lee dentro de funciones, nunca al
// cargar el módulo, así que ven el valor reasignado gracias al binding vivo
// de ES modules.
export let MUNDO_ANCHO = 1920;
export let MUNDO_ALTO = 1080;

const AREA_MUNDO_BASE = 1920 * 1080;

// encuadre-movil-2: a igualdad de aspecto, reducir solo el ancho o solo el
// alto no basta para que las naves se vean más grandes en pantallas
// pequeñas -- hay que reducir el ÁREA del mundo. Pero reducirla también en
// paisaje deja sin margen al generador de sistemas (generador.ts triplica su
// rejilla de planetas con relleno en píxeles fijos, y en mundos muy
// "anchos y bajos" ese relleno ya no cabe). El criterio de escala x1.6 solo
// se exige en retrato (360x640), así que la reducción se limita a esa
// orientación: en paisaje el área se mantiene y sobra margen de sobra.
const FACTOR_REDUCCION_AREA_RETRATO = 1.6;

// encuadre-movil-1: ajusta el mundo lógico al aspecto real del contenedor
// (no al del viewport completo -- layout-dos-zonas solo le da el 58% del
// alto) para eliminar el letterbox. Mantiene el área aproximadamente
// constante (salvo la reducción de retrato de arriba) en vez de solo
// estirar un eje, que distorsionaría el dibujo de naves y proyectiles.
export function configurarTamanoMundo(anchoContenedor: number, altoContenedor: number): void {
  if (!(anchoContenedor > 0) || !(altoContenedor > 0)) {
    return;
  }
  const aspecto = anchoContenedor / altoContenedor;
  const area = aspecto < 1 ? AREA_MUNDO_BASE / FACTOR_REDUCCION_AREA_RETRATO : AREA_MUNDO_BASE;
  MUNDO_ANCHO = Math.round(Math.sqrt(area * aspecto));
  MUNDO_ALTO = Math.round(Math.sqrt(area / aspecto));
}
