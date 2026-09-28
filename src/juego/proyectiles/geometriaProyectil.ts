import type { Arma } from "@/sim/armas/tipos";
import { MUNDO_ANCHO } from "@/juego/constantes";

// Geometría pura del proyectil (sin Phaser), mismo motivo que
// geometriaCasco.ts: proy-1 exige medir la silueta desde la propia función
// que la genera, en Node y sin canvas.
export interface PuntoProyectil {
  readonly x: number;
  readonly y: number;
}

// proy-1 (sexta devolución): exige 18px "a escala de juego", y eso es
// pantalla, no mundo. Con Phaser.Scale.FIT, el mundo de MUNDO_ANCHO px de
// ancho se encoge al ancho real del lienzo -- a 360px (esp-4/proy-5, el
// viewport móvil mínimo que declara el diseño) un proyectil de 22px de
// mundo (el valor de antes de esta corrección) se veía como una mota de
// ~4px, exactamente el punto que Adrián pidió quitar. El suelo se declara
// en unidades de mundo pero se calcula a partir del mínimo en pantalla.
const ANCHO_VIEWPORT_MINIMO_PX = 360;
const ESCALA_RENDER_MINIMA = ANCHO_VIEWPORT_MINIMO_PX / MUNDO_ANCHO;
const DIMENSION_MINIMA_RENDER_PX = 18;

// Suelo con margen (el redondeo de la normalización nunca lo roza) y techo
// proporcional, ambos en unidades de mundo.
export const DIMENSION_MINIMA_PX = Math.ceil(DIMENSION_MINIMA_RENDER_PX / ESCALA_RENDER_MINIMA) + 8;
const DIMENSION_MAXIMA_PX = DIMENSION_MINIMA_PX * 2;

// Familia visual (eje de RENDER, no de daño): se deriva de los ejes que ya
// existen en el catálogo -- comportamiento, huella, efecto y los tres ejes
// de armas-nuevas -- nunca de un id hardcodeado, mismo principio que el
// resolutor genérico (armas-1). Sexta devolución de proy-1: las tres armas
// de armas-nuevas (andanada, barrena, láser) caían por descarte en "bomba"
// -- comparten familia y por tanto silueta con el resto del catálogo --
// así que aquí se les da contorno propio antes de comprobar nada más.
export type FamiliaVisual =
  | "bomba"
  | "capsula"
  | "racimo"
  | "chatarra"
  | "orbe"
  | "flecha"
  | "broca"
  | "haz";

