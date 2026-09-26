import { crearGeneradorAleatorio, type GeneradorAleatorio } from "@/sim/aleatorio";
import type { Planeta, RegistroPlanetas } from "@/sim/gravedad/planetas";
import { crearMascaraVacia, ESCOMBRO, type Mascara } from "@/sim/terreno/mascara";

// generador-sistema sustituye a los tres mapas fijos (src/juego/mundos/mapas.ts,
// bloque render-espacio) por un sistema planetario generado desde una única
// semilla, siguiendo la misma convención que ya usaba terreno/generador.ts:
// recibe el tamaño de mundo como parámetro (nucleo-3: src/sim no conoce las
// constantes de src/juego) y escribe un único Uint8Array de material.

export const PLANETAS_MIN = 3;
export const PLANETAS_MAX = 6;

const RADIO_PLANETA_MIN = 40;
const RADIO_PLANETA_MAX = 110;
const DENSIDAD_MIN = 0.6;
const DENSIDAD_MAX = 1.5;

// Separación mínima entre SUPERFICIES de dos planetas (no entre centros):
// evita que "no solapes" (sis-3) dependa de que la resta de radios salga
// justa por casualidad. Exportada porque sis-3 la usa para comprobar el
// margen exacto que este generador promete, no solo la ausencia de solape.
export const SEPARACION_MINIMA = 30;

export const MAX_ANILLOS = 2;
const GAP_ANILLO = 10;
export const GROSOR_ANILLO_MIN = 6;
export const GROSOR_ANILLO_MAX = 14;

export const MAX_ASTEROIDES = 40;
const MIN_ASTEROIDES_SI_HAY_CINTURON = 15;
const RADIO_ASTEROIDE_MIN = 4;
const RADIO_ASTEROIDE_MAX = 12;
const PROBABILIDAD_CINTURON = 0.6;
const GAP_ASTEROIDE_PLANETA = 15;
const INTENTOS_POR_ASTEROIDE = 20;

// Franja superior que ningún planeta, anillo ni asteroide puede tocar nunca:
// por construcción (nunca por suerte) queda un corredor de aire que cruza el
// mundo de lado a lado (sis-3). MARGEN_INFERIOR es simétrico por lado
// derecho/inferior para que la rejilla de emplazamiento quede centrada.
export const MARGEN_CORREDOR_SUPERIOR = 90;
const MARGEN_LATERAL = 50;
const MARGEN_INFERIOR = 50;

const FILAS_REJILLA = 2;
const COLUMNAS_REJILLA = 3;
const SLOTS_TOTALES = FILAS_REJILLA * COLUMNAS_REJILLA;

// Cuánto puede ocupar un planeta contando su posible anillo, para que la
// rejilla de emplazamiento reserve sitio de sobra y dos planetas en celdas
// vecinas de la rejilla NUNCA lleguen a solaparse, sea cual sea el sorteo:
// no es una comprobación a posteriori (rechazar y reintentar), es una
// construcción que lo hace imposible por geometría.
const PAD_X = RADIO_PLANETA_MAX + GROSOR_ANILLO_MAX + SEPARACION_MINIMA / 2;
const PAD_Y = RADIO_PLANETA_MAX + GROSOR_ANILLO_MAX + SEPARACION_MINIMA;

export interface AnilloGenerado {
  readonly planetaId: number;
  readonly grosor: number;
  readonly radioInterior: number;
  readonly radioExterior: number;
}

export interface AsteroideGenerado {
  readonly cx: number;
  readonly cy: number;
  readonly radio: number;
}

export interface SistemaGenerado {
  readonly mascara: Mascara;
  // RegistroPlanetas de gravedad/planetas.ts: lo que genera este bloque se
  // consume literalmente, sin traducir, por simularVuelo (nucleo-gravedad).
  readonly planetas: RegistroPlanetas;
  readonly anillos: readonly AnilloGenerado[];
  readonly asteroides: readonly AsteroideGenerado[];
}

// Solo para sis-6: medir el coste de CPU del peor sistema posible (6
// planetas, 2 con anillo, cinturón de 40 asteroides) exige poder construirlo
// a voluntad -- buscar una semilla que por azar produzca justo ese máximo
// sería frágil y dependería de que el sorteo interno no cambie nunca. El
// resto de criterios (sis-1 a sis-4) no usan `forzar` y ejercitan el sorteo
// real, guiado solo por la semilla.
export interface ParametrosForzados {
  readonly numPlanetas?: number;
  readonly numAnillos?: number;
  readonly numAsteroides?: number;
}

