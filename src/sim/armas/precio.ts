// armas-reprecio-roles-1: la curva de precio declarada por Adrián -- "el
// precio depende de daño por facilidad de acierto. Caras: mucho daño y
// fáciles. Baratas: poco daño y difíciles. Precio medio: mucho daño pero
// difíciles, o poco daño pero fáciles" -- es un reparto por CUADRANTES
// (alto+alto cara, bajo+bajo barata, mixto en medio), no un producto
// literal: un producto (daño * facilidad) hundiría el precio de cualquier
// arma "mucho daño pero difícil" en vez de dejarla a medio camino, que es
// justo el cuadrante que Adrián describió como intermedio. La media de los
// dos ejes normalizados sí reproduce los cuatro cuadrantes tal cual los
// describió.
//
// Los dos ejes se normalizan contra el máximo del propio catálogo (ver
// DANIO_MAXIMO_CATALOGO / FACILIDAD_MAXIMA_CATALOGO), medidos con
// npm run medir:armas sobre el catálogo de este bloque -- si el catálogo
// cambia de verdad (no solo el coste), estas constantes y la curva hay que
// revisarlas juntas, nunca el coste solo.
export const DANIO_MAXIMO_CATALOGO = 55; // Despedida
export const FACILIDAD_MAXIMA_CATALOGO = 0.076; // Andanada de Flechas

// Escala para que Despedida (daño y facilidad máximos relativos del
// catálogo con daño real) quede en 120, el techo de precio de este bloque.
const ESCALA_PRECIO = 160;

function redondearA5(valor: number): number {
  return Math.round(valor / 5) * 5;
}

// Precio de la curva para un arma de daño real (no utilitaria). Las armas
// utilitarias (daño 0 por diseño) y las tres gratis del fondo de armario
// quedan fuera a propósito -- ver armas-reprecio-roles-5 y el catálogo.
export function curvaPrecio(danioMaximo: number, facilidad: number): number {
  const danioNorm = danioMaximo / DANIO_MAXIMO_CATALOGO;
  const facilidadNorm = facilidad / FACILIDAD_MAXIMA_CATALOGO;
  return redondearA5(ESCALA_PRECIO * ((danioNorm + facilidadNorm) / 2));
}

// armas-reprecio-roles-1: cuánto se desvía un coste declarado de lo que
// daría la curva, en fracción (0.15 = 15%). Con curva 0 (solo ocurre si
// danioMaximo y facilidad son ambos 0) se compara contra el propio coste
// para no dividir por cero -- un coste no nulo sobre una curva nula es
// 100% de desviación por definición, no un error de cálculo.
export function desviacionDeCurva(costeDeclarado: number, danioMaximo: number, facilidad: number): number {
  const curva = curvaPrecio(danioMaximo, facilidad);
  if (curva === 0) {
    return costeDeclarado === 0 ? 0 : 1;
  }
  return Math.abs(costeDeclarado - curva) / curva;
}
