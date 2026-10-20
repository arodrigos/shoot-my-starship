import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { dispersionPorPotenciaGrados } from "@/sim/balistica/dispersionPotencia";
import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { ALTURA_CANON_PX, alturaSuperficie, crearDetenerseConMecha, detenerseEnSuelo } from "@/sim/armas/resolver";
import { pasosDeMecha } from "@/sim/fisica/comportamientoExtendido";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { Mascara } from "@/sim/terreno/mascara";
import type { ComportamientoDeVuelo } from "@/sim/armas/tipos";
import type { RastreadorImpactoNaves } from "@/sim/naves/impacto";
import type { EstadoAleatorio } from "@/sim/aleatorio";

// prevision-real: cuántos pasos de simularVuelo se muestran como previsualización.
// 90 pasos (1,5s a PASO_FIJO_MS=1000/60) es suficiente para leer la curvatura de
// los pozos cercanos sin que la mira llegue casi nunca al punto de impacto real
// (pvr-2 corta igualmente la cola si lo alcanzara). "erratico" (la mosca) solo
// sigue la parábola marcada en los primeros pasos, antes de que la restitución
// Ornstein-Uhlenbeck de la perturbación acumule desplazamiento apreciable --
// pasado ese tramo, enseñar la parábola sería mentir sobre lo que la mosca
// realmente hace, así que se corta mucho antes.
export const PASOS_PREVISUALIZACION = 90;
export const PASOS_PREVISUALIZACION_ERRATICO = 8;
// Tope duro de la trayectoria por longitud: a potencia mínima el proyectil avanza
// poco por paso y, sin tope, un tiro que no choca simularía el vuelo entero.
export const PASOS_MAXIMOS_TRAYECTORIA = 900;

// gravedad-visible (grav-vis-2): "la previsualización no pasa del 25% del
// vuelo estimado" -- cota relativa, no la cota fija de arriba. Si el vuelo
// real durara menos de FACTOR_UMBRAL_VUELO_CORTO * pasosDeclarados pasos, la
// cota fija sola dejaría ver más de un cuarto del vuelo (un tiro corto se
// previsualizaría casi entero). Resuelto sin simular el vuelo completo cada
// fotograma: basta saber si el vuelo real termina ANTES de ese umbral. Si
// termina antes, el umbral mismo acota el coste de esa simulación extra
// (como mucho 4x pasosDeclarados, nunca el vuelo entero); si no termina
// antes, el 25% de un vuelo "largo" es por construcción >= pasosDeclarados y
// la cota fija de siempre ya cumple el 25% sin necesitar el total exacto.
const FACTOR_UMBRAL_VUELO_CORTO = 4;

// gravedad-visible (grav-vis-5): presupuesto de cómputo por fotograma para
// calcularPrevisualizacion mientras se apunta -- el mismo techo que esp-8
// (pvr-3) ya mide en el peor sistema del diseño (6 planetas, 2 anillos, 40
// asteroides). Si una llamada concreta lo supera, el llamante (Partida.ts)
// oculta la mira ese fotograma en vez de dibujar un trazado que ya ha
// costado más de lo prometido: la promesa de "no arrastrar el rendimiento"
// es sobre lo que se DIBUJA, no sobre si esta llamada en particular pudo
// evitarse (eso ya lo paga el presupuesto de pasos de arriba).
export const PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS = 8;

export function superaPresupuestoComputo(duracionMs: number): boolean {
  return duracionMs > PRESUPUESTO_COMPUTO_PREVISUALIZACION_MS;
}

// pvr-2: nunca se revela el punto de impacto. Si el vuelo real (detenerseEnSuelo)
// termina dentro de la ventana de previsualización, se recorta la cola hasta que
// el último punto quede a más de esta distancia del punto de contacto resuelto.
export const DISTANCIA_MINIMA_OCULTA_IMPACTO_PX = 40;

export interface ParametrosPrevisualizacion {
  readonly mascara: Mascara;
  readonly gravedad: number;
  readonly deriva: number;
  readonly ancho: number;
  readonly alto: number;
  readonly planetas?: RegistroPlanetas;
  readonly rastreadorNaves?: RastreadorImpactoNaves;
  readonly origenX: number;
  readonly origenY?: number;
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly comportamiento: ComportamientoDeVuelo;
  // mos-1: el mismo EstadoAleatorio hilvanado que consumiría el disparo real
  // si se hiciera ahora -- NUNCA una semilla propia de la previsualización.
  // Es de solo lectura: el resultado de simularVuelo aquí se descarta, nunca
  // se hilvana de vuelta al estado de partida. Sin ella, "erratico" se
  // muestra sin perturbación (ballística pura), que sigue siendo honesto
  // para el tramo cortísimo que se enseña (pvr-2).
  readonly aleatorio?: EstadoAleatorio;
  // potencia-dispersion-3: los extremos del cono se recortan al mismo número
  // de puntos que ya muestra el centro, en vez de aplicar por su cuenta el 25 %
  // del vuelo y el ocultamiento del contacto (pvr-2). Con ángulos por debajo
  // del horizonte el suelo está a pocos pasos: cada extremo, recortado solo,
  // se quedaba en un punto y la banda desaparecía aunque el centro sí se viera.
  // No revela nada nuevo: nunca es más largo que lo que el centro ya enseña.
  readonly longitudFija?: number;
  // trayectoria-pantalla: la mira nueva no recorta por pasos ni por el 25 % del
  // vuelo, sino por longitud de arco; el llamante la convierte desde píxeles de
  // pantalla. Con ella se devuelve el prefijo hasta esa longitud (o hasta el
  // choque) sin ocultar el contacto, y la mosca vuela sin perturbación: el
  // abanico es lo que enseña su imprevisibilidad.
  readonly longitudMundoMax?: number;
}

