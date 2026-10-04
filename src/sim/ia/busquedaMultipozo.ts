import {
  ANGULO_MAX_GRADOS,
  ANGULO_MIN_GRADOS,
  barridoRejilla,
  compararCandidatos,
  PASO_ANGULO_GRUESO_GRADOS,
  PESO_AUTODANIO,
  TOTAL_COMBINACIONES_REJILLA,
} from "@/sim/balistica/rejilla";
import { potenciaDesdeVelocidad } from "@/sim/balistica/potencia";
import { GRAVEDAD_REFERENCIA_PX_S2 } from "@/sim/fisica/proyectil";
import { resolverDisparo } from "@/sim/armas/resolver";
import type { Arma } from "@/sim/armas/tipos";
import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { NavePosicion } from "@/sim/naves/impacto";
import type { IdNave } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

// ia-multipozo: la búsqueda del rival se construye ENCIMA de barridoRejilla
// (el oráculo único que entrega impacto-naves) -- nunca con una rejilla ni
// una parada de vuelo propias. Tres fases, todas contra resolverDisparo: (1)
// la rejilla gruesa ya construida decide el punto de partida; (2) tres
// rondas de refinamiento ternario alrededor del mejor ángulo grueso, a su
// misma potencia; (3) una sonda de sensibilidad (±0.5°) que mide cuántos px
// 2D se mueve el punto de impacto por grado -- la métrica que decidir.ts usa
// para amortiguar el error de personalidad cerca de un planeta (ia-n5).
// "Acertar" es daño > 0 medido por el resolutor real, nunca una tolerancia
// de proximidad: esa confusión ya costó la iteración 1 de este run (imp-8).
const RONDAS_REFINAMIENTO = 3;
// ia-punteria-1: la rejilla gruesa solo prueba 5 valores fijos de potencia
// (40/55/70/85/100). RONDAS_REFINAMIENTO_POTENCIA hace ternario sobre
// potencia alrededor del candidato de la rejilla, con ángulo FIJO al ya
// refinado por la fase 2 -- probado primero en rango completo [0,100] (sin
// ventana) y descartado: a ángulo fijo, ángulo y potencia están acoplados
// por la balística (un ángulo dado solo conecta con una potencia estrecha
// alrededor de la que ya encontró la rejilla), así que un barrido ancho de
// potencia con ese ángulo falla casi siempre y nunca desplaza al candidato
// de la rejilla -- medido: 0% de refinamiento efectivo sobre 40 sistemas.
// VENTANA_POTENCIA_GRADOS (la mitad del hueco entre dos potencias
// contiguas de la rejilla, 15 puntos) mantiene el refinamiento dentro de la
// zona donde ese ángulo todavía conecta, igual que PASO_ANGULO_GRUESO_GRADOS
// para el ángulo.
const RONDAS_REFINAMIENTO_POTENCIA = 32;
// potencia-dispersion (pot-5): la IA tiene que conocer la dispersión --
// ordenar por el mejor caso (una sola tirada sin ruido) es justamente lo
// que el punto 6 de Adrián pide dejar de hacer. Usado por la fase 2c (ver
// más abajo, DESPUÉS de que fases 1-2b ya encontraron dónde está el pico
// de daño): promedia sobre MUESTRAS_DISPERSION_POTENCIA tiradas de ruido
// DISTINTAS (números aleatorios comunes: las mismas N semillas para cada
// candidato) para que la comparación entre dos potencias no sea ruido
// contra ruido. No se usa dentro de las fases 1-2b -- triplicar ahí el
// coste de cada muestra habría exigido recortar su densidad a un tercio
// (RONDAS_REFINAMIENTO_POTENCIA 32->10), medido: eso por sí solo le hace
// perder a ia-punteria-1 su objetivo de refinar fuera de la rejilla en
// el 80% de los turnos (cae al 53%) -- el techo de 192 vuelos (ia-n3) no
// sube, así que la fase 2c paga su propio coste acotado (como mucho
// 2*MUESTRAS_DISPERSION_POTENCIA vuelos) aparte, sin tocar la densidad de
// las fases ya calibradas.
export const MUESTRAS_DISPERSION_POTENCIA = 3;
const VENTANA_POTENCIA_GRADOS = 25;
// Fase 1b: cuántas muestras de potencia completa [0,100] se prueban al
// ángulo de emergencia cuando la rejilla entera no encontró ni un candidato
// -- barato a propósito (10 vuelos, muy por debajo de la propia rejilla),
// porque es el camino menos frecuente y solo tiene que encontrar UN
// candidato real con el que arrancar el refinamiento normal, no afinarlo.
// 10 muestras espacian cada ~11 puntos de potencia, por debajo de la
// ventana de 20 puntos que motivó esta fase (ia-n3 medido: con 20 muestras
// el techo de 250ms de CPU se superaba en la semilla 12 del torneo de
// presupuesto por defecto; con 10, dentro de margen).
const RONDAS_EMERGENCIA_POTENCIA = 10;
const DELTA_SENSIBILIDAD_GRADOS = 0.5;
// Sin datos de sensibilidad (presupuesto agotado antes de la sonda), se
// declara la sensibilidad más alta posible: decidir.ts la usa para amortiguar
// el error de personalidad, y frente a la duda toca amortiguar de más, nunca
// disparar con el error completo de un tiro que podría rozar un planeta.
const SENSIBILIDAD_SIN_DATOS_PX_GRADO = 500;
// ia-n4b: la sonda de ángulo NO basta -- el error de potencia de una
// personalidad (Almirante Bisagra, siempre +8 a +20%) puede caer justo sobre
// el umbral de alcance de un tiro con gravedad, donde 1 punto de potencia
// mueve el impacto muchísimo más que en terreno despejado, y ese umbral no
// tiene por qué coincidir con dónde el ángulo es sensible. Se mide aparte,
// con su propia sonda y su propia referencia (percance real de ia-n4:
// Almirante Bisagra salía con más dispersión media que Chispa en 200
// sistemas multipozo hasta que esto se separó del factor de ángulo).
const DELTA_SENSIBILIDAD_POTENCIA = 1;
const SENSIBILIDAD_SIN_DATOS_PX_PORCENTAJE = 500;
// ia-n3: 1.200 es el TECHO DURO que nunca se supera (defensa en profundidad),
// no el gasto real de un turno normal -- con resolverDisparo costando ~1ms
// por vuelo, gastar los 1.200 tardaría más de un segundo, muy por encima del
// techo de 250ms de CPU que exige el mismo criterio. El presupuesto real de
// cada turno es mucho más bajo (ver decidir.ts), y este techo solo protege
// contra un llamante que pida explícitamente más de la cuenta.
export const PRESUPUESTO_VUELOS_RIVAL_DEFAULT = 1200;
// Cuántos vuelos se apartan SIEMPRE para el refinamiento (3 rondas x 2) y las
// dos sondas de sensibilidad (2 de ángulo + 2 de potencia), antes de dársela
// a la rejilla -- sin esto, un presupuesto por debajo de
// TOTAL_COMBINACIONES_REJILLA deja la rejilla entera con todo el presupuesto
// y apaga las fases 2 y 3 por completo en cuanto el llamante pide menos que
// la rejilla completa.
// potencia-dispersion: +2*MUESTRAS_DISPERSION_POTENCIA reservados para la
// fase 2c (ver más abajo) -- aparte de las fases 1-2b, que no cambian.
const VUELOS_RESERVADOS_REFINAMIENTO_Y_SENSIBILIDAD =
  RONDAS_REFINAMIENTO * 2 + RONDAS_REFINAMIENTO_POTENCIA + 2 + 2 + 2 * MUESTRAS_DISPERSION_POTENCIA;
