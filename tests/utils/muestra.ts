// Tamaño de muestra de los tests estadísticos largos (ia-n*, arm-6, partida-3,
// nav-3, nucleo-4...). Con la batería completa, `npm run test:unit` tardaba
// ~15 min en el CI de cada PR, casi todo en estos lotes de cientos de
// partidas/sistemas. En el CI de PR corre una muestra reducida; la batería
// completa corre cada noche con PRUEBA_LARGA=1 (.github/workflows/pruebas-largas.yml).
//
// La muestra reducida es siempre un PREFIJO de la completa (mismas semillas,
// mismo orden): los tests la usan como límite del bucle, nunca para sortear
// semillas nuevas, así que un fallo en PR se reproduce igual en nightly.
const DIVISOR_MUESTRA_REDUCIDA = 5;
// Por debajo de esto una proporción o un orden entre medias deja de
// significar algo; si el N completo ya es menor, se usa el completo.
const MINIMO_MUESTRA_REDUCIDA = 20;

export function muestra(n: number): number {
  if (process.env.PRUEBA_LARGA === "1") return n;
  return Math.min(n, Math.max(MINIMO_MUESTRA_REDUCIDA, Math.ceil(n / DIVISOR_MUESTRA_REDUCIDA)));
}

// Umbral absoluto "al menos minimoCompleto de nCompleto" llevado a la muestra
// real, redondeando hacia arriba para no relajarlo nunca por debajo de la
// misma proporción.
export function minimoProporcional(minimoCompleto: number, nCompleto: number, nMuestra: number): number {
  return Math.ceil((nMuestra * minimoCompleto) / nCompleto);
}
