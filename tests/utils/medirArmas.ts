// armas-metrica: el harness de medición de "facilidad de acierto" que usan
// tanto scripts/medir-armas.ts (el informe que se publica) como el test de
// umbral -- una sola implementación del cálculo, igual que medirIA.ts es la
// única fuente de "qué tan buena es una personalidad". Vive en tests/utils/
// y nunca en src/sim para que no haya ninguna ruta de importación hacia
// src/juego ni src/app (armas-metrica-4): es un arnés de desarrollo, no
// mecánica de partida.
import { barridoRejilla, TOTAL_COMBINACIONES_REJILLA, type CandidatoDisparo } from "@/sim/balistica/rejilla";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import type { Arma } from "@/sim/armas/tipos";
import { PASO_FIJO_MS } from "@/sim/tiempo";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO, type SistemaColocado } from "./loteMultipozo";

// El criterio pide "al menos 20 escenarios sembrados": generarLoteDeSistemas
// ya coloca ambas naves de forma válida (mismo oráculo que usa el juego real,
// colocarNaves) para las semillas 0..n-1, así que "escenario sembrado" aquí
// es literalmente el mismo tipo de partida que produciría el juego, nunca un
// montaje de laboratorio ajeno al resolutor real.
export const NUM_ESCENARIOS_METRICA_ARMAS = 20;

// Congelados una sola vez (fuera de cualquier test o del script de informe)
// para que "la misma entrada da el mismo valor" (armas-metrica-1) no dependa
// de que cada llamante reconstruya el lote por su cuenta -- dos lotes que
// deberían coincidir es exactamente la clase de desajuste silencioso que
// esta etapa no debe permitirse.
export const ESCENARIOS_METRICA_ARMAS: readonly SistemaColocado[] = generarLoteDeSistemas(NUM_ESCENARIOS_METRICA_ARMAS, MUNDO_MULTIPOZO);

function candidatosDelEscenario(arma: Arma, escenario: SistemaColocado): readonly CandidatoDisparo[] {
  // armas-metrica-1: "calculada con el simulador real" -- barridoRejilla es
  // el MISMO oráculo que ya usa la IA en vivo (busquedaMultipozo.ts) y que
  // colocarNaves usa para validar un sistema, nunca una aproximación
  // balística propia de este arnés.
  return barridoRejilla({
    mascara: escenario.sistema.mascara,
    gravedad: MUNDO_MULTIPOZO.gravedad,
    deriva: MUNDO_MULTIPOZO.deriva,
    aleatorio: escenario.aleatorio,
    arma,
    ancho: MUNDO_MULTIPOZO.ancho,
    alto: MUNDO_MULTIPOZO.alto,
    planetas: escenario.sistema.planetas,
    naves: [escenario.naveA, escenario.naveB],
    tiradorId: escenario.naveA.id,
    objetivoId: escenario.naveB.id,
  });
}

// Fracción de combinaciones de la rejilla (ángulo x potencia) que causan daño
// real sobre el objetivo patrón, promediada sobre el lote de escenarios --
// entre 0 y 1. Un radio de efecto mayor o una dispersión angular que sigue
// impactando ensanchan por sí solos cuántas combinaciones de la rejilla
// cuentan como acierto, así que la ponderación por radio y por tolerancia
// angular que pide el criterio es una consecuencia de usar el resolver real,
// nunca una fórmula aparte que habría que mantener sincronizada con él.
export function facilidadDeAcierto(arma: Arma, escenarios: readonly SistemaColocado[] = ESCENARIOS_METRICA_ARMAS): number {
  const fracciones = escenarios.map((escenario) => candidatosDelEscenario(arma, escenario).length / TOTAL_COMBINACIONES_REJILLA);
  return fracciones.reduce((total, fraccion) => total + fraccion, 0) / fracciones.length;
}

// Un único barrido por (arma, escenario) alimenta tanto facilidadDeAcierto
// como el tiempo de vuelo medio del informe -- medirCatalogo lo usa para no
// pagar dos veces el coste de barrer la rejilla entera por arma.
function medirArma(arma: Arma, escenarios: readonly SistemaColocado[]): { readonly facilidad: number; readonly tiempoVueloMedioS: number | null } {
  let sumaFraccion = 0;
  let sumaPasos = 0;
  let conteoImpactos = 0;
  for (const escenario of escenarios) {
    const candidatos = candidatosDelEscenario(arma, escenario);
    sumaFraccion += candidatos.length / TOTAL_COMBINACIONES_REJILLA;
    for (const candidato of candidatos) {
      sumaPasos += candidato.pasosVuelo;
      conteoImpactos++;
    }
  }
  return {
    facilidad: sumaFraccion / escenarios.length,
    tiempoVueloMedioS: conteoImpactos > 0 ? (sumaPasos / conteoImpactos) * (PASO_FIJO_MS / 1000) : null,
  };
}

