// hum-5: frecuenciaBromas vive AQUÍ y solo aquí -- el único sitio del
// proyecto que decide si la broma de disparo de este turno se muestra.
// "sobria" no toca la broma de impacto (siempre se muestra, sea cual sea el
// ajuste): el brief solo pide bajar el volumen de la broma de cada disparo,
// no la reacción al resultado, que es la que de verdad informa.
export type FrecuenciaBromas = "normal" | "sobria";

export const FRECUENCIA_BROMAS_POR_DEFECTO: FrecuenciaBromas = "normal";

// numeroTurno es el mismo contador de EstadoPartida (1-indexado, sube en
// cada avanzar()): "uno de cada tres" se decide con el resto de esa cuenta,
// no con una tirada aleatoria aparte, para que sea determinista y
// comprobable turno a turno sin depender de semilla.
export function debeMostrarBromaDeDisparo(frecuencia: FrecuenciaBromas, numeroTurno: number): boolean {
  if (frecuencia === "normal") {
    return true;
  }
  return numeroTurno % 3 === 0;
}
