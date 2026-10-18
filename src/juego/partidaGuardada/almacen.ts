import { MAX_CARACTERES_INSTANTANEA } from "@/juego/partidaGuardada/tipos";

// Mismo prefijo que la clave de progreso (progreso.ts), pero otra clave: el
// almacén no toca nunca ninguna otra.
export const CLAVE_PARTIDA_GUARDADA = "partida-completa:partida-guardada";

// Interruptor de pruebas, como «muerte-subita:activada»: la configuración
// común de los e2e lo pone a «0» para que ninguna partida deje una
// instantánea que haga aparecer la confirmación de «Jugar» en otro test.
export const CLAVE_GUARDADO_ACTIVADO = "partida-guardada:activada";

export type MotivoFalloAlmacen = "sin-almacenamiento" | "sin-espacio" | "demasiado-grande";

export type ResultadoEscritura = { readonly ok: true } | { readonly ok: false; readonly motivo: MotivoFalloAlmacen };

// Se resuelve en cada llamada: localStorage puede no existir (SSR, modo
// privado estricto) o lanzar solo al accederse.
function almacenamiento(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

// A diferencia de progreso.ts, que calla, aquí el resultado dice por qué no se
// pudo guardar para que la escena avise una vez por partida. setItem es
// atómico: si lanza, la clave conserva su valor anterior y no queda nada a medias.
export function escribirPartidaGuardada(cadena: string): ResultadoEscritura {
  if (cadena.length > MAX_CARACTERES_INSTANTANEA) return { ok: false, motivo: "demasiado-grande" };
  const almacen = almacenamiento();
  if (!almacen) return { ok: false, motivo: "sin-almacenamiento" };
  try {
    almacen.setItem(CLAVE_PARTIDA_GUARDADA, cadena);
    return { ok: true };
  } catch {
    return { ok: false, motivo: "sin-espacio" };
  }
}

export function leerPartidaGuardada(): string | null {
  try {
    return almacenamiento()?.getItem(CLAVE_PARTIDA_GUARDADA) ?? null;
  } catch {
    return null;
  }
}

export function borrarPartidaGuardada(): boolean {
  try {
    almacenamiento()?.removeItem(CLAVE_PARTIDA_GUARDADA);
    return true;
  } catch {
    return false;
  }
}

export function guardadoActivado(): boolean {
  try {
    return almacenamiento()?.getItem(CLAVE_GUARDADO_ACTIVADO) !== "0";
  } catch {
    return true;
  }
}
