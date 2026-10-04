// potencia-dispersion (pot-1/pot-2): "a disparo más fuerte, más difícil
// acertar" no lo da la física (la desviación por un pozo cae con 1/v², así
// que más potencia hace el tiro MÁS recto, nunca menos preciso) -- se añade
// como mecanismo explícito, independiente del arma (dispersionGrados en el
// catálogo es aparte y se suma encima, nunca se sustituye). Cuadrática para
// que la banda baja de potencia quede despreciable y el crecimiento se note
// sobre todo cerca del 100% (potencia-dispersion-1): a 30% de potencia la
// amplitud es (0.3)^2 ≈ 9% de la máxima, a 95% es (0.95)^2 ≈ 90%.
export const DISPERSION_POTENCIA_MAXIMA_GRADOS = 1;

// Umbral, en puntos de potencia, por encima del cual la dispersión deja de
// ser "despreciable" a ojo (potencia-dispersion-6): el ángulo de ayuda
// avisa la primera vez que se cruza, no antes. Elegido como el punto donde
// la amplitud supera 0.5° (criterio práctico, no físico): sqrt(0.5/1)*100 ≈ 71.
export const UMBRAL_POTENCIA_DISPERSION_VISIBLE = 71;

export function dispersionPorPotenciaGrados(potencia: number): number {
  const p = Math.min(100, Math.max(0, potencia)) / 100;
  return DISPERSION_POTENCIA_MAXIMA_GRADOS * p * p;
}
