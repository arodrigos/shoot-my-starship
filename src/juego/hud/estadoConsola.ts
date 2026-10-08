// consola-compacta: estado y anclaje de la consola, con saneado de lo que
// llega de localStorage. Es puro (sin window) para poder probarlo con
// cualquier valor, también los corruptos o manipulados.

export const ESTADOS_CONSOLA = ["desplegada", "minima", "oculta"] as const;
export type EstadoConsola = (typeof ESTADOS_CONSOLA)[number];

export const ANCLAJES_CONSOLA = ["abajo-centro", "abajo-izquierda", "abajo-derecha"] as const;
export type AnclajeConsola = (typeof ANCLAJES_CONSOLA)[number];

export const CLAVE_ESTADO_CONSOLA = "consola:estado";
export const CLAVE_ANCLAJE_CONSOLA = "consola:anclaje";
// Clave de antes de los tres estados: solo se lee para no perder la
// preferencia de quien ya jugaba con la consola plegada.
export const CLAVE_PLEGADA_ANTIGUA = "consola:plegada";

// Lista cerrada: cualquier otra cosa (incluido un valor de otro tipo) cae al
// valor por defecto en vez de dejar la consola fuera de la pantalla.
export function sanearEstadoConsola(crudo: string | null, plegadaAntigua: string | null): EstadoConsola {
  const encontrado = ESTADOS_CONSOLA.find((estado) => estado === crudo);
  if (encontrado !== undefined) return encontrado;
  return plegadaAntigua === "1" ? "minima" : "desplegada";
}

export function sanearAnclajeConsola(crudo: string | null): AnclajeConsola {
  return ANCLAJES_CONSOLA.find((anclaje) => anclaje === crudo) ?? "abajo-centro";
}

export function siguienteAnclaje(actual: AnclajeConsola): AnclajeConsola {
  const indice = ANCLAJES_CONSOLA.indexOf(actual);
  return ANCLAJES_CONSOLA[(indice + 1) % ANCLAJES_CONSOLA.length];
}