// Presupuesto real que usa decidir.ts en un turno normal (ia-n3, techo de
// 250ms de CPU medido en CI): cubre la rejilla entera para las tres potencias
// centrales (40/55/70%) más una parte de las dos más altas, y dentro de eso
// siempre le queda hueco al refinamiento y a las dos sondas -- medido
// empíricamente para quedar con margen bajo el techo, no en el borde.
export const PRESUPUESTO_VUELOS_RIVAL_TURNO = 192;

export interface ParametrosBusquedaRival {
  readonly mascara: Mascara;
  readonly ancho: number;
  readonly alto: number;
  readonly planetas?: RegistroPlanetas;
  readonly gravedad: number;
  readonly deriva: number;
  readonly aleatorio: EstadoAleatorio;
  // El arma con la que se va a disparar de verdad (decidir.ts la elige antes
  // de llamar aquí): buscar con un arma de referencia distinta a la que
  // termina disparando rompería ia-n2 (la trayectoria que la búsqueda usó
  // para elegir deja de coincidir con la del disparo real en cuanto el arma
  // elegida tiene un comportamiento distinto, como las submuniciones).
  readonly arma: Arma;
  readonly naves: readonly NavePosicion[];
  readonly tiradorId: IdNave;
  readonly objetivoId: IdNave;
  // Techo duro de vuelos simulados para TODO el turno (ia-n3): rejilla más
  // refinamiento más sonda de sensibilidad juntos, nunca solo la rejilla.
  readonly presupuestoVuelosMax?: number;
}

