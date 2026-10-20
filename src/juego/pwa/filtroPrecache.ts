export interface RespuestaPrecache {
  readonly redirected: boolean;
  readonly url: string;
  readonly status: number;
}

// Con la cookie del preview protegido caducada, pedir "/" acaba en el login de
// Vercel (redirección a otro origen, status 200). Guardarlo como si fuera el
// juego dejaría la app instalada abriendo el login sin red: se rechaza y la
// instalación falla limpia, con el service worker anterior intacto.
export function respuestaPrecacheable(respuesta: RespuestaPrecache, origenSw: string): boolean {
  if (respuesta.redirected || respuesta.status !== 200) return false;
  try {
    return new URL(respuesta.url).origin === origenSw;
  } catch {
    return false;
  }
}

// El chunk que arranca el trabajador recibe su configuración en el fragmento
// #params= de la URL. Una respuesta servida desde el precache no lo conserva y
// el bootstrap aborta con «Missing worker bootstrap config», con lo que el
// juego cae al motor en línea. Se deja fuera del precache para que la petición
// vaya siempre a la red con su #params= intacto.
export function entradaPrecacheable(entrada: string | { readonly url: string }): boolean {
  const url = typeof entrada === "string" ? entrada : entrada.url;
  return !url.includes("turbopack-worker");
}
