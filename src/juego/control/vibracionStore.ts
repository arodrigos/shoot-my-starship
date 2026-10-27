import { decidirVibracion, motivoApagada, type MotivoApagada, type TipoVibracion } from "@/juego/control/vibracion";
import { obtenerMedicion } from "@/juego/control/medicionStore";

export interface ProveedorVibracion {
  vibrate(patron: number | readonly number[]): boolean;
}

export interface LlamadaVibracion {
  readonly tipo: TipoVibracion;
  readonly patron: readonly number[];
  readonly t: number;
  readonly aceptada: boolean;
}

export interface InstantaneaVibracion {
  readonly soportada: boolean;
  readonly preferencia: boolean;
  readonly movimientoReducido: boolean;
  readonly activa: boolean;
  readonly motivoApagada: MotivoApagada;
  readonly llamadas: readonly LlamadaVibracion[];
  readonly descartadas: number;
}

const CLAVE = "vibracion:activa";
const MAX_LLAMADAS = 50;
const CONSULTA_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

let proveedorInyectado: ProveedorVibracion | null | undefined;
let opcionesInyectadas: { movimientoReducido?: boolean; tactil?: boolean } | null = null;
let preferencia: boolean | null = null;
let movimientoReducidoLeido: boolean | null = null;
let ultimoImpactoMs: number | null = null;
let llamadas: LlamadaVibracion[] = [];
let descartadas = 0;
let cache: InstantaneaVibracion | null = null;
let instalado = false;
const escuchas = new Set<() => void>();

// Solo el valor exacto "0" apaga; basura, vacío o un almacenamiento que lanza
// dejan la vibración encendida, como las demás preferencias del juego.
export function leerPreferenciaVibracion(leer: () => string | null): boolean {
  try {
    return leer() !== "0";
  } catch {
    return true;
  }
}

function proveedor(): ProveedorVibracion | null {
  if (proveedorInyectado !== undefined) return proveedorInyectado;
  if (typeof navigator === "undefined") return null;
  const v = (navigator as Navigator & { vibrate?: unknown }).vibrate;
  if (typeof v !== "function") return null;
  return { vibrate: (patron) => navigator.vibrate(patron as number | number[]) };
}

function esTactil(): boolean {
  if (opcionesInyectadas?.tactil !== undefined) return opcionesInyectadas.tactil;
  return typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
}

// Sin pantalla táctil (escritorio) navigator.vibrate existe en Chrome pero no
// hay motor: el interruptor no debe aparecer.
function soportada(): boolean {
  return proveedor() !== null && esTactil();
}

function leerMovimientoReducido(): boolean {
  if (opcionesInyectadas?.movimientoReducido !== undefined) return opcionesInyectadas.movimientoReducido;
  if (movimientoReducidoLeido !== null) return movimientoReducidoLeido;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(CONSULTA_MOVIMIENTO).matches;
}

function preferenciaActual(): boolean {
  if (preferencia === null) {
    preferencia = leerPreferenciaVibracion(() => (typeof localStorage === "undefined" ? null : localStorage.getItem(CLAVE)));
  }
  return preferencia;
}

function documentoVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

function avisar(): void {
  cache = null;
  for (const escucha of escuchas) escucha();
}

export function obtenerVibracion(): InstantaneaVibracion {
  if (cache === null) {
    const s = soportada();
    const p = preferenciaActual();
    const m = leerMovimientoReducido();
    cache = {
      soportada: s,
      preferencia: p,
      movimientoReducido: m,
      activa: s && p && !m,
      motivoApagada: motivoApagada({ soportada: s, preferencia: p, movimientoReducido: m }),
      llamadas,
      descartadas,
    };
  }
  return cache;
}

export function suscribirVibracion(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

// Síncrono a propósito: navigator.vibrate exige activación del usuario y no
// puede retrasar el pintado del toque ni el frame del impacto.
export function vibrar(tipo: TipoVibracion): boolean {
  const ahora = typeof performance !== "undefined" ? performance.now() : Date.now();
  const patron = decidirVibracion(
    {
      soportada: soportada(),
      preferencia: preferenciaActual(),
      movimientoReducido: leerMovimientoReducido(),
      documentoVisible: documentoVisible(),
      enMedicion: obtenerMedicion().estado === "en-curso",
      ultimoImpactoMs,
    },
    tipo,
    ahora,
  );
  if (patron === null) return false;
  const p = proveedor();
  if (p === null) return false;
  if (tipo === "impacto") ultimoImpactoMs = ahora;
  let aceptada = false;
  try {
    aceptada = p.vibrate(patron) === true;
  } catch {
    aceptada = false;
  }
  if (!aceptada) descartadas++;
  llamadas = [...llamadas, { tipo, patron, t: ahora, aceptada }].slice(-MAX_LLAMADAS);
  avisar();
  return aceptada;
}

export function fijarVibracionActiva(valor: boolean): void {
  const cambia = preferenciaActual() !== valor;
  preferencia = valor;
  try {
    localStorage.setItem(CLAVE, valor ? "1" : "0");
  } catch {
    // almacenamiento bloqueado: la elección vale solo en esta sesión
  }
  avisar();
  // El toque que enciende es una activación de usuario: el pulso deja al
  // jugador comprobar que su dispositivo vibra de verdad.
  if (valor && cambia) vibrar("prueba");
}

// Solo para los tests unitarios: no se publica en window.
export function reiniciarVibracion(proveedorFalso?: ProveedorVibracion | null, opciones?: { movimientoReducido?: boolean; tactil?: boolean }): void {
  proveedorInyectado = proveedorFalso;
  opcionesInyectadas = opciones ?? null;
  preferencia = null;
  movimientoReducidoLeido = null;
  ultimoImpactoMs = null;
  llamadas = [];
  descartadas = 0;
  avisar();
}

export function instalarVibracion(): () => void {
  if (instalado || typeof document === "undefined") return () => undefined;
  instalado = true;
  const bajas: Array<() => void> = [];
  if (typeof window.matchMedia === "function") {
    const consulta = window.matchMedia(CONSULTA_MOVIMIENTO);
    movimientoReducidoLeido = consulta.matches;
    const alCambiar = (e: MediaQueryListEvent) => {
      movimientoReducidoLeido = e.matches;
      avisar();
    };
    consulta.addEventListener("change", alCambiar);
    bajas.push(() => consulta.removeEventListener("change", alCambiar));
  }
  const alCambiarVisibilidad = () => avisar();
  document.addEventListener("visibilitychange", alCambiarVisibilidad);
  window.__debug = window.__debug ?? {};
  window.__debug.vibracion = obtenerVibracion;
  return () => {
    for (const baja of bajas) baja();
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    instalado = false;
  };
}