export interface PuntoPrevisualizacion {
  readonly x: number;
  readonly y: number;
}

// pvr-1: calcula la previsualización llamando al MISMO simularVuelo que
// resuelve un disparo real (nunca una fórmula de gravedad uniforme aparte),
// con el campo multipozo completo cuando lo hay -- es, literalmente, un
// prefijo de los primeros pasos del vuelo real, no una aproximación.
//
// `simularVuelo` solo respeta `presupuestoPasos` en modo multipozo (nucleo-
// gravedad): en el modo de un único mapa corre hasta `detenerse` sin más
// cota que PASOS_MAXIMOS_VUELO. Por eso el corte de pasos de la previsualización
// se hace envolviendo `detenerse` -- el único punto de extensión que el propio
// vuelo.ts documenta -- en vez de depender de esa opción, y así el límite es
// el mismo en los dos modos sin tocar simularVuelo.
export function calcularPrevisualizacion(params: ParametrosPrevisualizacion): readonly PuntoPrevisualizacion[] {
  const esInstantaneo = params.comportamiento.tipo === "instantaneo";
  const esErratico = params.comportamiento.tipo === "erratico";

  const origenY = params.origenY ?? alturaSuperficie(params.mascara, params.origenX) ?? params.alto - 1;
  const rad = (params.anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(params.potencia);
  const inicial = crearProyectil(params.origenX, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));

  // arm-4/arm-6: el láser instantáneo vuela con gravedad 0 y sin planetas --
  // el mismo ajuste que hace resolver.ts para el disparo real.
  const detenerseSuelo = detenerseEnSuelo(params.mascara, params.ancho, params.alto);
  let detenerseReal = esInstantaneo ? (p: EstadoProyectil) => p.y < 0 || detenerseSuelo(p) : detenerseSuelo;
  const gravedad = esInstantaneo ? 0 : params.gravedad;
  const deriva = esInstantaneo ? 0 : params.deriva;
  const planetas = esInstantaneo ? undefined : params.planetas;
  const rastreadorNaves = esInstantaneo ? undefined : params.rastreadorNaves;

  // vex-1/vex-4: la granada/mina con mecha también puede detonar en el aire,
  // por temporizador -- un airburst dentro de la ventana de previsualización
  // es un contacto real tanto como el terreno, y hay que poder ocultarlo
  // igual (pvr-2 no distingue "cómo" detona, solo "que no se adivine dónde").
  if (params.comportamiento.tipo === "mecha" || params.comportamiento.tipo === "adherente-con-mecha") {
    detenerseReal = crearDetenerseConMecha(detenerseReal, pasosDeMecha(params.comportamiento.segundosHastaDetonar));
  }

  const porLongitud = params.longitudMundoMax !== undefined;
  const perturbacion =
    !porLongitud && params.comportamiento.tipo === "erratico" && params.aleatorio
      ? { magnitudPxS2: params.comportamiento.magnitudPxS2, aleatorio: params.aleatorio }
      : undefined;

  const pasosDeclarados = esErratico ? PASOS_PREVISUALIZACION_ERRATICO : PASOS_PREVISUALIZACION;
  const umbralVueloCorto = pasosDeclarados * FACTOR_UMBRAL_VUELO_CORTO;

  let llamadas = 0;
  let cortadoPorUmbral = false;
  let arco = 0;
  let anterior: EstadoProyectil | null = null;
  const detenerseAcotado = (p: EstadoProyectil): boolean => {
    if (detenerseReal(p)) return true;
    if (porLongitud) {
      if (anterior !== null) arco += Math.hypot(p.x - anterior.x, p.y - anterior.y);
      anterior = p;
      return arco > (params.longitudMundoMax as number) || ++llamadas > PASOS_MAXIMOS_TRAYECTORIA;
    }
    llamadas++;
    if (llamadas > umbralVueloCorto) {
      cortadoPorUmbral = true;
      return true;
    }
    return false;
  };

  const resultado = simularVuelo(inicial, gravedad, deriva, detenerseAcotado, {
    planetas,
    rastreadorNaves,
    perturbacion,
    grabarTrayectoria: true,
    encuadre: { ancho: params.ancho, alto: params.alto },
  });

  const trayectoria = resultado.trayectoria ?? [inicial];
  if (porLongitud) return trayectoria;
  if (params.longitudFija !== undefined) return trayectoria.slice(0, params.longitudFija);

  // gravedad-visible (grav-vis-2): el vuelo real no terminó dentro del
  // umbral corto -- es "largo" (>= FACTOR_UMBRAL_VUELO_CORTO * pasosDeclarados
  // pasos), así que el 25% de su duración real ya es >= pasosDeclarados: la
  // cota fija de siempre cumple el límite relativo sin necesitar el total
  // exacto, y como ningún punto mostrado es un contacto real no hay nada que
  // ocultar (igual que antes de este bloque).
  if (cortadoPorUmbral) return trayectoria.slice(0, pasosDeclarados + 1);

  // Vuelo "corto": trayectoria ya es el vuelo real completo (terminó por su
  // cuenta antes del umbral), así que su longitud ES el total real -- el 25%
  // se calcula sobre ese total, no sobre una estimación.
  const totalPasosReales = trayectoria.length - 1;
  const longitudPrevisualizacion = Math.min(pasosDeclarados, Math.ceil(totalPasosReales * 0.25));
  const recortada = trayectoria.slice(0, longitudPrevisualizacion + 1);

  const contacto = trayectoria[trayectoria.length - 1];
  let corte = recortada.length;
  while (
    corte > 1 &&
    Math.hypot(recortada[corte - 1].x - contacto.x, recortada[corte - 1].y - contacto.y) < DISTANCIA_MINIMA_OCULTA_IMPACTO_PX
  ) {
    corte--;
  }
  return recortada.slice(0, corte);
}