// Devuelve cuántos píxeles ha pintado realmente (recortados al mapa): es el
// recuento de píxeles vivos de un planeta recién creado sin tener que
// volver a recorrer la máscara entera con contarPixelesPorMaterial, que a
// 1920x1080 por sí sola ya cuesta más que todo el presupuesto de sis-6.
function pintarDisco(mascara: Mascara, cx: number, cy: number, radio: number, material: number): number {
  const minX = Math.max(0, Math.floor(cx - radio));
  const maxX = Math.min(mascara.ancho - 1, Math.ceil(cx + radio));
  const minY = Math.max(0, Math.floor(cy - radio));
  const maxY = Math.min(mascara.alto - 1, Math.ceil(cy + radio));
  const radioCuadrado = radio * radio;
  let pixelesPintados = 0;

  for (let y = minY; y <= maxY; y++) {
    const dy = y - cy;
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= radioCuadrado) {
        mascara.datos[y * mascara.ancho + x] = material;
        pixelesPintados++;
      }
    }
  }
  return pixelesPintados;
}

function pintarAnillo(
  mascara: Mascara,
  cx: number,
  cy: number,
  radioInterior: number,
  radioExterior: number,
  material: number,
): void {
  const minX = Math.max(0, Math.floor(cx - radioExterior));
  const maxX = Math.min(mascara.ancho - 1, Math.ceil(cx + radioExterior));
  const minY = Math.max(0, Math.floor(cy - radioExterior));
  const maxY = Math.min(mascara.alto - 1, Math.ceil(cy + radioExterior));
  const interiorCuadrado = radioInterior * radioInterior;
  const exteriorCuadrado = radioExterior * radioExterior;

  for (let y = minY; y <= maxY; y++) {
    const dy = y - cy;
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const distanciaCuadrado = dx * dx + dy * dy;
      if (distanciaCuadrado >= interiorCuadrado && distanciaCuadrado <= exteriorCuadrado) {
        mascara.datos[y * mascara.ancho + x] = material;
      }
    }
  }
}