export function familiaVisualDe(arma: Arma): FamiliaVisual {
  if (arma.comportamiento.tipo === "instantaneo") return "haz"; // Rayo Láser
  if (arma.penetracionPx !== undefined) return "broca"; // Barrena Planetaria
  if (arma.disparosSimultaneos !== undefined) return "flecha"; // Andanada de Flechas
  if (arma.efecto.tipo === "danio-y-autodanio") return "flecha"; // Despedida
  if (arma.huella.tipo === "ninguna") return "orbe"; // Gravitón
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
    // proy-1 (sexta devolución): "racimo" se comentaba como tres lóbulos con
    // hueco central y salía un hexágono -- una curva rosa r=cos(3θ) da tres
    // pétalos DE VERDAD, que se pellizcan hasta el centro entre uno y otro
    // (r=0 en los seis puntos donde cos(3θ)<0), así que los tres lóbulos
    // quedan separados por un hueco real, no solo sugerido por el color.
    case "racimo": {
      const segmentosPorLobulo = 8;
      const totalSegmentos = segmentosPorLobulo * 3;
      return Array.from({ length: totalSegmentos + 1 }, (_, i) => {
        const angulo = (i / totalSegmentos) * Math.PI * 2;
        const radio = 1.3 * Math.max(0, Math.cos(3 * angulo));
        return { x: Math.cos(angulo) * radio, y: Math.sin(angulo) * radio * a };
      });
    }
    // Polígono irregular determinista (no aleatorio): se lee como chatarra
    // rodante, nunca como un círculo perfecto.
    case "chatarra":
      return Array.from({ length: 9 }, (_, i) => {
        const angulo = (i / 9) * Math.PI * 2;
        const r = 0.6 + 0.4 * Math.abs(Math.sin(i * 2.4)) * a;
        return { x: Math.cos(angulo) * r, y: Math.sin(angulo) * r };
      });
    // proy-1 (sexta devolución): "orbe" se comentaba como anillo del
    // Gravitón y salía un polígono relleno sin hueco. Graphics.fillPoints no
    // soporta un agujero real (una sola pasada, sin segundo contorno), así
    // que se traza un único contorno que sale por el borde exterior, cruza
    // por una rendija angular estrecha al borde interior, vuelve por dentro
    // y cierra -- bajo la regla de relleno "non-zero" eso pinta la banda del
    // anillo y deja vacío el centro, con un único polígono simple (sin
    // autointersecciones) que earcut triangula sin problema.
    case "orbe": {
      const segmentos = 16;
      const radioExterior = 1.3;
      const radioInterior = 0.55;
      const rendijaRad = 0.05;
      const puntos: PuntoProyectil[] = [];
      for (let i = 0; i <= segmentos; i++) {
        const angulo = rendijaRad + (i / segmentos) * (Math.PI * 2 - rendijaRad * 2);
        puntos.push({ x: Math.cos(angulo) * radioExterior, y: Math.sin(angulo) * radioExterior * a });
      }
      for (let i = segmentos; i >= 0; i--) {
        const angulo = rendijaRad + (i / segmentos) * (Math.PI * 2 - rendijaRad * 2);
        puntos.push({ x: Math.cos(angulo) * radioInterior, y: Math.sin(angulo) * radioInterior * a });
      }
      return puntos;
    }
    // Flecha con cola de plumas: Despedida ("hazlo con estilo") y, desde la
    // sexta devolución de proy-1, también Andanada de Flechas -- que antes
    // caía por descarte en "bomba" y se dibujaba como una granada en vez de
    // como lo que su nombre dice.
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
    // proy-1 (sexta devolución): Barrena Planetaria pedía "broca" -- morro
    // en punta y un eje con muescas alternas (el filo en espiral de una
    // broca), no el óvalo liso de "bomba" que tenía antes.
    case "broca": {
      const puntos: PuntoProyectil[] = [{ x: 1.7, y: 0 }];
      const muescas = 5;
      for (let i = 0; i < muescas; i++) {
        const x = 1.1 - (i / (muescas - 1)) * 2.4;
        const radioLocal = (0.2 + (i / (muescas - 1)) * 0.35) * a;
        puntos.push({ x, y: i % 2 === 0 ? radioLocal : radioLocal * 0.35 });
      }
      for (let i = muescas - 1; i >= 0; i--) {
        const x = 1.1 - (i / (muescas - 1)) * 2.4;
        const radioLocal = (0.2 + (i / (muescas - 1)) * 0.35) * a;
        puntos.push({ x, y: i % 2 === 0 ? -radioLocal : -radioLocal * 0.35 });
      }
      return puntos;
    }
    // proy-1 (sexta devolución): Rayo Láser pedía "haz recto", coherente con
    // que proy-3 ya lo dibuja como trazo instantáneo -- una aguja fina y
    // alargada, no el óvalo grueso de "bomba" que compartía con media
    // docena de armas más.
    case "haz":
      return [
        { x: 1.9, y: 0 },
        { x: 0.35, y: 0.14 * a },
        { x: -1.9, y: 0.14 * a },
        { x: -1.9, y: -0.14 * a },
        { x: 0.35, y: -0.14 * a },
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

// Extremos reales del catálogo (Andanada 14px .. Despedida 95px de
// radioDeCatalogo): fijos como referencia de variedad de tamaño, no
// recalculados por arma, para que añadir un arma nueva con un radio fuera
// de este rango solo estire el reparto en vez de romperlo.
const RADIO_CATALOGO_MIN_PX = 14;
const RADIO_CATALOGO_MAX_PX = 95;

function clamp01(valor: number): number {
  return Math.max(0, Math.min(1, valor));
}

// Silueta local (morro en +x, listo para rotar según el vector velocidad):
// se genera a tamaño unitario y se normaliza a una dimensión objetivo entre
// el suelo (DIMENSION_MINIMA_PX, ya en escala de pantalla) y el techo,
// repartida según el radio real de catálogo -- así proy-1 (>=18px en
// pantalla) se cumple por construcción para toda el catálogo, y las armas
// más grandes siguen viéndose más grandes que Andanada o el Gravitón.
export function puntosSilueta(arma: Arma): readonly PuntoProyectil[] {
  const familia = familiaVisualDe(arma);
  const aspecto = aspectoDe(arma);
  const crudos = puntosCrudos(familia, aspecto);
  const dimensionCruda = dimensionMayor(crudos);
  const radioNormalizado = clamp01(
    (radioDeCatalogo(arma) - RADIO_CATALOGO_MIN_PX) / (RADIO_CATALOGO_MAX_PX - RADIO_CATALOGO_MIN_PX),
  );
  const objetivo = DIMENSION_MINIMA_PX + radioNormalizado * (DIMENSION_MAXIMA_PX - DIMENSION_MINIMA_PX);
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