export interface SolucionRival {
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly danioObjetivo: number;
  readonly sensibilidadPxPorGrado: number;
  // px 2D que se mueve el punto de impacto por punto porcentual de potencia
  // (ia-n4b): separado de sensibilidadPxPorGrado porque el umbral de alcance
  // de un tiro con gravedad no tiene por qué coincidir en ángulo y potencia.
  readonly sensibilidadPxPorPorcentajePotencia: number;
  readonly vuelosSimulados: number;
  // true si se agotó el presupuesto sin encontrar ningún disparo con daño
  // real (ia-n3): el llamante recibe igualmente un mejor esfuerzo, nunca una
  // excepción ni una espera abierta.
  readonly agotado: boolean;
}

// Disparo de emergencia (hallazgo de CI en este mismo bloque, e2e
// render-7): cuando la rejilla ENTERA no encuentra ni un solo candidato con
// daño real -- ya sea porque el objetivo está tapado o fuera de alcance --
// el disparo por defecto no puede ser un ángulo fijo. Con gravedad real 0
// (el espacio de producción), 90° es recto hacia arriba: sin planeta que lo
// devuelva, ese tiro escapa siempre, y la animación agota los 12s reales de
// PRESUPUESTO_VUELO_MULTIPOZO_PASOS en vez de resolver como un fallo normal.
// Apuntar geométricamente al objetivo no garantiza acertar (por algo la
// rejilla ya falló ahí), pero sí que el proyectil vuele HACIA la partida en
// vez de perderse en el vacío -- comprobado contra el sistema de producción
// que disparó esto (semilla 20260926, La Contable): con ángulo recto (90°)
// el tiro se pierde con cualquier potencia; apuntado al objetivo, no se
// pierde con ninguna de las cinco potencias de la rejilla.
// ia-punteria-1: inversión de la misma fórmula cerrada de tiro parabólico
// que resolverSolucionesBalisticas usa para ángulo con potencia fija (sin
// pozos: gravedad uniforme) -- aquí, al revés, con el ÁNGULO fijo (el que ya
// refinó la fase 2) se despeja la potencia que haría blanco exacto en un
// campo de gravedad uniforme. Es una SEMILLA, nunca la respuesta final: con
// pozos de verdad la trayectoria real se curva más o menos que esta
// aproximación, así que el refinamiento ternario de la fase 2b todavía
// ajusta alrededor de este punto de partida -- pero partir de la potencia
// físicamente correcta (en vez de +-7.5 a ciegas desde el valor de la
// rejilla) es lo que hace que ese ajuste local encuentre con qué potencia
// SÍ conecta en vez de perderse en el hueco entre dos valores que fallan.
// undefined si no hay solución real (apuntando en sentido contrario al
// objetivo, o con el ángulo ya tocando 0/90/180 donde tan() diverge).
function potenciaAnaliticaParaAngulo(
  origenX: number,
  origenY: number,
  objetivoX: number,
  objetivoY: number,
  gravedad: number,
  anguloGrados: number,
): number | undefined {
  const dx = objetivoX - origenX;
  const distancia = Math.abs(dx);
  if (distancia < 1e-6 || gravedad <= 0) return undefined;
  const dirX = Math.sign(dx);
  const thetaLocalGrados = dirX >= 0 ? anguloGrados : 180 - anguloGrados;
  const thetaLocalRad = (thetaLocalGrados * Math.PI) / 180;
  const u = Math.tan(thetaLocalRad);
  if (!Number.isFinite(u)) return undefined;
  const h = objetivoY - origenY;
  const denominador = h + distancia * u;
  if (denominador <= 0) return undefined;
  const g = gravedad * GRAVEDAD_REFERENCIA_PX_S2;
  const vCuadrado = (g * distancia * distancia * (1 + u * u)) / (2 * denominador);
  if (!(vCuadrado > 0)) return undefined;
  const potencia = potenciaDesdeVelocidad(Math.sqrt(vCuadrado));
  if (!Number.isFinite(potencia)) return undefined;
  return Math.min(100, Math.max(0, potencia));
}

