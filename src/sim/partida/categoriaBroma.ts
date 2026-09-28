import { alturaSuperficie, type ResultadoDisparo } from "@/sim/armas/resolver";
import { esMaterialPlaneta, obtenerMaterial, ESCOMBRO, type Mascara } from "@/sim/terreno/mascara";
import type { IdNave } from "@/sim/partida/tipos";

// humor-por-turno (hum-1, hum-4): las siete categorías del punto 8 del
// brief. Una sola de las siete por disparo -- categorizarResultado decide
// con un orden de prioridad fijo, nunca varias a la vez, porque el banco de
// impacto solo tiene una frase que elegir por turno.
export type CategoriaBroma =
  | "acierto"
  | "casi"
  | "fallo-lejano"
  | "autoimpacto"
  | "impacto-planeta"
  | "impacto-escombro"
  | "proyectil-perdido";

// Orden estable: lo usan hum-3 (recuento por combinación) y hum-5 (guardia
// de frecuencia) para recorrer las siete sin duplicar el literal.
export const CATEGORIAS_BROMA: readonly CategoriaBroma[] = [
  "acierto",
  "casi",
  "fallo-lejano",
  "autoimpacto",
  "impacto-planeta",
  "impacto-escombro",
  "proyectil-perdido",
];

// Radio de "casi": mayor que el casco de nave (22px, impacto-naves) y menor
// que el radio de daño más grande del catálogo salvo Despedida (Despedida
// ya cuenta como acierto o autoimpacto antes de llegar aquí), para que un
// error de puntería que detona pegado al objetivo sin tocarlo cuente como
// un intento cercano y no como un simple "impacto en planeta" anónimo.
export const UMBRAL_CASI_PX = 80;

export interface EntradaCategoriaBroma {
  readonly resultado: ResultadoDisparo;
  // Máscara ANTES del disparo: el punto de impacto ya lleva tallado su
  // propio cráter en resultado.mascara, así que preguntarle a esa por el
  // material que había ahí respondería casi siempre AIRE.
  readonly mascaraAntes: Mascara;
  readonly objetivoId: IdNave;
  readonly objetivoX: number;
  readonly objetivoY: number;
}

// categorizarResultado: única fuente de verdad para las siete categorías --
// tanto avanzar() (para adjuntar la categoría real al turno) como los tests
// de hum-2..hum-5 la llaman, así que un cambio de umbral o de orden de
// prioridad no puede desincronizar sim y tests.
export function categorizarResultado(entrada: EntradaCategoriaBroma): CategoriaBroma {
  const { resultado, mascaraAntes, objetivoId, objetivoX, objetivoY } = entrada;

  if (resultado.proyectilPerdido) {
    return "proyectil-perdido";
  }

  if (resultado.impactoPropio || resultado.danioPropio > 0) {
    return "autoimpacto";
  }

  const impactoDirecto = resultado.puntosDeImpacto.find((punto) => punto.impactoNave === objetivoId);
  if (impactoDirecto) {
    return "acierto";
  }

  // Sin nave, sin autoimpacto y sin proyectil perdido: por construcción de
  // resolverDisparo siempre queda al menos un punto de detonación (sólido o
  // borde de mundo) -- ver el comentario de proyectilPerdido en resolver.ts.
  const punto = resultado.puntosDeImpacto[0] ?? { x: objetivoX, y: objetivoY };
  const distanciaAlObjetivo = Math.hypot(punto.x - objetivoX, punto.y - objetivoY);
  if (distanciaAlObjetivo <= UMBRAL_CASI_PX) {
    return "casi";
  }

  const material = obtenerMaterial(mascaraAntes, Math.round(punto.x), Math.round(punto.y));
  if (material === ESCOMBRO) {
    return "impacto-escombro";
  }
  if (esMaterialPlaneta(material)) {
    return "impacto-planeta";
  }
  return "fallo-lejano";
}

// Para el modo de suelo plano de siempre (sin planetas ni y por nave): la
// altura de apoyo se deriva de la máscara, igual que hace avanzar() para
// colocar el resto de eventos de ese modo.
export function alturaObjetivoParaCategoria(mascara: Mascara, x: number, y: number | undefined): number {
  return y ?? alturaSuperficie(mascara, x) ?? mascara.alto - 1;
}
