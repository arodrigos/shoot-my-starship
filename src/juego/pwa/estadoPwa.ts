export type EstadoPwa =
  | "no-disponible"
  | "preparando"
  | "listo-sin-conexion"
  | "version-nueva"
  | "comprobacion-fallida-sin-red"
  | "comprobacion-fallida";

export interface DatosPwa {
  readonly estado: EstadoPwa;
  // Hay un service worker nuevo instalado y sin activar.
  readonly esperando: boolean;
  // Luego: oculta el aviso hasta la siguiente carga de página.
  readonly pospuesto: boolean;
  // El usuario pulsó Recargar después del último "waiting": única condición
  // en la que la página puede recargarse al pasar a controlling.
  readonly recargaPedida: boolean;
  // Aviso de 4 s tras la primera instalación.
  readonly avisoListo: boolean;
}

export type EventoPwa =
  | { readonly tipo: "registrando" }
  | { readonly tipo: "registro-fallido" }
  | { readonly tipo: "instalado"; readonly esActualizacion: boolean }
  | { readonly tipo: "esperando" }
  | { readonly tipo: "controlando" }
  | { readonly tipo: "fallo-comprobacion"; readonly conRed: boolean }
  | { readonly tipo: "comprobacion-ok" }
  | { readonly tipo: "luego" }
  | { readonly tipo: "recargar" }
  | { readonly tipo: "aviso-listo-visto" };

export const DATOS_PWA_INICIALES: DatosPwa = {
  estado: "no-disponible",
  esperando: false,
  pospuesto: false,
  recargaPedida: false,
  avisoListo: false,
};

export function avisoVersionVisible(datos: DatosPwa): boolean {
  return datos.esperando && !datos.pospuesto;
}

// Reductor puro: nunca recarga nada, solo anota si el usuario lo pidió. El
// efecto (location.reload) lo ejecuta RegistroPwa al ver recargaPedida.
export function reducirEstadoPwa(datos: DatosPwa, evento: EventoPwa): DatosPwa {
  switch (evento.tipo) {
    case "registrando":
      return datos.estado === "no-disponible" ? { ...datos, estado: "preparando" } : datos;
    case "registro-fallido":
      return { ...datos, estado: "no-disponible" };
    case "instalado":
      return evento.esActualizacion
        ? datos
        : { ...datos, estado: datos.esperando ? "version-nueva" : "listo-sin-conexion", avisoListo: true };
    case "esperando":
      return { ...datos, estado: "version-nueva", esperando: true, recargaPedida: false };
    case "controlando":
      return { ...datos, estado: "listo-sin-conexion", esperando: false };
    case "fallo-comprobacion":
      return { ...datos, estado: evento.conRed ? "comprobacion-fallida" : "comprobacion-fallida-sin-red" };
    case "comprobacion-ok":
      if (datos.estado !== "comprobacion-fallida" && datos.estado !== "comprobacion-fallida-sin-red") return datos;
      return { ...datos, estado: datos.esperando ? "version-nueva" : "listo-sin-conexion" };
    case "luego":
      return { ...datos, pospuesto: true };
    case "recargar":
      return { ...datos, recargaPedida: true };
    case "aviso-listo-visto":
      return { ...datos, avisoListo: false };
  }
}

export const TEXTO_ESTADO_PWA: Readonly<Record<EstadoPwa, string>> = {
  "listo-sin-conexion": "Lista para jugar sin conexión",
  preparando: "Preparando el juego para jugar sin conexión…",
  "no-disponible": "No disponible en este navegador",
  "version-nueva": "Hay una versión nueva",
  "comprobacion-fallida-sin-red": "Sin red: no se ha podido comprobar si hay versión nueva",
  "comprobacion-fallida": "No se ha podido comprobar si hay versión nueva. Abre el juego con conexión y vuelve a entrar",
};

let datos: DatosPwa = DATOS_PWA_INICIALES;
const oyentes = new Set<() => void>();

export function obtenerDatosPwa(): DatosPwa {
  return datos;
}

export function suscribirPwa(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function despacharPwa(evento: EventoPwa): void {
  const siguiente = reducirEstadoPwa(datos, evento);
  if (siguiente === datos) return;
  datos = siguiente;
  for (const oyente of [...oyentes]) oyente();
}

export function versionApp(): string {
  return process.env.NEXT_PUBLIC_VERSION_APP ?? "local";
}