// ia-punteria-6 (corrección de CI, hallazgo real: La Contable, sistema por
// defecto semilla 20260926, tirador a la derecha y ARRIBA del objetivo): el
// ángulo en línea recta hacia un objetivo que queda por DEBAJO de un
// lanzamiento ascendente (dyPantalla > 0 lo bastante) cae fuera de
// [ANGULO_MIN_GRADOS, ANGULO_MAX_GRADOS] -- ese rango solo admite ángulos
// que lanzan HACIA ARRIBA (vy inicial <= 0 siempre, ver resolverDisparo).
// Recortar ese ángulo con Math.max/min (como hacía esta función antes) no
// lo acerca al objetivo: cuando dx < 0 (objetivo a la izquierda), el
// recorte cae en ANGULO_MIN_GRADOS (≈2°, casi horizontal a la DERECHA) --
// la dirección opuesta a la real. Medido: eso deja a Fase 1b barriendo
// potencia entera en la dirección contraria al objetivo, sin encontrar
// nunca el candidato real (ang≈132-133°, pot≈22, danio 14, confirmado con
// un barrido fino fuera de test). Fuera del cono alcanzable, se conserva
// solo la dirección horizontal (el único eje que de verdad decide esto
// lanzamiento) con una elevación fija de 45°/135° -- arbitraria pero del
// lado correcto, que es lo único que Fase 1b necesita para que su barrido
// de potencia tenga alguna oportunidad real de conectar.
function anguloDeEmergenciaHaciaObjetivo(tirador: NavePosicion, objetivo: NavePosicion): number {
  const dx = objetivo.x - tirador.x;
  const dyPantalla = objetivo.y - tirador.y;
  const anguloBruto = (Math.atan2(-dyPantalla, dx) * 180) / Math.PI;
  if (anguloBruto >= ANGULO_MIN_GRADOS && anguloBruto <= ANGULO_MAX_GRADOS) {
    return anguloBruto;
  }
  return dx >= 0 ? 45 : 135;
}

function volar(params: ParametrosBusquedaRival, tirador: NavePosicion, objetivo: NavePosicion, anguloGrados: number, potencia: number) {
  return volarConAleatorio(params, tirador, objetivo, anguloGrados, potencia, params.aleatorio);
}

// potencia-dispersion (pot-5): misma exploración que `volar`, pero con un
// EstadoAleatorio explícito -- lo que permite muestrear el MISMO candidato
// varias veces con dispersión distinta en cada muestra (ver
// valorEsperadoBajoDispersion), en vez de la tirada única y fija que usa el
// resto de fases de esta búsqueda.
function volarConAleatorio(
  params: ParametrosBusquedaRival,
  tirador: NavePosicion,
  objetivo: NavePosicion,
  anguloGrados: number,
  potencia: number,
  aleatorio: EstadoAleatorio,
  incluirDispersionPotencia: boolean = false,
) {
  return resolverDisparo({
    mascara: params.mascara,
    gravedad: params.gravedad,
    deriva: params.deriva,
    aleatorio,
    arma: params.arma,
    origenX: tirador.x,
    origenY: tirador.y,
    anguloGrados,
    potencia,
    objetivoX: objetivo.x,
    objetivoY: objetivo.y,
    ancho: params.ancho,
    alto: params.alto,
    incluirDispersionPotencia,
    planetas: params.planetas,
    naves: params.naves,
    tiradorId: params.tiradorId,
  });
}

function semillasDeMuestreo(base: EstadoAleatorio, cantidad: number): readonly EstadoAleatorio[] {
  const semillas: EstadoAleatorio[] = [];
  let actual = base;
  for (let i = 0; i < cantidad; i++) {
    const paso = siguienteAleatorio(actual);
    semillas.push(paso.estado);
    actual = paso.estado;
  }
  return semillas;
}

interface CandidatoConValorEsperado {
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly danio: number;
  readonly autodanioTotal: number;
  readonly puntuacion: number;
  readonly pasosVuelo: number;
}

function valorEsperadoBajoDispersion(
  params: ParametrosBusquedaRival,
  tirador: NavePosicion,
  objetivo: NavePosicion,
  anguloGrados: number,
  potencia: number,
  semillas: readonly EstadoAleatorio[],
): CandidatoConValorEsperado {
  let danioAcumulado = 0;
  let autodanioAcumulado = 0;
  let pasosVuelo = 0;
  for (const semilla of semillas) {
    const r = volarConAleatorio(params, tirador, objetivo, anguloGrados, potencia, semilla, true);
    danioAcumulado += r.danioObjetivo;
    autodanioAcumulado += r.danioPropio + (r.impactoPropio?.danio ?? 0);
    pasosVuelo = r.pasosVuelo;
  }
  const danio = danioAcumulado / semillas.length;
  const autodanioTotal = autodanioAcumulado / semillas.length;
  return { anguloGrados, potencia, danio, autodanioTotal, puntuacion: danio - PESO_AUTODANIO * autodanioTotal, pasosVuelo };
}

