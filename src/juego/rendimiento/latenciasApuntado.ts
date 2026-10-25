// apuntado-dedo: medidas de performance.measure del gesto de apuntado, desde
// el pointermove hasta el primer frame que pinta la flecha. Módulo propio
// (y no un campo de la escena) para que el panel ?rendimiento=1 las lea sin
// conocer la escena.
export interface LatenciaInteraccion {
  readonly nombre: "apuntado" | "rastro" | "reloj-turno" | "disparo" | "gesto-camara" | "ver-todo" | "reencuadre";
  readonly ms: number;
}

const CAPACIDAD = 60;
let medidas: LatenciaInteraccion[] = [];

export function registrarLatenciaApuntado(ms: number): void {
  medidas.push({ nombre: "apuntado", ms });
  if (medidas.length > CAPACIDAD) medidas.shift();
}

// rastro-ultimo-disparo (ras-4): del toque en «Rastro» al primer frame que
// redibuja la capa.
export function registrarLatenciaRastro(ms: number): void {
  medidas.push({ nombre: "rastro", ms });
  if (medidas.length > CAPACIDAD) medidas.shift();
}

// reloj-turno: del toque en «Soy …» al primer frame con la píldora pintada.
export function registrarLatenciaRelojTurno(ms: number): void {
  medidas.push({ nombre: "reloj-turno", ms });
  if (medidas.length > CAPACIDAD) medidas.shift();
}

// respuesta-disparo: del toque en «Disparar» al primer frame con el proyectil o
// el fogonazo del cañón.
export function registrarLatenciaDisparo(ms: number): void {
  medidas.push({ nombre: "disparo", ms });
  if (medidas.length > CAPACIDAD) medidas.shift();
}

// camara-gestos: del pointermove/rueda del gesto al primer frame con el nuevo
// encuadre, y del toque en «Ver todo» al primer frame que cambia.
export function registrarLatenciaCamara(nombre: "gesto-camara" | "ver-todo", ms: number): void {
  medidas.push({ nombre, ms });
  if (medidas.length > CAPACIDAD) medidas.shift();
}

// zonas-hud-camara: del toque que cambia el HUD (▾, ×, ▴, ⇄, Texto grande, ✕
// de la ayuda) al primer frame que aplica el encuadre nuevo.
export function registrarLatenciaReencuadre(ms: number): void {
  medidas.push({ nombre: "reencuadre", ms });
  if (medidas.length > CAPACIDAD) medidas.shift();
}

export function ultimasLatenciasApuntado(): readonly LatenciaInteraccion[] {
  return medidas.slice();
}

export function limpiarLatenciasApuntado(): void {
  medidas = [];
}
