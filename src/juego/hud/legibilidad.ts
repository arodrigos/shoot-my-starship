// Legibilidad del HUD HTML (P2). Todo tamaño de letra del HUD pasa por
// tamTexto() para que un único multiplicador (--escala-texto) pueda agrandarlo
// sin tocar el lienzo ni la portada, que no leen la variable.

export const TAMANO_TEXTO_MINIMO_PX = 14;
export const FACTOR_TEXTO_GRANDE = 1.3;

// px < 14 solo se admite en un line-height, nunca en un tamaño de letra: la
// guardia estática (hud-tamanos.test.ts) lo vigila.
export function tamTexto(px: number): string {
  return `calc(${px}px * var(--escala-texto, 1))`;
}

export interface ParContraste {
  readonly id: string;
  readonly texto: string;
  readonly fondo: string;
  readonly esquema: "oscuro" | "claro" | "fijo";
}

// Pares texto/fondo del HUD con su esquema. Si el texto lleva alfa, el test lo
// mezcla sobre el fondo opaco antes de medir. El parte de guerra y el botón
// «Otra partida» usan colores fijos (no dependen de prefers-color-scheme).
export const PARES_CONTRASTE_HUD: readonly ParContraste[] = [
  { id: "parte-texto", texto: "#e8eaf0", fondo: "#0a0c14", esquema: "fijo" },
  { id: "parte-medalla-y-premio-nombre", texto: "#ffe08a", fondo: "#0a0c14", esquema: "fijo" },
  { id: "parte-premio-texto", texto: "#cfd3df", fondo: "#0a0c14", esquema: "fijo" },
  // Tarjeta: rgba(255,255,255,0.05) ya mezclado sobre el panel #0a0c14.
  { id: "parte-tarjeta-texto", texto: "#e8eaf0", fondo: "#161820", esquema: "fijo" },
  { id: "parte-tarjeta-premio-texto", texto: "#cfd3df", fondo: "#161820", esquema: "fijo" },
  { id: "parte-otra-partida", texto: "#12141a", fondo: "#ff6b4a", esquema: "fijo" },
  { id: "consola-disparar", texto: "#12141a", fondo: "#ff6b4a", esquema: "fijo" },
  { id: "menu-ayuda", texto: "rgba(232,234,240,0.75)", fondo: "#0a0c14", esquema: "fijo" },
  { id: "menu-texto", texto: "#e8eaf0", fondo: "#0a0c14", esquema: "fijo" },
  { id: "relevo-texto", texto: "#e8eaf0", fondo: "#12141a", esquema: "fijo" },
  { id: "relevo-broma", texto: "#ffe08a", fondo: "#12141a", esquema: "fijo" },
  { id: "relevo-confirmar", texto: "#ffffff", fondo: "#8a2c14", esquema: "fijo" },
  { id: "cromado-oscuro", texto: "#e8eaf0", fondo: "#0a0c14", esquema: "oscuro" },
  { id: "cromado-claro", texto: "#14151a", fondo: "#f4f1ea", esquema: "claro" },
  { id: "cromado-boton-oscuro", texto: "#e8eaf0", fondo: "#1e2230", esquema: "oscuro" },
  { id: "cromado-boton-claro", texto: "#14151a", fondo: "#ffffff", esquema: "claro" },
  { id: "reloj-roce-oscuro", texto: "#cdeeff", fondo: "#0a222e", esquema: "oscuro" },
  { id: "reloj-roce-claro", texto: "#063142", fondo: "#dff2fb", esquema: "claro" },
  { id: "aviso-oscuro", texto: "#ffcda6", fondo: "#2a1206", esquema: "oscuro" },
  { id: "aviso-claro", texto: "#5a2a08", fondo: "#fde6d4", esquema: "claro" },
  { id: "cuenta-atras-oscuro", texto: "#ffd9d9", fondo: "#2a0a0a", esquema: "oscuro" },
  { id: "cuenta-atras-claro", texto: "#5a0f0f", fondo: "#fbe1e1", esquema: "claro" },
];
