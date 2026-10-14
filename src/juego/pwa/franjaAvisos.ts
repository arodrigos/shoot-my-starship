// Variable CSS con la que una pantalla con cabecera pegada empuja los avisos
// PWA hacia abajo para no taparla. Sin ella los avisos van al borde superior.
export const VARIABLE_TOP_AVISOS_PWA = "--avisos-pwa-top";

export function reservarFranjaAvisos(topPx: number): () => void {
  document.documentElement.style.setProperty(VARIABLE_TOP_AVISOS_PWA, `${topPx}px`);
  return () => document.documentElement.style.removeProperty(VARIABLE_TOP_AVISOS_PWA);
}
