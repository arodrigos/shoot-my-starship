// apuntado-dedo: medidas de performance.measure del gesto de apuntado, desde
// el pointermove hasta el primer frame que pinta la flecha. Módulo propio
// (y no un campo de la escena) para que el panel ?rendimiento=1 las lea sin
// conocer la escena.
export interface LatenciaInteraccion {
  readonly nombre: "apuntado";
  readonly ms: number;
}

const CAPACIDAD = 60;
let medidas: LatenciaInteraccion[] = [];

export function registrarLatenciaApuntado(ms: number): void {
  medidas.push({ nombre: "apuntado", ms });
  if (medidas.length > CAPACIDAD) medidas.shift();
}

export function ultimasLatenciasApuntado(): readonly LatenciaInteraccion[] {
  return medidas.slice();
}

export function limpiarLatenciasApuntado(): void {
  medidas = [];
}