// Fisher-Yates con el PRNG con semilla del propio juego: mezclar el orden de
// la rejilla y de los candidatos a anillo tiene que ser tan reproducible
// como cualquier otro sorteo de este generador.
function barajar<T>(valores: readonly T[], aleatorio: GeneradorAleatorio): T[] {
  const copia = [...valores];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

interface PlanetaConAnillo {
  readonly planeta: Planeta;
  readonly anillo: AnilloGenerado | null;
}

function generarPlanetas(
  aleatorio: GeneradorAleatorio,
  ancho: number,
  alto: number,
  numPlanetas: number,
  numAnillos: number,
): PlanetaConAnillo[] {
  const usableAncho = ancho - 2 * MARGEN_LATERAL;
  const usableAlto = alto - MARGEN_CORREDOR_SUPERIOR - MARGEN_INFERIOR;
  const slotAncho = usableAncho / COLUMNAS_REJILLA;
  const slotAlto = usableAlto / FILAS_REJILLA;

  const ordenSlots = barajar(
    Array.from({ length: SLOTS_TOTALES }, (_, indice) => indice),
    aleatorio,
  ).slice(0, numPlanetas);

  const planetas: Planeta[] = ordenSlots.map((slot, indice) => {
    const fila = Math.floor(slot / COLUMNAS_REJILLA);
    const columna = slot % COLUMNAS_REJILLA;
    const slotXMin = MARGEN_LATERAL + columna * slotAncho;
    const slotYMin = MARGEN_CORREDOR_SUPERIOR + fila * slotAlto;

    const radio = RADIO_PLANETA_MIN + aleatorio() * (RADIO_PLANETA_MAX - RADIO_PLANETA_MIN);
    const densidad = DENSIDAD_MIN + aleatorio() * (DENSIDAD_MAX - DENSIDAD_MIN);
    const cx = slotXMin + PAD_X + aleatorio() * (slotAncho - 2 * PAD_X);
    const cy = slotYMin + PAD_Y + aleatorio() * (slotAlto - 2 * PAD_Y);

    return { id: indice + 1, cx, cy, radio, densidad, pixelesVivos: 0 };
  });

  const idsConAnillo = new Set(
    barajar(
      planetas.map((planeta) => planeta.id),
      aleatorio,
    ).slice(0, numAnillos),
  );

  return planetas.map((planeta) => {
    if (!idsConAnillo.has(planeta.id)) {
      return { planeta, anillo: null };
    }
    const grosor = GROSOR_ANILLO_MIN + aleatorio() * (GROSOR_ANILLO_MAX - GROSOR_ANILLO_MIN);
    const radioInterior = planeta.radio + GAP_ANILLO;
    return {
      planeta,
      anillo: { planetaId: planeta.id, grosor, radioInterior, radioExterior: radioInterior + grosor },
    };
  });
}

function generarCinturon(
  aleatorio: GeneradorAleatorio,
  ancho: number,
  alto: number,
  planetasConAnillo: readonly PlanetaConAnillo[],
  numAsteroidesForzado: number | undefined,
): AsteroideGenerado[] {
  const hayCinturon = numAsteroidesForzado !== undefined ? numAsteroidesForzado > 0 : aleatorio() < PROBABILIDAD_CINTURON;
  if (!hayCinturon) return [];

  const numAsteroides =
    numAsteroidesForzado ??
    Math.min(
      MAX_ASTEROIDES,
      MIN_ASTEROIDES_SI_HAY_CINTURON + Math.floor(aleatorio() * (MAX_ASTEROIDES - MIN_ASTEROIDES_SI_HAY_CINTURON + 1)),
    );

  const grosorCinturon = 100 + aleatorio() * 80;
  const rangoCentro = alto - MARGEN_INFERIOR - MARGEN_CORREDOR_SUPERIOR - grosorCinturon;
  const centroY = MARGEN_CORREDOR_SUPERIOR + grosorCinturon / 2 + aleatorio() * Math.max(0, rangoCentro);
  const beltYMin = centroY - grosorCinturon / 2;
  const beltYMax = centroY + grosorCinturon / 2;

  const asteroides: AsteroideGenerado[] = [];
  for (let i = 0; i < numAsteroides; i++) {
    const radio = RADIO_ASTEROIDE_MIN + aleatorio() * (RADIO_ASTEROIDE_MAX - RADIO_ASTEROIDE_MIN);
    let colocado = false;
    for (let intento = 0; intento < INTENTOS_POR_ASTEROIDE && !colocado; intento++) {
      const cx = MARGEN_LATERAL + aleatorio() * (ancho - 2 * MARGEN_LATERAL);
      const cy = beltYMin + radio + aleatorio() * Math.max(0, beltYMax - beltYMin - 2 * radio);

      const chocaConPlaneta = planetasConAnillo.some(({ planeta, anillo }) => {
        const distancia = Math.hypot(planeta.cx - cx, planeta.cy - cy);
        const radioOcupado = anillo ? anillo.radioExterior : planeta.radio;
        return distancia < radioOcupado + GAP_ASTEROIDE_PLANETA + radio;
      });

      if (!chocaConPlaneta) {
        asteroides.push({ cx, cy, radio });
        colocado = true;
      }
    }
    // Si los INTENTOS_POR_ASTEROIDE se agotan (rarísimo: exige que el sorteo
    // de posición choque con un planeta 20 veces seguidas), se salta esta
    // roca en vez de reintentar sin límite -- MAX_ASTEROIDES es un techo, no
    // una cantidad exacta que el criterio exija (sis-2).
  }
  return asteroides;
}

export function generarSistema(semilla: number, ancho: number, alto: number, forzar?: ParametrosForzados): SistemaGenerado {
  const aleatorio = crearGeneradorAleatorio(semilla);
  const mascara = crearMascaraVacia(ancho, alto);

  const numPlanetas =
    forzar?.numPlanetas ?? PLANETAS_MIN + Math.floor(aleatorio() * (PLANETAS_MAX - PLANETAS_MIN + 1));
  const numAnillos = Math.min(numPlanetas, forzar?.numAnillos ?? Math.floor(aleatorio() * (MAX_ANILLOS + 1)));

  const planetasConAnillo = generarPlanetas(aleatorio, ancho, alto, numPlanetas, numAnillos);
  const asteroides = generarCinturon(aleatorio, ancho, alto, planetasConAnillo, forzar?.numAsteroides);

  // Orden de pintado: planetas primero, luego sus anillos (fuera de su
  // radio, por construcción de radioInterior), luego el cinturón -- el
  // cinturón ya se ha colocado esquivando planetas y anillos, así que este
  // orden no debería ni importar, pero mantenerlo explícito documenta la
  // intención en vez de dejarlo al azar de en qué orden se declaran los
  // arrays.
  // pixelesVivos se deriva SIEMPRE de lo que se ha pintado de verdad (nunca
  // del radio declarado): la misma disciplina que recalcularRegistro de
  // nucleo-gravedad, aplicada aquí a la inicialización en vez de al cierre
  // de un turno. Se cuenta al vuelo con el valor de retorno de pintarDisco
  // en vez de recorrer la máscara entera después (contarPixelesPorMaterial):
  // a 1920x1080 esa segunda pasada por sí sola ya cuesta más que todo el
  // presupuesto de sis-6, y aquí no hace falta -- los planetas no se solapan
  // nunca entre sí (SEPARACION_MINIMA), así que lo que pinta un disco es
  // exactamente lo que le queda vivo.
  const pixelesPorPlaneta = new Map<number, number>();
  for (const { planeta } of planetasConAnillo) {
    pixelesPorPlaneta.set(planeta.id, pintarDisco(mascara, planeta.cx, planeta.cy, planeta.radio, planeta.id));
  }
  for (const { planeta, anillo } of planetasConAnillo) {
    if (anillo) {
      pintarAnillo(mascara, planeta.cx, planeta.cy, anillo.radioInterior, anillo.radioExterior, ESCOMBRO);
    }
  }
  for (const asteroide of asteroides) {
    pintarDisco(mascara, asteroide.cx, asteroide.cy, asteroide.radio, ESCOMBRO);
  }

  const planetas: RegistroPlanetas = planetasConAnillo.map(({ planeta }) => ({
    ...planeta,
    pixelesVivos: pixelesPorPlaneta.get(planeta.id) ?? 0,
  }));
  const anillos = planetasConAnillo
    .map(({ anillo }) => anillo)
    .filter((anillo): anillo is AnilloGenerado => anillo !== null);

  return { mascara, planetas, anillos, asteroides };
}
