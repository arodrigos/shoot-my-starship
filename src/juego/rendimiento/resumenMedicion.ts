// Resumen de la medición en el dispositivo (?rendimiento=1 → «Medir»). Todo es
// puro: el texto que se copia y se pega en un issue público sale solo de
// plantillas fijas y de cifras, nunca de la URL, del userAgent entero ni de
// nombres de jugadores.

import { percentil, UMBRAL_FRAME_LARGO_MS } from "@/juego/rendimiento/medidorFrames";

export type NombreTramo = "reposo" | "pepinazo" | "racimo" | "propulsores" | "turno-ia";

export const NOMBRES_TRAMO: Readonly<Record<NombreTramo, string>> = {
  reposo: "Reposo",
  pepinazo: "Pepinazo",
  racimo: "Racimo",
  propulsores: "Propulsores",
  "turno-ia": "Turno de la IA",
};

export interface TramoMedido {
  readonly nombre: NombreTramo;
  readonly frames: number;
  readonly p95: number;
  readonly max: number;
  readonly framesLargos: number;
  readonly duracionMs: number;
  readonly p95Vuelo?: number;
  readonly maxImpactoExplosion?: number;
  readonly scriptMs?: number;
  readonly renderPhaserMs?: number;
}

export interface EntornoMedicion {
  // Ya reducido a «Safari 26.2 / iPadOS» (ver resumirNavegador).
  readonly navegador: string;
  readonly ancho: number;
  readonly alto: number;
  readonly dpr: number;
  readonly version: string;
}

export interface Resumen {
  readonly tramos: readonly TramoMedido[];
  readonly entorno: EntornoMedicion;
  readonly apis: { readonly loaf: boolean; readonly eventTiming: boolean };
  readonly inpToques: number | null;
  readonly validez: { readonly valida: boolean; readonly motivos: readonly string[]; readonly avisos: readonly string[] };
}

export interface EntradaResumen {
  readonly tramos: readonly TramoMedido[];
  readonly entorno: EntornoMedicion;
  readonly apis: { readonly loaf: boolean; readonly eventTiming: boolean };
  readonly inpToques: number | null;
  readonly paginaOculta: boolean;
  // Mayor hueco entre dos frames de rAF durante algún tramo.
  readonly huecoMaxRafMs: number;
  readonly medianaReposoMs: number | null;
  // Por qué no llegó al final, si no llegó.
  readonly interrupcion: "cancelada" | "tiempo-agotado" | "sin-frames" | null;
}

export const HUECO_RAF_INVALIDO_MS = 1000;
export const REPOSO_30FPS_MIN_MS = 30;
export const REPOSO_30FPS_MAX_MS = 36;

export function estadisticasTramo(deltas: readonly number[]): Pick<TramoMedido, "frames" | "p95" | "max" | "framesLargos"> {
  const validos = deltas.filter((d) => Number.isFinite(d) && d >= 0);
  return {
    frames: validos.length,
    p95: percentil(validos, 0.95),
    max: validos.length ? Math.max(...validos) : 0,
    framesLargos: validos.filter((d) => d > UMBRAL_FRAME_LARGO_MS).length,
  };
}

export function medianaDe(valores: readonly number[]): number | null {
  const validos = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (validos.length === 0) return null;
  const mitad = validos.length >> 1;
  return validos.length % 2 === 1 ? validos[mitad] : (validos[mitad - 1] + validos[mitad]) / 2;
}

// Solo familia y versión mayor.menor: el userAgent entero lleva identificadores
// del dispositivo que no tienen sitio en un issue público.
export function resumirNavegador(userAgent: string): string {
  const ua = typeof userAgent === "string" ? userAgent : "";
  const version = (patron: RegExp): string => {
    const m = patron.exec(ua);
    return m ? m[1].replace(/_/g, ".") : "";
  };
  const sistema = /iPad/.test(ua) ? "iPadOS" : /iPhone/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "sistema desconocido";
  const edge = version(/Edg\/(\d+)/);
  const firefox = version(/Firefox\/(\d+(?:\.\d+)?)/);
  const chrome = version(/(?:Chrome|CriOS)\/(\d+)/);
  const safari = version(/Version\/(\d+(?:\.\d+)?)/);
  if (edge) return `Edge ${edge} / ${sistema}`;
  if (firefox) return `Firefox ${firefox} / ${sistema}`;
  if (chrome) return `Chrome ${chrome} / ${sistema}`;
  if (safari) return `Safari ${safari} / ${sistema}`;
  return `navegador desconocido / ${sistema}`;
}

export function construirResumen(entrada: EntradaResumen): Resumen {
  const motivos: string[] = [];
  const avisos: string[] = [];
  if (entrada.tramos.length === 0) motivos.push("sin datos: no se midió ningún tramo");
  if (entrada.paginaOculta) motivos.push("la pestaña estuvo oculta durante la medición");
  // Un hueco infinito (o no medible) tampoco da una medición fiable.
  if (!Number.isFinite(entrada.huecoMaxRafMs)) {
    motivos.push("rAF se detuvo (hueco no medible)");
  } else if (entrada.huecoMaxRafMs > HUECO_RAF_INVALIDO_MS) {
    motivos.push(`rAF se detuvo ${Math.round(entrada.huecoMaxRafMs)} ms`);
  }
  if (entrada.interrupcion === "cancelada") motivos.push("medición cancelada (INCOMPLETA)");
  if (entrada.interrupcion === "tiempo-agotado") motivos.push("tiempo agotado (INCOMPLETA)");
  if (entrada.interrupcion === "sin-frames") motivos.push("sin frames: la partida no llegó a pintar (¿pestaña en segundo plano o equipo muy lento?) (INCOMPLETA)");
  const m = entrada.medianaReposoMs;
  if (m !== null && Number.isFinite(m) && m >= REPOSO_30FPS_MIN_MS && m <= REPOSO_30FPS_MAX_MS) {
    avisos.push("rAF limitado a 30 fps (¿modo de bajo consumo?)");
  }
  return {
    tramos: entrada.tramos,
    entorno: entrada.entorno,
    apis: entrada.apis,
    // Un INP de 0 es "sin interacciones medidas", no una respuesta instantánea.
    inpToques: entrada.apis.eventTiming && entrada.inpToques !== null && entrada.inpToques > 0 ? entrada.inpToques : null,
    validez: { valida: motivos.length === 0, motivos, avisos },
  };
}