export interface BandaPrevisualizacion {
  readonly centro: readonly PuntoPrevisualizacion[];
  // Las DOS trayectorias extremas del cono de dispersión (potencia-
  // dispersion-4, el diferencial del bloque): cada una es un prefijo real
  // de simularVuelo con el ángulo desviado ±amplitud, integrado con la
  // MISMA gravedad real que el proyectil -- nunca un cono recto geométrico.
  // Vacías cuando la amplitud a esta potencia es 0 (banda baja, pot-1):
  // ahí no hay nada que mostrar aparte del centro.
  readonly extremoMenor: readonly PuntoPrevisualizacion[];
  readonly extremoMayor: readonly PuntoPrevisualizacion[];
  readonly amplitudGrados: number;
}

// potencia-dispersion-3/pot-4: la banda que de verdad enseña el riesgo --
// tres llamadas al MISMO calcularPrevisualizacion (nunca una fórmula de cono
// recto aparte), una al ángulo pedido y dos a ±amplitudGrados. Cuando la
// amplitud es 0 (potencia baja), los dos extremos colapsan al centro: seguir
// dibujándolos no miente (coinciden con el centro), pero el llamante puede
// optar por no pintarlos encima si amplitudGrados es 0.
export function calcularBandaPrevisualizacion(params: ParametrosPrevisualizacion): BandaPrevisualizacion {
  const amplitudGrados = dispersionPorPotenciaGrados(params.potencia);
  const centro = calcularPrevisualizacion(params);
  if (amplitudGrados === 0) {
    return { centro, extremoMenor: centro, extremoMayor: centro, amplitudGrados };
  }
  const longitudFija = centro.length;
  const extremoMenor = calcularPrevisualizacion({ ...params, anguloGrados: params.anguloGrados - amplitudGrados, longitudFija });
  const extremoMayor = calcularPrevisualizacion({ ...params, anguloGrados: params.anguloGrados + amplitudGrados, longitudFija });
  return { centro, extremoMenor, extremoMayor, amplitudGrados };
}

export interface AbanicoPrevisualizacion {
  readonly centro: readonly PuntoPrevisualizacion[];
  // Trayectorias reales (misma gravedad) a ±semiapertura1 y ±semiapertura2.
  readonly tramo1: { readonly menor: readonly PuntoPrevisualizacion[]; readonly mayor: readonly PuntoPrevisualizacion[] };
  readonly tramo2: { readonly menor: readonly PuntoPrevisualizacion[]; readonly mayor: readonly PuntoPrevisualizacion[] };
}

// trayectoria-pantalla: cinco llamadas al MISMO calcularPrevisualizacion (centro
// y cuatro extremos), todas con la misma cota de longitud. No depende de la
// potencia: la dispersión real del disparo no se muestra.
export function calcularAbanicoPrevisualizacion(
  params: ParametrosPrevisualizacion & { readonly longitudMundoMax: number },
  semiapertura1: number,
  semiapertura2: number,
): AbanicoPrevisualizacion {
  const en = (delta: number): readonly PuntoPrevisualizacion[] => calcularPrevisualizacion({ ...params, anguloGrados: params.anguloGrados + delta });
  return {
    centro: en(0),
    tramo1: { menor: en(-semiapertura1), mayor: en(semiapertura1) },
    tramo2: { menor: en(-semiapertura2), mayor: en(semiapertura2) },
  };
}