export interface MetricaArma {
  readonly id: string;
  readonly nombre: string;
  readonly danioMaximo: number;
  readonly radioEfectoPx: number;
  // null solo si ningún escenario del lote encontró ni un solo candidato con
  // daño real (no ocurre hoy con el catálogo y los 20 escenarios actuales) --
  // una media sobre cero impactos sería NaN, no un hueco silencioso.
  readonly tiempoVueloMedioS: number | null;
  readonly facilidad: number;
  readonly coste: number;
  // armas-reprecio-roles-5: las armas utilitarias (daño 0 por diseño) se
  // excluyen de paresDeDominancia -- ver el comentario de esa función.
  readonly utilitaria: boolean;
}

// Radio de efecto y daño máximo son 0 para el Gravitón (efecto "empuje"): no
// hace daño por diseño (ia-autodanio-4 ya lo marca `utilitaria`), y aquí
// declararlo así evita inventarle un radio o un daño que no tiene.
function radioYDanio(arma: Arma): { readonly radioEfectoPx: number; readonly danioMaximo: number } {
  if (arma.efecto.tipo === "empuje") {
    return { radioEfectoPx: 0, danioMaximo: 0 };
  }
  return { radioEfectoPx: arma.efecto.radioEfectoPx, danioMaximo: arma.efecto.danioMaximo };
}

// Pura en función de (catálogo, escenarios): mismo informe siempre, que es
// justo lo que armas-metrica-1 exige comprobar en un test.
export function medirCatalogo(
  catalogo: readonly Arma[] = CATALOGO_ARMAS,
  escenarios: readonly SistemaColocado[] = ESCENARIOS_METRICA_ARMAS,
): readonly MetricaArma[] {
  return catalogo.map((arma) => {
    const { radioEfectoPx, danioMaximo } = radioYDanio(arma);
    const { facilidad, tiempoVueloMedioS } = medirArma(arma, escenarios);
    return {
      id: arma.id,
      nombre: arma.nombre,
      danioMaximo,
      radioEfectoPx,
      tiempoVueloMedioS,
      facilidad,
      // coste ausente = gratis siempre (ver tipos.ts): 0, nunca undefined,
      // para que comparar costes entre armas no tenga que repetir el `?? 0`
      // en cada llamante.
      coste: arma.coste ?? 0,
      utilitaria: arma.utilitaria ?? false,
    };
  });
}

export interface ParDominancia {
  readonly dominante: string;
  readonly dominada: string;
}

// armas-metrica-3: A domina a B si A no es peor en ningún eje (daño y
// facilidad mayores o iguales, coste menor o igual) -- sin exigir que sea
// estrictamente mejor en ninguno, tal y como dice el criterio ("mayores o
// iguales" / "menor o igual"). Dos armas idénticas en los tres ejes se
// dominarían mutuamente, lo cual es correcto: ninguna justifica a la otra.
//
// armas-reprecio-roles-5 (desviación declarada en el entregable): las armas
// utilitarias (daño 0 y facilidad 0 por construcción, ver radioYDanio) se
// excluyen de esta comparación. Su precio no sale del eje daño/facilidad
// -- sale del volumen de terreno o del desplazamiento que causan -- y
// comparar dos armas con daño 0 por esta fórmula es matemáticamente
// indecidible sin romper algo: cualquier par de armas con daño=0 y
// facilidad=0 se domina mutuamente en cuanto sus costes difieren (la más
// barata siempre domina a la más cara, aunque esa diferencia de precio
// venga de un eje que esta función no mide), así que incluirlas aquí
// garantiza un hallazgo que no dice nada real sobre el catálogo de daño.
export function paresDeDominancia(metricas: readonly MetricaArma[]): readonly ParDominancia[] {
  const comparables = metricas.filter((m) => !m.utilitaria);
  const pares: ParDominancia[] = [];
  for (const a of comparables) {
    for (const b of comparables) {
      if (a.id === b.id) continue;
      if (a.danioMaximo >= b.danioMaximo && a.facilidad >= b.facilidad && a.coste <= b.coste) {
        pares.push({ dominante: a.id, dominada: b.id });
      }
    }
  }
  return pares;
}
