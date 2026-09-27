import type { Arma } from "@/sim/armas/tipos";

// Geometría pura del proyectil (sin Phaser), mismo motivo que
// geometriaCasco.ts: proy-1 exige medir la silueta desde la propia función
// que la genera, en Node y sin canvas.
export interface PuntoProyectil {
  readonly x: number;
  readonly y: number;
}

// El punto (18px de círculo) que el brief pide quitar. Se deja por encima
// con margen para que el redondeo de la normalización nunca lo rocé.
export const DIMENSION_MINIMA_PX = 22;
const DIMENSION_MAXIMA_PX = 60;

// Familia visual (eje de RENDER, no de daño): se deriva de los ejes que ya
// existen en el catálogo -- comportamiento, huella y efecto -- nunca de un
// id hardcodeado, mismo principio que el resolutor genérico (armas-1).
export type FamiliaVisual = "bomba" | "capsula" | "racimo" | "chatarra" | "orbe" | "flecha";

export function familiaVisualDe(arma: Arma): FamiliaVisual {
  if (arma.efecto.tipo === "danio-y-autodanio") return "flecha";
  if (arma.huella.tipo === "ninguna") return "orbe";
  if (arma.comportamiento.tipo === "submuniciones") return "racimo";
  if (arma.comportamiento.tipo === "rodante") return "chatarra";
  if (arma.huella.tipo === "capsula") return "capsula";
  return "bomba";
}

// Radio "de catálogo" del que parte el tamaño y la proporción del
// proyectil -- dato real del arma, no un número inventado por familia. Es lo
// que hace que dos armas de la MISMA familia visual (p. ej. las tres
// "bomba": Pepinazo, Tostadora y Petardo) no compartan silueta (proy-1: hash
// sin colisiones).
function radioDeCatalogo(arma: Arma): number {
  if (arma.huella.tipo === "circular") return arma.huella.radio;
  if (arma.huella.tipo === "capsula") return arma.huella.medioLargoPx;
  return 40; // "ninguna" (Gravitón): no hay huella de la que partir.
}

// Proporción ancho/alto de la silueta, derivada del mismo radio de catálogo
// (no de un id): dos armas de la misma familia con radios distintos acaban
// con siluetas distintas también cuando el tamaño final empata por el
// suelo/techo de abajo.
function aspectoDe(arma: Arma): number {
  const normalizado = radioDeCatalogo(arma) / 60;
  return Math.max(0.55, Math.min(1.6, normalizado));
}

function puntosCrudos(familia: FamiliaVisual, aspecto: number): readonly PuntoProyectil[] {
  const a = aspecto;
  switch (familia) {
    // Cuerpo ovoide con aleta trasera: la bomba clásica del género.
    case "bomba":
      return [
        { x: 1, y: 0 },
        { x: 0.25, y: 0.75 * a },
        { x: -0.85, y: 0.55 * a },
        { x: -1.15, y: 0 },
        { x: -0.85, y: -0.55 * a },
        { x: 0.25, y: -0.75 * a },
      ];
    // Alargada, morro y cola en punta: napalm/mortero.
    case "capsula":
      return [
        { x: 1.6, y: 0 },
        { x: 0.6, y: 0.45 * a },
        { x: -0.6, y: 0.45 * a },
        { x: -1.6, y: 0 },
        { x: -0.6, y: -0.45 * a },
        { x: 0.6, y: -0.45 * a },
      ];
    // Tres lóbulos con hueco central: se abre a media altura (submuniciones).
    case "racimo":
      return [
        { x: 1.1, y: 0 },
        { x: 0.3, y: 0.7 * a },
        { x: -0.6, y: 0.85 * a },
        { x: -1.1, y: 0.15 },
        { x: -0.6, y: -0.85 * a },
        { x: 0.3, y: -0.7 * a },
      ];
    // Polígono irregular determinista (no aleatorio): se lee como chatarra
    // rodante, nunca como un círculo perfecto.
    case "chatarra":
      return Array.from({ length: 9 }, (_, i) => {
        const angulo = (i / 9) * Math.PI * 2;
        const r = 0.6 + 0.4 * Math.abs(Math.sin(i * 2.4)) * a;
        return { x: Math.cos(angulo) * r, y: Math.sin(angulo) * r };
      });
    // Anillo (Gravitón): octógono, sin morro -- no vuela hacia nada, solo
    // empuja.
    case "orbe":
      return Array.from({ length: 8 }, (_, i) => {
        const angulo = (i / 8) * Math.PI * 2;
        return { x: Math.cos(angulo) * 1.3, y: Math.sin(angulo) * 1.3 * a };
      });
    // Flecha con cola de plumas (Despedida: "hazlo con estilo").
    case "flecha":
      return [
        { x: 1.7, y: 0 },
        { x: 0.5, y: 0.55 * a },
        { x: 0.5, y: 0.18 * a },
        { x: -1.5, y: 0.18 * a },
        { x: -1.5, y: -0.18 * a },
        { x: 0.5, y: -0.18 * a },
        { x: 0.5, y: -0.55 * a },
      ];
  }
}

export function dimensionMayor(puntos: readonly PuntoProyectil[]): number {
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const ancho = Math.max(...xs) - Math.min(...xs);
  const alto = Math.max(...ys) - Math.min(...ys);
  return Math.max(ancho, alto);
}

// Silueta local (morro en +x, listo para rotar según el vector velocidad):
// se genera a tamaño unitario y se normaliza a la dimensión objetivo, así
// que proy-1 (>=18px) se cumple por construcción, no por suerte de
// parámetros.
export function puntosSilueta(arma: Arma): readonly PuntoProyectil[] {
  const familia = familiaVisualDe(arma);
  const aspecto = aspectoDe(arma);
  const crudos = puntosCrudos(familia, aspecto);
  const dimensionCruda = dimensionMayor(crudos);
  const objetivo = Math.max(DIMENSION_MINIMA_PX, Math.min(radioDeCatalogo(arma) * 0.9, DIMENSION_MAXIMA_PX));
  const factor = objetivo / dimensionCruda;
  return crudos.map((p) => ({ x: p.x * factor, y: p.y * factor }));
}

// Hash estable de una silueta (proy-1: "sin colisiones" entre armas del
// catálogo) -- coordenadas redondeadas para que el mismo arma produzca
// siempre el mismo hash entre llamadas.
export function hashSilueta(puntos: readonly PuntoProyectil[]): string {
  return puntos.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("|");
}

// Rayo láser (proy-3): haz recto instantáneo, no una silueta local que gira
// con la velocidad -- un segmento en coordenadas de MUNDO entre el origen
// del disparo y el punto de impacto/detención, tal cual lo calcularía
// cualquier traza de línea (Bresenham incluido: es la misma recta).
export function segmentoHazLaser(
  origen: PuntoProyectil,
  impacto: PuntoProyectil,
): readonly [PuntoProyectil, PuntoProyectil] {
  return [origen, impacto];
}
