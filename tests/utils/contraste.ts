// Cálculo de contraste WCAG 2.x compartido por los e2e que verifican esp-5
// (el cromado general) y con-3 (el panel de roce): un solo sitio para la
// fórmula evita que dos copias diverjan si algún día cambia el umbral.
export function componentesRGB(color: string): [number, number, number] {
  const coincidenciaHex = color.match(/^#([0-9a-f]{6})$/i);
  if (coincidenciaHex) {
    const hex = coincidenciaHex[1];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  const coincidenciaRgb = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (coincidenciaRgb) {
    return [Number(coincidenciaRgb[1]), Number(coincidenciaRgb[2]), Number(coincidenciaRgb[3])];
  }
  throw new Error(`color no reconocido: ${color}`);
}

export function luminanciaRelativa([r, g, b]: [number, number, number]): number {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [canal(r), canal(g), canal(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

export function ratioDeContraste(colorA: string, colorB: string): number {
  const la = luminanciaRelativa(componentesRGB(colorA));
  const lb = luminanciaRelativa(componentesRGB(colorB));
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

export const RATIO_MINIMO_TEXTO = 4.5;