function cifra(valor: number | undefined | null, decimales = 1): string {
  return typeof valor === "number" && Number.isFinite(valor) ? valor.toFixed(decimales) : "sin datos";
}

function ms(valor: number | undefined | null): string {
  const c = cifra(valor);
  return c === "sin datos" ? c : `${c} ms`;
}

// Caracteres seguros para el rótulo del entorno: lo que venga de fuera nunca
// entra tal cual en el texto.
function limpiarRotulo(texto: string): string {
  return String(texto).replace(/[^A-Za-z0-9 ./·+_-]/g, "").slice(0, 60);
}

function lineaTramo(t: TramoMedido, resumen: Resumen): string {
  const partes = [`p95 ${ms(t.p95)}`, `max ${ms(t.max)}`, `largos ${Number.isFinite(t.framesLargos) ? t.framesLargos : "sin datos"}`];
  if (t.p95Vuelo !== undefined) partes.push(`p95 en vuelo ${ms(t.p95Vuelo)}`);
  if (t.maxImpactoExplosion !== undefined) partes.push(`impacto→explosión ${ms(t.maxImpactoExplosion)}`);
  if (resumen.apis.loaf) {
    if (t.scriptMs !== undefined) partes.push(`script ${ms(t.scriptMs)}`);
    if (t.renderPhaserMs !== undefined) partes.push(`render Phaser ${ms(t.renderPhaserMs)}`);
  } else if (t.renderPhaserMs !== undefined) {
    partes.push(`render Phaser (cronometrado por la app) ${ms(t.renderPhaserMs)}`);
  }
  return `${NOMBRES_TRAMO[t.nombre]}: ${partes.join(" · ")}`;
}

function filasMarkdown(resumen: Resumen): string[] {
  const { entorno, tramos, validez } = resumen;
  const sufijo = validez.valida ? "" : " (no válida)";
  const pantalla = `${cifra(entorno.ancho, 0)}x${cifra(entorno.alto, 0)}`;
  const caso = (nombre: string): string => `${nombre} ${pantalla} (${limpiarRotulo(entorno.navegador)})`;
  const filas: string[] = [];
  for (const nombre of ["pepinazo", "racimo"] as const) {
    const t = tramos.find((x) => x.nombre === nombre);
    if (!t) continue;
    filas.push(`| ${NOMBRES_TRAMO[nombre]} ${pantalla} (${limpiarRotulo(entorno.navegador)}) | ${ms(t.p95)} / ${ms(t.max)} / ${ms(t.maxImpactoExplosion)}${sufijo} |`);
  }
  const reposo = tramos.find((x) => x.nombre === "reposo");
  const propulsores = tramos.find((x) => x.nombre === "propulsores");
  if (reposo && propulsores) filas.push(`| ${caso(NOMBRES_TRAMO.propulsores)} | ${ms(reposo.p95)} | ${ms(propulsores.p95)}${sufijo} |`);
  for (const nombre of ["pepinazo", "racimo"] as const) {
    const t = tramos.find((x) => x.nombre === nombre);
    if (t) filas.push(`| ${caso(NOMBRES_TRAMO[nombre])} (vuelo) | ${ms(t.p95Vuelo)}${sufijo} |`);
  }
  return filas;
}

export function formatearResumen(resumen: Resumen): string {
  const lineas: string[] = [];
  if (!resumen.validez.valida) lineas.push(`NO VÁLIDA: ${resumen.validez.motivos.join("; ")}`);
  lineas.push("Medición de rendimiento");
  const e = resumen.entorno;
  lineas.push(`Entorno: ${limpiarRotulo(e.navegador)} · ${cifra(e.ancho, 0)}x${cifra(e.alto, 0)} px CSS · dpr ${cifra(e.dpr, 2)} · versión ${limpiarRotulo(e.version) || "sin datos"}`);
  lineas.push(
    `${resumen.apis.loaf ? "LoAF: sí" : "LoAF: no (sin separación script/render)"} · ${resumen.apis.eventTiming ? "Event Timing: sí" : "Event Timing: no · INP: no disponible"}`,
  );
  for (const aviso of resumen.validez.avisos) lineas.push(`Aviso: ${aviso}`);
  if (resumen.tramos.length === 0) {
    lineas.push("Tramos: sin datos");
  } else {
    for (const t of resumen.tramos) lineas.push(lineaTramo(t, resumen));
  }
  lineas.push(`INP de tus toques (no del recorrido): ${resumen.apis.eventTiming && resumen.inpToques !== null ? ms(resumen.inpToques) : "no disponible"}`);
  const filas = filasMarkdown(resumen);
  if (filas.length > 0) {
    lineas.push("", "Filas para docs/rendimiento.md:", ...filas);
  }
  return lineas.join("\n");
}
