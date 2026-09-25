import { alturaSuperficie, type ResultadoDisparo } from "@/sim/armas/resolver";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import type { Mascara } from "@/sim/terreno/mascara";

// Umbrales de las detecciones de humor: no salen de ningún criterio con un
// número exacto (los criterios describen el efecto, no el margen), así que
// se fijan aquí, exportados, para que los tests de avanzar() los reutilicen
// en vez de hardcodear un segundo número que se puede desincronizar.

// Cuánto tiene que subir la superficie (y bajar en pantalla) bajo el líder
// para contar como derrumbe: más que el ruido de un cráter pequeño
// (Zanjadora, radio 15) pero menos que el más grande del catálogo
// (Despedida, radio 95), para que dispare con las armas de daño de área
// normales sin ser trivial.
export const MARGEN_DERRUMBE_PX = 18;

// Cuánto tiene que subir el terreno (bajar la y de superficie) bajo una nave
// para contar como enterrada. El Vertedero Portátil (radio 52, "sumar") es
// la única arma que sube terreno hoy; este margen es bastante menor que su
// radio para que un impacto cercano ya cuente.
export const MARGEN_ENTERRADO_PX = 18;

// Grados de separación entre el ángulo disparado y la solución balística
// exacta (a la MISMA potencia) por encima de los cuales un acierto se
// considera "imposible": bastante más que el error inyectado de la
// personalidad más imprecisa (Chispa, ±4.5°) para no disparar con cualquier
// tiro de una IA con mala puntería.
export const UMBRAL_ANGULO_IMPOSIBLE_GRADOS = 25;

// deriva-traiciona: compara el resultado real contra el mismo disparo con
// deriva 0 (misma tirada de fiabilidad, mismo origen, mismo ángulo/potencia)
// -- si sin deriva habría dado en el objetivo y con ella no, el viento se ha
// llevado el tiro. avanzar() pasa ya calculado el resultado hipotético
// porque calcularlo requiere repetir resolverDisparo, que solo avanzar()
// puede hacer sin duplicar el catálogo de armas aquí.
export function huboDerivaTraiciona(resultadoReal: ResultadoDisparo, resultadoSinDeriva: ResultadoDisparo | null): boolean {
  if (!resultadoSinDeriva || resultadoReal.fallo) {
    return false;
  }
  return resultadoSinDeriva.danioObjetivo > 0 && resultadoReal.danioObjetivo === 0;
}

// derrumbe-bajo-el-lider: la nave con más integridad de las dos (null si hay
// empate, porque "el líder" deja de tener un significado único) pierde
// apoyo bajo sus pies como efecto colateral del disparo -- nunca si además
// se ha quedado sin suelo del todo, que es un evento distinto y más grave
// (caida-al-vacio).
export function idLiderDerrumbado(
  integridadNave0: number,
  integridadNave1: number,
  xLider0: number,
  xLider1: number,
  mascaraAntes: Mascara,
  mascaraDespues: Mascara,
): 0 | 1 | null {
  let lider: 0 | 1 | null = null;
  if (integridadNave0 > integridadNave1) lider = 0;
  else if (integridadNave1 > integridadNave0) lider = 1;
  if (lider === null) return null;

  const xLider = lider === 0 ? xLider0 : xLider1;
  const antes = alturaSuperficie(mascaraAntes, xLider);
  const despues = alturaSuperficie(mascaraDespues, xLider);
  if (antes === null || despues === null) return null;

  return despues - antes > MARGEN_DERRUMBE_PX ? lider : null;
}

// enterrado: la superficie bajo la nave ha subido (la y de apoyo ha bajado
// de valor) más del margen. Se evalúa en la MISMA x para antes y después
// porque enterrar es un cambio de terreno, no un desplazamiento de nave (el
// Gravitón, que sí desplaza, no toca la máscara).
export function estaEnterrada(x: number, mascaraAntes: Mascara, mascaraDespues: Mascara): boolean {
  const antes = alturaSuperficie(mascaraAntes, x);
  const despues = alturaSuperficie(mascaraDespues, x);
  if (antes === null || despues === null) return false;
  return antes - despues > MARGEN_ENTERRADO_PX;
}

// caida-al-vacio: la columna TENÍA suelo antes de este disparo y se ha
// quedado sin ninguno -- es la transición, no el estado, la que dispara el
// evento (si no, una nave que ya lleva varios turnos sin suelo bajo sí lo
// volvería a emitir en cada turno posterior sin que haya pasado nada nuevo).
// Deliberadamente NO fuerza el fin de partida (ver desviaciones): el
// criterio de victoria del núcleo es propiedad de nucleo-turnos/ia-3, y
// tocarlo aquí desequilibra ese test con el suelo delgado de
// crearMascaraPlana sin que ningún criterio de humor-sistemico lo exija.
export function caeAlVacio(x: number, mascaraAntes: Mascara, mascaraDespues: Mascara): boolean {
  return alturaSuperficie(mascaraAntes, x) !== null && alturaSuperficie(mascaraDespues, x) === null;
}

// tiro-imposible-acertado: el ángulo disparado se aleja mucho de las
// soluciones balísticas exactas para ESA potencia (sin terreno, sin deriva)
// y aun así el disparo ha hecho daño al objetivo. Sin soluciones (el
// objetivo está fuera de alcance a esa potencia) y aun así acierta cuenta
// también como imposible -- es el caso más extremo, no una excepción.
export function esTiroImposibleAcertado(
  origenX: number,
  origenY: number,
  objetivoX: number,
  objetivoY: number,
  gravedad: number,
  potencia: number,
  anguloGrados: number,
  resultado: ResultadoDisparo,
): boolean {
  if (resultado.fallo || resultado.danioObjetivo <= 0) {
    return false;
  }
  const velocidad = velocidadDesdePotencia(potencia);
  const soluciones = resolverSolucionesBalisticas(origenX, origenY, objetivoX, objetivoY, gravedad, velocidad);
  if (soluciones.length === 0) {
    return true;
  }
  const diferenciaMinima = Math.min(...soluciones.map((solucion) => Math.abs(solucion.anguloGrados - anguloGrados)));
  return diferenciaMinima > UMBRAL_ANGULO_IMPOSIBLE_GRADOS;
}
