// Rango de error a inyectar en un eje (ángulo o potencia): min y max pueden
// ser los dos negativos, los dos positivos o cruzar el cero. Un rango
// siempre positivo (Almirante Bisagra en potencia) es la forma de codificar
// "se pasa de fuerza" sin una rama de código aparte para el sesgo.
export interface RangoDeError {
  readonly minimo: number;
  readonly maximo: number;
}

export interface PerfilDeError {
  readonly anguloGrados: RangoDeError;
  readonly potencia: RangoDeError;
}

// La personalidad es el perfil de error, la política de arma Y la voz --
// las tres cosas que decide el diseño (ia-personalidades) en un solo objeto
// de datos, igual que el catálogo de armas es datos y no código.
export interface Personalidad {
  readonly id: string;
  readonly nombre: string;
  readonly error: PerfilDeError;
  // Qué raíz prefiere cuando las dos son viables (ia-6: es lo que hace que
  // dos personalidades elijan distinto sobre el mismo escenario incluso con
  // idéntica arma disponible).
  readonly trayectoriaPreferida: "tenso" | "mortero";
  // De más a menos preferida. decidirTurnoIA elige entre las tres primeras
  // con pesos decrecientes -- ni siempre la misma (eso sería una etiqueta,
  // no un comportamiento) ni completamente al azar.
  readonly ordenPreferenciaArmas: readonly string[];
  readonly bancoDeFrases: readonly string[];
}
