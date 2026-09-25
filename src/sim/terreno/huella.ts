import { AIRE, SOLIDO, type Mascara } from "@/sim/terreno/mascara";

export type SignoHuella = "restar" | "sumar";

export interface RectanguloSucio {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

// Único punto del código que escribe en la máscara fuera de la generación
// inicial (terreno-6 lo comprueba por grep): cráter, zanja, túnel o relleno
// son la misma operación con el signo cambiado -- "restar" vacía (una
// explosión), "sumar" rellena (un arma de utilidad como el Vertedero
// Portátil). El rectángulo sucio que devuelve es lo único que la cáscara
// necesita para no repintar el lienzo entero (terreno-5).
export function aplicarHuellaCircular(
  mascara: Mascara,
  cx: number,
  cy: number,
  radio: number,
  signo: SignoHuella,
): RectanguloSucio {
  const valor = signo === "restar" ? AIRE : SOLIDO;
  const minX = Math.max(0, Math.floor(cx - radio));
  const maxX = Math.min(mascara.ancho - 1, Math.ceil(cx + radio));
  const minY = Math.max(0, Math.floor(cy - radio));
  const maxY = Math.min(mascara.alto - 1, Math.ceil(cy + radio));
  const radioCuadrado = radio * radio;

  for (let y = minY; y <= maxY; y++) {
    const dy = y - cy;
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= radioCuadrado) {
        mascara.datos[y * mascara.ancho + x] = valor;
      }
    }
  }

  return {
    x: minX,
    y: minY,
    ancho: Math.max(0, maxX - minX + 1),
    alto: Math.max(0, maxY - minY + 1),
  };
}

// Cápsula horizontal (rectángulo con dos tapas semicirculares): la excavación
// alargada de la Zanjadora Manolita (armas-3, al menos 3 veces más ancha que
// alta). Misma técnica de distancia-al-punto-más-cercano que la circular,
// pero contra un segmento en vez de un punto: dxSegmento es 0 dentro del
// tramo recto y crece hacia los extremos, así que las tapas salen
// semicirculares sin código aparte.
export function aplicarHuellaCapsula(
  mascara: Mascara,
  cx: number,
  cy: number,
  medioLargo: number,
  radio: number,
  signo: SignoHuella,
): RectanguloSucio {
  const valor = signo === "restar" ? AIRE : SOLIDO;
  const minX = Math.max(0, Math.floor(cx - medioLargo - radio));
  const maxX = Math.min(mascara.ancho - 1, Math.ceil(cx + medioLargo + radio));
  const minY = Math.max(0, Math.floor(cy - radio));
  const maxY = Math.min(mascara.alto - 1, Math.ceil(cy + radio));
  const radioCuadrado = radio * radio;

  for (let y = minY; y <= maxY; y++) {
    const dy = y - cy;
    for (let x = minX; x <= maxX; x++) {
      const dxSegmento = Math.max(0, Math.abs(x - cx) - medioLargo);
      if (dxSegmento * dxSegmento + dy * dy <= radioCuadrado) {
        mascara.datos[y * mascara.ancho + x] = valor;
      }
    }
  }

  return {
    x: minX,
    y: minY,
    ancho: Math.max(0, maxX - minX + 1),
    alto: Math.max(0, maxY - minY + 1),
  };
}
