// acelerar-presentacion: factor con el que la escena anima lo que es solo
// presentación (vuelo, propulsores, saltos del robot, turno de la IA). Store
// singleton pub/sub como cuentaAtrasStore. Nada de src/sim lo importa: el
// resultado de un turno no depende de este factor.
import { escribirAlmacen, leerAlmacen } from "@/juego/almacenLocal";

export type FactorPresentacion = 1 | 3;
export type FasePresentacion = "apuntado" | "vuelo" | "turno-ia" | "post-impacto" | "relevo" | "remate";
export type OrigenAceleracion = "toque" | "ajuste" | null;

export const FACTOR_RAPIDO = 3;
export const CLAVE_ANIMACIONES_RAPIDAS = "presentacion:animaciones-rapidas";

export interface EstadoPresentacion {
  readonly factor: FactorPresentacion;
  readonly fase: FasePresentacion;
  readonly origen: OrigenAceleracion;
  readonly botonVisible: boolean;
}

let fase: FasePresentacion = "apuntado";
let toquePedido = false;
// null = aún sin leer: localStorage no se toca en cada fotograma.
let ajusteActivo: boolean | null = null;
let instantanea: EstadoPresentacion | null = null;
const escuchas = new Set<() => void>();

function admiteAceleracion(f: FasePresentacion): boolean {
  return f === "vuelo" || f === "turno-ia";
}

function leerAjuste(): boolean {
  if (ajusteActivo === null) {
    // Solo "1" cuenta como activo: cualquier valor corrupto es desactivado.
    ajusteActivo = leerAlmacen(() => window.localStorage.getItem(CLAVE_ANIMACIONES_RAPIDAS) === "1", false);
  }
  return ajusteActivo;
}

function avisar(): void {
  instantanea = null;
  for (const escucha of escuchas) escucha();
}

export function fijarFasePresentacion(nueva: FasePresentacion): void {
  if (fase === nueva) return;
  fase = nueva;
  // La petición de toque vale hasta el impacto: el siguiente vuelo parte a ×1.
  if (!admiteAceleracion(nueva)) toquePedido = false;
  avisar();
}

// La marca de latencia solo se pone si el toque cambia el factor (con el ajuste
// activo ya va a ×3 y no hay nada que medir); la escena la cierra en el primer
// frame pintado.
export function acelerarHastaImpacto(): void {
  if (!admiteAceleracion(fase) || toquePedido) return;
  const cambiaElFactor = obtenerFactorPresentacion() !== FACTOR_RAPIDO;
  toquePedido = true;
  if (cambiaElFactor) {
    performance.clearMarks("acelerar-toque");
    performance.mark("acelerar-toque");
  }
  avisar();
}

export function obtenerFactorPresentacion(): FactorPresentacion {
  return admiteAceleracion(fase) && (toquePedido || leerAjuste()) ? FACTOR_RAPIDO : 1;
}

export function obtenerEstadoPresentacion(): EstadoPresentacion {
  if (instantanea === null) {
    const factor = obtenerFactorPresentacion();
    instantanea = {
      factor,
      fase,
      origen: factor === 1 ? null : toquePedido ? "toque" : "ajuste",
      botonVisible: admiteAceleracion(fase),
    };
  }
  return instantanea;
}

export function animacionesRapidasActivas(): boolean {
  return leerAjuste();
}

export function alternarAnimacionesRapidas(): boolean {
  const nuevo = !leerAjuste();
  ajusteActivo = nuevo;
  escribirAlmacen(() => window.localStorage.setItem(CLAVE_ANIMACIONES_RAPIDAS, nuevo ? "1" : "0"));
  avisar();
  return nuevo;
}

export function suscribirVelocidadPresentacion(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

// Solo pruebas: el estado es de módulo y los tests unitarios lo reinician.
export function reiniciarVelocidadPresentacionParaPruebas(): void {
  fase = "apuntado";
  toquePedido = false;
  ajusteActivo = null;
  avisar();
}
