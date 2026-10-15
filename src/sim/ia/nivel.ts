import type { Personalidad, RangoDeError } from "@/sim/ia/tipos";

// Nivel de la IA: lo bien que juega, aparte de la personalidad (quién es y
// cómo habla). Identificadores explícitos para que no se puedan leer al revés.
export type NivelIA = "facil" | "normal" | "dificil";

export const NIVELES_IA: readonly NivelIA[] = ["facil", "normal", "dificil"];
export const NIVEL_IA_POR_DEFECTO: NivelIA = "normal";

// Multiplicador de la semianchura de cada rango de error. «Normal» es 1: la
// personalidad de siempre, sin tocar.
// Calibrado con npm run medir:ia (jugador patrón, 100 partidas por semilla,
// semillas 2024/2028/3031/4057/5099), media de victorias de la IA:
//   La Contable       fácil 37,2 % / normal 67,2 % / difícil 89,0 %
//   Almirante Bisagra fácil 32,0 % / normal 53,6 % / difícil 75,8 %
//   Chispa            fácil 10,8 % / normal 31,4 % / difícil 57,2 %
// Entre niveles consecutivos hay más de 20 puntos; ia-nivel-3 exige 8.
export const FACTOR_NIVEL: Readonly<Record<NivelIA, number>> = {
  facil: 1.8,
  normal: 1,
  dificil: 0.55,
};

export function esNivelIA(valor: unknown): valor is NivelIA {
  return valor === "facil" || valor === "normal" || valor === "dificil";
}

// Escala la anchura alrededor del centro: el sesgo del personaje (Bisagra se
// pasa de fuerza, rango [35, 65] centrado en 50) se conserva y solo cambia
// cuánto se dispersa.
function escalarRango(rango: RangoDeError, factor: number): RangoDeError {
  const centro = (rango.minimo + rango.maximo) / 2;
  const semianchura = ((rango.maximo - rango.minimo) / 2) * factor;
  return { minimo: centro - semianchura, maximo: centro + semianchura };
}

// Pura y sin azar: no consume extracciones del generador sembrado, solo cambia
// el rango al que se mapea cada una. Con «normal» devuelve la misma
// referencia, así que el comportamiento es bit a bit el de antes.
export function aplicarNivel(personalidad: Personalidad, nivel: NivelIA): Personalidad {
  if (nivel === "normal") return personalidad;
  const factor = FACTOR_NIVEL[nivel];
  return {
    ...personalidad,
    error: {
      anguloGrados: escalarRango(personalidad.error.anguloGrados, factor),
      potencia: escalarRango(personalidad.error.potencia, factor),
    },
  };
}

export function etiquetaNivel(nivel: NivelIA): string {
  return nivel === "facil" ? "Fácil" : nivel === "dificil" ? "Difícil" : "Normal";
}
