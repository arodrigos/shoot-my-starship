import type { Mascara } from "@/sim/terreno/mascara";
import type { RectanguloSucio } from "@/sim/terreno/huella";

// render-juego necesita reconciliar la máscara autoritativa que devuelve
// avanzar() (resolverDisparo clona y muta SU PROPIA copia, nunca la que
// pinta la cáscara) con la textura ya pintada en pantalla, sin conocer la
// forma de la huella de cada arma -- eso duplicaría en el render el mismo
// conocimiento que ya vive en el catálogo (circular, cápsula...) y es
// exactamente el tipo de divergencia que terreno-3 existe para atrapar. En
// vez de eso, esta función compara byte a byte las dos máscaras y devuelve
// el rectángulo que las acota: el mismo contrato de "rectángulo sucio" que
// ya usa aplicarHuellaCircular/Capsula, generalizado a "lo que sea que haya
// cambiado", que es también justo lo que necesita el repintado completo de
// render-5 tras perder el contexto WebGL.
export function calcularRectanguloDiferente(anterior: Mascara, nueva: Mascara): RectanguloSucio | null {
  if (anterior.ancho !== nueva.ancho || anterior.alto !== nueva.alto) {
    throw new Error("calcularRectanguloDiferente: las dos máscaras deben tener el mismo tamaño");
  }

  let minX = nueva.ancho;
  let maxX = -1;
  let minY = nueva.alto;
  let maxY = -1;

  for (let y = 0; y < nueva.alto; y++) {
    const base = y * nueva.ancho;
    for (let x = 0; x < nueva.ancho; x++) {
      if (anterior.datos[base + x] !== nueva.datos[base + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) {
    return null;
  }

  return { x: minX, y: minY, ancho: maxX - minX + 1, alto: maxY - minY + 1 };
}