// Sin ambas naves no hay nada que buscar: el llamante (decidir.ts) siempre
// las trae porque ya las necesitó para llegar hasta aquí, pero se cubre el
// caso igual que barridoRejilla/existeTiroViable en vez de asumir.
function solucionSinNaves(): SolucionRival {
  return {
    anguloGrados: 90,
    potencia: 70,
    danioObjetivo: 0,
    sensibilidadPxPorGrado: SENSIBILIDAD_SIN_DATOS_PX_GRADO,
    sensibilidadPxPorPorcentajePotencia: SENSIBILIDAD_SIN_DATOS_PX_PORCENTAJE,
    vuelosSimulados: 0,
    agotado: false,
  };
}

// Rejilla gruesa (fase 1, sobre el oráculo ya construido) + refinamiento
// ternario local (fase 2) + sonda de sensibilidad (fase 3), todo contra
// resolverDisparo y todo dentro de presupuestoVuelosMax (ia-n3). Determinista:
// misma entrada, misma salida, porque cada llamada a resolverDisparo reutiliza
// el mismo `aleatorio` sin encadenarlo -- es una EXPLORACIÓN, no una tirada
// real; el turno que de verdad se dispara avanza su propio aleatorio en
// decidir.ts, no aquí.
export function buscarSolucionRival(params: ParametrosBusquedaRival): SolucionRival {
  const tirador = params.naves.find((nave) => nave.id === params.tiradorId);
  const objetivo = params.naves.find((nave) => nave.id === params.objetivoId);
  if (!tirador || !objetivo) {
    return solucionSinNaves();
  }

  const presupuestoMax = params.presupuestoVuelosMax ?? PRESUPUESTO_VUELOS_RIVAL_TURNO;
  const presupuestoRejilla = Math.min(
    TOTAL_COMBINACIONES_REJILLA,
    Math.max(0, presupuestoMax - VUELOS_RESERVADOS_REFINAMIENTO_Y_SENSIBILIDAD),
  );
  const candidatos = barridoRejilla({ ...params, presupuestoIntentos: presupuestoRejilla });
  let vuelosSimulados = presupuestoRejilla;

  let huboCandidato = candidatos.length > 0;
  let mejorAngulo = huboCandidato ? candidatos[0].anguloGrados : anguloDeEmergenciaHaciaObjetivo(tirador, objetivo);
  let mejorPotencia = candidatos[0]?.potencia ?? 70;
  let mejorDanio = candidatos[0]?.danio ?? 0;
  // ia-autodanio-1: el refinamiento ternario parte del candidato que ya
  // ganó en la rejilla (sin autodaño siempre que hubiera alternativa), así
  // que arranca con su mismo autodaño/puntuación en vez de 0 -- si no, un
  // vuelo de refinamiento con más daño pero autodaño>0 podría desplazar al
  // candidato seguro de partida con el que arrancó esta fase.
  let mejorAutodanio = candidatos[0]?.autodanioTotal ?? 0;
  let mejorPuntuacion = candidatos[0]?.puntuacion ?? 0;
  let mejorPasosVuelo = candidatos[0]?.pasosVuelo ?? 0;

  // Fase 1b (rescate de emergencia, hallazgo real: La Contable, sistema por
  // defecto semilla 20260926): la rejilla gruesa solo prueba 5 potencias
  // fijas (40/55/70/85/100, ver rejilla.ts) y, con el presupuesto de un
  // turno normal, ni siquiera las cubre todas -- si el único tiro real
  // pasa por una potencia baja que esa rejilla nunca prueba (aquí, 20-30%),
  // huboCandidato queda en false y el disparo de emergencia dispara con
  // potencia 70 fija, que falla siempre. Antes de rendirse del todo, un
  // barrido fino de potencia completa [0,100] al MISMO ángulo de emergencia
  // (ya apuntado geométricamente al objetivo) comprueba si alguna potencia
  // SÍ conecta -- no es un segundo buscador, es el mismo resolverDisparo de
  // siempre, solo que explorando el eje que la rejilla deja ciego.
  if (!huboCandidato && vuelosSimulados < presupuestoMax) {
    const pasos = Math.min(RONDAS_EMERGENCIA_POTENCIA, presupuestoMax - vuelosSimulados);
    for (let muestra = 0; muestra < pasos; muestra++) {
      const p = pasos <= 1 ? 50 : (100 * muestra) / (pasos - 1);
      const r = volar(params, tirador, objetivo, mejorAngulo, p);
      vuelosSimulados++;
      if (r.danioObjetivo > 0) {
        const autodanioTotal = r.danioPropio + (r.impactoPropio?.danio ?? 0);
        const puntuacion = r.danioObjetivo - PESO_AUTODANIO * autodanioTotal;
        const candidato = { anguloGrados: mejorAngulo, potencia: p, danio: r.danioObjetivo, autodanioTotal, puntuacion, pasosVuelo: r.pasosVuelo };
        const actual = {
          anguloGrados: mejorAngulo,
          potencia: mejorPotencia,
          danio: mejorDanio,
          autodanioTotal: mejorAutodanio,
          puntuacion: mejorPuntuacion,
          pasosVuelo: mejorPasosVuelo,
        };
        if (!huboCandidato || compararCandidatos(candidato, actual) < 0) {
          mejorPotencia = p;
          mejorDanio = r.danioObjetivo;
          mejorAutodanio = autodanioTotal;
          mejorPuntuacion = puntuacion;
          mejorPasosVuelo = r.pasosVuelo;
          huboCandidato = true;
        }
      }
    }
  }

  // Fase 2: refinamiento ternario dentro de la celda gruesa alrededor del
  // mejor candidato, a su misma potencia -- solo tiene sentido si la rejilla
  // ya encontró algo que mejorar y queda presupuesto para al menos una ronda
  // (dos vuelos). Compara con compararCandidatos (ia-autodanio-1), nunca con
  // daño bruto: un ángulo vecino que hace más daño pero se autogolpea no
  // puede ganarle a uno sin autodaño, ni aquí ni en la rejilla.
  if (huboCandidato) {
    let lo = mejorAngulo - PASO_ANGULO_GRUESO_GRADOS;
    let hi = mejorAngulo + PASO_ANGULO_GRUESO_GRADOS;
    for (let ronda = 0; ronda < RONDAS_REFINAMIENTO && vuelosSimulados + 2 <= presupuestoMax; ronda++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      const r1 = volar(params, tirador, objetivo, m1, mejorPotencia);
      vuelosSimulados++;
      const r2 = volar(params, tirador, objetivo, m2, mejorPotencia);
      vuelosSimulados++;
      const candidato1 = {
        anguloGrados: m1,
        potencia: mejorPotencia,
        danio: r1.danioObjetivo,
        autodanioTotal: r1.danioPropio + (r1.impactoPropio?.danio ?? 0),
        puntuacion: r1.danioObjetivo - PESO_AUTODANIO * (r1.danioPropio + (r1.impactoPropio?.danio ?? 0)),
        pasosVuelo: r1.pasosVuelo,
      };
      const candidato2 = {
        anguloGrados: m2,
        potencia: mejorPotencia,
        danio: r2.danioObjetivo,
        autodanioTotal: r2.danioPropio + (r2.impactoPropio?.danio ?? 0),
        puntuacion: r2.danioObjetivo - PESO_AUTODANIO * (r2.danioPropio + (r2.impactoPropio?.danio ?? 0)),
        pasosVuelo: r2.pasosVuelo,
      };
      if (
        compararCandidatos(candidato1, {
          anguloGrados: mejorAngulo,
          potencia: mejorPotencia,
          danio: mejorDanio,
          autodanioTotal: mejorAutodanio,
          puntuacion: mejorPuntuacion,
          pasosVuelo: mejorPasosVuelo,
        }) < 0
      ) {
        ({ danio: mejorDanio, anguloGrados: mejorAngulo, autodanioTotal: mejorAutodanio, puntuacion: mejorPuntuacion, pasosVuelo: mejorPasosVuelo } =
          candidato1);
      }
      if (
        compararCandidatos(candidato2, {
          anguloGrados: mejorAngulo,
          potencia: mejorPotencia,
          danio: mejorDanio,
          autodanioTotal: mejorAutodanio,
          puntuacion: mejorPuntuacion,
          pasosVuelo: mejorPasosVuelo,
        }) < 0
      ) {
        ({ danio: mejorDanio, anguloGrados: mejorAngulo, autodanioTotal: mejorAutodanio, puntuacion: mejorPuntuacion, pasosVuelo: mejorPasosVuelo } =
          candidato2);
      }
      if (compararCandidatos(candidato1, candidato2) < 0) hi = m2;
      else lo = m1;
    }
  }

  // Fase 2b (ia-punteria-1): barrido fino de potencia en una ventana local
  // alrededor de la semilla analítica (o del candidato de la rejilla si no
  // hay semilla), al ángulo ya refinado por la fase 2 -- NO ternario, a
  // diferencia de la fase de ángulo: probado y descartado (medido: ternario
  // encontraba mejora en 0% de 40 sistemas). El motivo es que, a ángulo
  // fijo, "qué potencia conecta" no es una colina suave de un solo máximo
  // -- es una serie de picos estrechos (un disparo que pasa a 2px del
  // casco no hace nada; a 2px más cerca, hace daño completo), así que
  // bisecar por comparación entre dos puntos descarta la mitad del rango
  // sin ninguna garantía de que el pico esté en la mitad que queda. Un
  // barrido fino sí tiene alguna chance de caer DENTRO de un pico con el
  // mismo número de vuelos. Con empate exacto de puntuación frente al
  // mejor hallado hasta ahora, gana el candidato de potencia continua (<=,
  // no <): sin esto, la potencia se queda siempre clavada en el valor de
  // la rejilla en cuanto un valor cercano da el mismo daño.
  if (huboCandidato) {
    const semillaAnalitica = potenciaAnaliticaParaAngulo(tirador.x, tirador.y, objetivo.x, objetivo.y, params.gravedad, mejorAngulo);
    const centroVentana = semillaAnalitica ?? mejorPotencia;
    const loP = Math.max(0, centroVentana - VENTANA_POTENCIA_GRADOS);
    const hiP = Math.min(100, centroVentana + VENTANA_POTENCIA_GRADOS);
    for (let muestra = 0; muestra < RONDAS_REFINAMIENTO_POTENCIA && vuelosSimulados + 1 <= presupuestoMax; muestra++) {
      const divisor = RONDAS_REFINAMIENTO_POTENCIA - 1;
      const p = divisor <= 0 ? (loP + hiP) / 2 : loP + ((hiP - loP) * muestra) / divisor;
      const r = volar(params, tirador, objetivo, mejorAngulo, p);
      vuelosSimulados++;
      const candidato = {
        anguloGrados: mejorAngulo,
        potencia: p,
        danio: r.danioObjetivo,
        autodanioTotal: r.danioPropio + (r.impactoPropio?.danio ?? 0),
        puntuacion: r.danioObjetivo - PESO_AUTODANIO * (r.danioPropio + (r.impactoPropio?.danio ?? 0)),
        pasosVuelo: r.pasosVuelo,
      };
      if (
        compararCandidatos(candidato, {
          anguloGrados: mejorAngulo,
          potencia: mejorPotencia,
          danio: mejorDanio,
          autodanioTotal: mejorAutodanio,
          puntuacion: mejorPuntuacion,
          pasosVuelo: mejorPasosVuelo,
        }) <= 0
      ) {
        ({ danio: mejorDanio, potencia: mejorPotencia, autodanioTotal: mejorAutodanio, puntuacion: mejorPuntuacion, pasosVuelo: mejorPasosVuelo } =
          candidato);
      }
    }
  }

  // Fase 2c (potencia-dispersion, pot-5): fases 1-2b optimizan por el MEJOR
  // CASO -- una sola tirada sin dispersión -- correcto para encontrar DÓNDE
  // está el pico de daño, pero ciego al riesgo que la propia potencia-
  // dispersión añade (más potencia, más ángulo de salida incierto). Antes
  // de fijar el tiro, se compara el candidato encontrado contra una
  // alternativa de MENOS potencia (mismo ángulo, un paso de
  // VENTANA_POTENCIA_GRADOS hacia abajo) por VALOR ESPERADO bajo dispersión
  // -- media de MUESTRAS_DISPERSION_POTENCIA muestras cada uno, con las
  // MISMAS semillas de ruido para los dos (números aleatorios comunes, para
  // que la comparación no sea ruido contra ruido). Gana la de mayor
  // puntuación esperada, nunca la de mejor caso bruto.
  if (huboCandidato && vuelosSimulados + 2 * MUESTRAS_DISPERSION_POTENCIA <= presupuestoMax) {
    const semillasRiesgo = semillasDeMuestreo(params.aleatorio, MUESTRAS_DISPERSION_POTENCIA);
    const potenciaMenosArriesgada = Math.max(0, mejorPotencia - VENTANA_POTENCIA_GRADOS);
    const candidatoActual = valorEsperadoBajoDispersion(params, tirador, objetivo, mejorAngulo, mejorPotencia, semillasRiesgo);
    vuelosSimulados += MUESTRAS_DISPERSION_POTENCIA;
    const candidatoMenosArriesgado = valorEsperadoBajoDispersion(
      params,
      tirador,
      objetivo,
      mejorAngulo,
      potenciaMenosArriesgada,
      semillasRiesgo,
    );
    vuelosSimulados += MUESTRAS_DISPERSION_POTENCIA;
    const candidatoElegido = compararCandidatos(candidatoMenosArriesgado, candidatoActual) < 0 ? candidatoMenosArriesgado : candidatoActual;
    mejorPotencia = candidatoElegido.potencia;
    mejorDanio = candidatoElegido.danio;
    mejorAutodanio = candidatoElegido.autodanioTotal;
    mejorPuntuacion = candidatoElegido.puntuacion;
    mejorPasosVuelo = candidatoElegido.pasosVuelo;
  }

  // Fase 3: sonda de sensibilidad -- cuántos px 2D se mueve el punto de
  // impacto por grado de ángulo alrededor de la solución final. Solo se mide
  // si hubo un candidato real y queda presupuesto para los dos vuelos de la
  // sonda; sin datos, se declara la sensibilidad más alta posible (ver
  // SENSIBILIDAD_SIN_DATOS_PX_GRADO).
  let sensibilidadPxPorGrado = SENSIBILIDAD_SIN_DATOS_PX_GRADO;
  if (huboCandidato && vuelosSimulados + 2 <= presupuestoMax) {
    const menos = volar(params, tirador, objetivo, mejorAngulo - DELTA_SENSIBILIDAD_GRADOS, mejorPotencia);
    vuelosSimulados++;
    const mas = volar(params, tirador, objetivo, mejorAngulo + DELTA_SENSIBILIDAD_GRADOS, mejorPotencia);
    vuelosSimulados++;
    const puntoMenos = menos.puntosDeImpacto[0];
    const puntoMas = mas.puntosDeImpacto[0];
    if (puntoMenos && puntoMas) {
      sensibilidadPxPorGrado = Math.hypot(puntoMas.x - puntoMenos.x, puntoMas.y - puntoMenos.y) / (2 * DELTA_SENSIBILIDAD_GRADOS);
    }
  }

  // Fase 4: sonda de sensibilidad de potencia -- misma idea que la de ángulo,
  // pero perturbando potencia (acotada a [0, 100]: el denominador usa el
  // delta REAL tras el recorte, no 2*DELTA_SENSIBILIDAD_POTENCIA, para no
  // subestimar la sensibilidad justo en el candidato de potencia 100%).
  let sensibilidadPxPorPorcentajePotencia = SENSIBILIDAD_SIN_DATOS_PX_PORCENTAJE;
  if (huboCandidato && vuelosSimulados + 2 <= presupuestoMax) {
    const potenciaMenos = Math.max(0, mejorPotencia - DELTA_SENSIBILIDAD_POTENCIA);
    const potenciaMas = Math.min(100, mejorPotencia + DELTA_SENSIBILIDAD_POTENCIA);
    const menos = volar(params, tirador, objetivo, mejorAngulo, potenciaMenos);
    vuelosSimulados++;
    const mas = volar(params, tirador, objetivo, mejorAngulo, potenciaMas);
    vuelosSimulados++;
    const puntoMenos = menos.puntosDeImpacto[0];
    const puntoMas = mas.puntosDeImpacto[0];
    const deltaReal = potenciaMas - potenciaMenos;
    if (puntoMenos && puntoMas && deltaReal > 0) {
      sensibilidadPxPorPorcentajePotencia = Math.hypot(puntoMas.x - puntoMenos.x, puntoMas.y - puntoMenos.y) / deltaReal;
    }
  }

  return {
    anguloGrados: mejorAngulo,
    potencia: mejorPotencia,
    danioObjetivo: mejorDanio,
    sensibilidadPxPorGrado,
    sensibilidadPxPorPorcentajePotencia,
    vuelosSimulados,
    agotado: vuelosSimulados >= presupuestoMax && mejorDanio <= 0,
  };
}
