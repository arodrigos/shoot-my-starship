// ritmo-robot-propulsores: tiempos de reproducción de los propulsores y los
// saltos del Minirobot. Solo afectan a lo que se ve: el núcleo ya resolvió el
// turno y su resultado no depende de estas duraciones.

export const VELOCIDAD_PROPULSORES_U_S = 300;
export const DURACION_MIN_PROPULSORES_MS = 1500;
export const DURACION_MAX_PROPULSORES_MS = 3000;

export const REALCE_SALTO_MS = 300;
export const ARCO_SALTO_MS = 1100;
export const PAUSA_ATERRIZAJE_MS = 300;
export const DURACION_SALTO_MS = REALCE_SALTO_MS + ARCO_SALTO_MS + PAUSA_ATERRIZAJE_MS;

// Con movimiento reducido el recorrido se sigue viendo, pero a la mitad de tiempo.
const FACTOR_REDUCIDO = 0.5;

interface Punto {
  readonly x: number;
  readonly y: number;
}

export function longitudDeRuta(puntos: readonly Punto[]): number {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y);
  return total;
}

export function duracionPropulsoresMs(longitudU: number, reducido: boolean): number {
  const base = Math.min(DURACION_MAX_PROPULSORES_MS, Math.max(DURACION_MIN_PROPULSORES_MS, (longitudU / VELOCIDAD_PROPULSORES_U_S) * 1000));
  return reducido ? base * FACTOR_REDUCIDO : base;
}

export function duracionSaltosMs(saltos: number, reducido: boolean): number {
  return saltos * DURACION_SALTO_MS * (reducido ? FACTOR_REDUCIDO : 1);
}

// Aceleración y frenada: la nave arranca y se detiene suave en vez de a golpe.
export function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 2 * c * c : 1 - 2 * (1 - c) * (1 - c);
}

// Punto a la fracción t (0..1) de la longitud de una poligonal.
export function puntoDelRecorrido(camino: readonly Punto[], t: number): Punto {
  const total = longitudDeRuta(camino);
  let restante = total * Math.min(1, Math.max(0, t));
  for (let i = 1; i < camino.length; i++) {
    const largo = Math.hypot(camino[i].x - camino[i - 1].x, camino[i].y - camino[i - 1].y);
    if (restante <= largo && largo > 0) {
      const f = restante / largo;
      return { x: camino[i - 1].x + (camino[i].x - camino[i - 1].x) * f, y: camino[i - 1].y + (camino[i].y - camino[i - 1].y) * f };
    }
    restante -= largo;
  }
  return camino[camino.length - 1];
}

export type FaseSalto = "realce" | "arco" | "pausa";

export interface MuestraSalto {
  readonly fase: FaseSalto;
  readonly x: number;
  readonly y: number;
  // 0 → 1 dentro del realce, para que la cáscara pinte el aro.
  readonly realce: number;
}

// Posición del robot a los `msDesdeInicio` del salto: quieto en el origen
// durante el realce, en el aire (arco parabólico sobre la recta) durante el
// arco, y fijo en el destino durante la pausa.
export function muestraDeSalto(desde: Punto, hasta: Punto, msDesdeInicio: number, escala = 1): MuestraSalto {
  const realceMs = REALCE_SALTO_MS * escala;
  const arcoMs = ARCO_SALTO_MS * escala;
  if (msDesdeInicio < realceMs) return { fase: "realce", x: desde.x, y: desde.y, realce: Math.max(0, msDesdeInicio) / realceMs };
  if (msDesdeInicio >= realceMs + arcoMs) return { fase: "pausa", x: hasta.x, y: hasta.y, realce: 1 };
  const t = (msDesdeInicio - realceMs) / arcoMs;
  const distancia = Math.hypot(hasta.x - desde.x, hasta.y - desde.y);
  const altura = Math.min(160, distancia * 0.3);
  return {
    fase: "arco",
    x: desde.x + (hasta.x - desde.x) * t,
    // El eje y del mundo crece hacia abajo: el arco sube restando.
    y: desde.y + (hasta.y - desde.y) * t - Math.sin(Math.PI * t) * altura,
    realce: 1,
  };
}
