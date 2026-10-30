import { escribirAlmacen, leerAlmacen } from "@/juego/almacenLocal";
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
  return leerAlmacen(() => (typeof window !== "undefined" && window.localStorage ? window.localStorage : null), null);
}

// A diferencia de progreso.ts, que calla, aquí el resultado dice por qué no se
// pudo guardar para que la escena avise una vez por partida. setItem es
// atómico: si lanza, la clave conserva su valor anterior y no queda nada a medias.
export function escribirPartidaGuardada(cadena: string): ResultadoEscritura {
  if (cadena.length > MAX_CARACTERES_INSTANTANEA) return { ok: false, motivo: "demasiado-grande" };
  const almacen = almacenamiento();
  if (!almacen) return { ok: false, motivo: "sin-almacenamiento" };
  return escribirAlmacen(() => almacen.setItem(CLAVE_PARTIDA_GUARDADA, cadena)) ? { ok: true } : { ok: false, motivo: "sin-espacio" };
}

export function leerPartidaGuardada(): string | null {
  return leerAlmacen(() => almacenamiento()?.getItem(CLAVE_PARTIDA_GUARDADA) ?? null, null);
}

// Sin almacenamiento no hay nada que borrar, y eso cuenta como éxito; solo un
// removeItem que lanza devuelve false.
export function borrarPartidaGuardada(): boolean {
  return escribirAlmacen(() => almacenamiento()?.removeItem(CLAVE_PARTIDA_GUARDADA));
}

export function guardadoActivado(): boolean {
  return leerAlmacen(() => almacenamiento()?.getItem(CLAVE_GUARDADO_ACTIVADO) !== "0", true);
}
