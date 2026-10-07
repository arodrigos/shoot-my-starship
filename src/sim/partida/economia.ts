import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import type { Arma } from "@/sim/armas/tipos";
import { FRACCION_DANIO_GRATIS } from "@/sim/economia/parametros";

export function costeArma(arma: Arma): number {
  return arma.coste ?? 0;
}

export function armasGratis(catalogo: readonly Arma[] = CATALOGO_ARMAS): readonly Arma[] {
  return catalogo.filter((arma) => costeArma(arma) === 0);
}

// Daño que cuenta para fijar el listón de las gratis: solo armas de pago que
// de verdad hacen daño. Las utilitarias (Vertedero, Gravitón) tienen daño 0
// por diseño y dejarían el listón en cero.
function danioDeReferencia(arma: Arma): number | null {
  if (costeArma(arma) <= 0 || arma.utilitaria === true) return null;
  if (arma.efecto.tipo === "empuje") return null;
  return arma.efecto.danioMaximo > 0 ? arma.efecto.danioMaximo : null;
}

// Las gratis no pueden competir con las de pago: su daño máximo es el 25 % del
// de la arma de pago más floja. En barra libre todo es gratis y no cambia nada.
export function danioMaximoGratis(catalogo: readonly Arma[] = CATALOGO_ARMAS): number {
  const referencias = catalogo.flatMap((arma) => {
    const danio = danioDeReferencia(arma);
    return danio === null ? [] : [danio];
  });
  return FRACCION_DANIO_GRATIS * Math.min(...referencias);
}

// Devuelve el arma tal como se resuelve en la partida: en presupuesto las
// gratis con daño llevan el daño reducido. Un solo punto para que el núcleo, la
// IA y el selector no discrepen.
export function armaEfectiva(arma: Arma, presupuesto: boolean, catalogo: readonly Arma[] = CATALOGO_ARMAS): Arma {
  if (!presupuesto || costeArma(arma) > 0 || arma.efecto.tipo !== "danio") return arma;
  return { ...arma, efecto: { ...arma.efecto, danioMaximo: danioMaximoGratis(catalogo) } };
}
