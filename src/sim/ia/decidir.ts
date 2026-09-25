import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import type { SolucionBalistica } from "@/sim/balistica/solucionador";
import type { EntradaDeTurno } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";
import { trazarIntentos, type IntentoBalistico } from "@/sim/ia/trazado";
import type { Personalidad, RangoDeError } from "@/sim/ia/tipos";

// Arma a la que recurre cualquier personalidad cuando ninguna solución
// exacta es viable (ia-2): dispara contra el obstáculo en vez de contra la
// nave -- es de terreno (excava, no hace daño de área grande) y es
// razonable intentarlo sea cual sea el carácter del rival.
const ARMA_DE_DESBLOQUEO = "zanjadora-manolita";
const ANGULO_POR_DEFECTO: SolucionBalistica = { anguloGrados: 45, potencia: 70 };

// Por debajo de esto se considera "ha dado", y no dispara la corrección de
// ia-5: es mayor que la tolerancia de viabilidad del trazado (trazado.ts)
// porque aquí se mide sobre el disparo YA degradado con error, no sobre la
// solución exacta. Exportado para que partida-completa (el bucle de partida
// en vivo y su test de simulación) use exactamente el mismo umbral al
// contar fallos consecutivos, en vez de duplicar el número.
export const UMBRAL_FALLO_PX = 40;
// Fracción del rango de error normal que se usa cuando el intento anterior
// de esta personalidad contra este objetivo falló: ninguna personalidad dice
// "banda alta" en su desviación pero SÍ corrige, así que la corrección no
// depende del perfil de error, es la misma fracción para las tres (ia-5 no
// distingue por personalidad).
const FACTOR_DE_CORRECCION = 0.35;
// Cuántos turnos SEGUIDOS bloqueados (cavando con la zanjadora) se toleran
// antes de desistir y disparar un arma real de todas formas (partida-completa,
// descubierto por partida-3): cavar cerca del objetivo reforma el terreno, y
// a veces lo reforma de un modo que mantiene el MISMO disparo bloqueado turno
// tras turno -- un espiral que ninguna corrección de ángulo arregla, porque
// no es ruido, es terreno que la propia zanjadora lleva varios turnos
// removiendo. Pasado este número de fallos seguidos contra el mismo
// objetivo, se deja de cavar y se dispara el mejor esfuerzo con el arma real
// de la personalidad: su radio de daño es la última baza para llegar de
// todas formas, y al parar de cavar se corta el espiral en vez de alimentarlo.
const UMBRAL_DESBLOQUEO_FORZADO = 3;

export interface UltimoIntentoIA {
  readonly distanciaAlObjetivoPx: number;
  // Cuántos disparos seguidos ha fallado esta personalidad contra este
  // mismo objetivo (partida-completa, descubierto por partida-3): a la
  // distancia real de tiro entre naves, el único arco viable suele ser casi
  // vertical, donde el mismo error angular de siempre desplaza el punto de
  // caída mucho más que en el rango corto que valida ia-5 -- una única
  // corrección de 0.35x no basta ahí. Omitido reproduce EXACTAMENTE el 0.35x
  // de siempre (ia-4/ia-5 lo verifican así bit a bit, siempre con este campo
  // ausente); con fallos consecutivos, el factor se compone (0.35^n), cada
  // vez más ajustado. Quien lo lleva decide cuándo baja: el bucle en vivo
  // (Partida.ts) solo lo sube, nunca lo resetea con un acierto suelto --
  // un disparo que cae cerca por pura suerte, antes de que la corrección
  // haya convergido de verdad, no demuestra que ya no haga falta.
  readonly fallosConsecutivos?: number;
}

export interface ErrorInyectado {
  readonly anguloGrados: number;
  readonly potencia: number;
}

function valorEnRango(rango: RangoDeError, unidad: number): number {
  return rango.minimo + unidad * (rango.maximo - rango.minimo);
}

// Expuesta aparte (y no inlineada en decidirTurnoIA) para que ia-4 pueda
// recalcular el error esperado de forma independiente, con la misma semilla,
// y comparar bit a bit contra lo que produjo decidirTurnoIA.
export function calcularErrorInyectado(
  personalidad: Personalidad,
  aleatorio: EstadoAleatorio,
  factorCorreccion: number = 1,
): { readonly error: ErrorInyectado; readonly aleatorio: EstadoAleatorio } {
  const pasoAngulo = siguienteAleatorio(aleatorio);
  const pasoPotencia = siguienteAleatorio(pasoAngulo.estado);
  return {
    error: {
      anguloGrados: valorEnRango(personalidad.error.anguloGrados, pasoAngulo.valor) * factorCorreccion,
      potencia: valorEnRango(personalidad.error.potencia, pasoPotencia.valor) * factorCorreccion,
    },
    aleatorio: pasoPotencia.estado,
  };
}

// Un único punto de decisión de arma: pesos decrecientes entre las tres
// preferidas (ia-6 exige que la elección varíe con el escenario y con la
// personalidad, no una etiqueta fija). Si `bloqueada`, ignora la política de
// la personalidad -- el arma la decide la situación, no el carácter.
function elegirArma(
  personalidad: Personalidad,
  bloqueada: boolean,
  aleatorio: EstadoAleatorio,
): { readonly armaId: string; readonly aleatorio: EstadoAleatorio } {
  if (bloqueada) {
    return { armaId: ARMA_DE_DESBLOQUEO, aleatorio };
  }
  const paso = siguienteAleatorio(aleatorio);
  const opciones = personalidad.ordenPreferenciaArmas;
  let armaId: string;
  if (paso.valor < 0.5) {
    armaId = opciones[0];
  } else if (paso.valor < 0.8) {
    armaId = opciones[1] ?? opciones[0];
  } else {
    armaId = opciones[2] ?? opciones[0];
  }
  return { armaId, aleatorio: paso.estado };
}

function elegirSolucionViable(viables: readonly IntentoBalistico[], personalidad: Personalidad): IntentoBalistico {
  const preferida = viables.find((intento) => intento.esMortero === (personalidad.trayectoriaPreferida === "mortero"));
  return preferida ?? viables[0];
}

// El intento que más ha avanzado hacia el objetivo antes de chocar: es el
// "otra cosa" contra la que dispara la personalidad cuando está bloqueada
// (ia-2), en vez de repetir el mismo tiro imposible cada turno.
function elegirMejorEsfuerzo(intentos: readonly IntentoBalistico[], origenX: number): IntentoBalistico {
  return intentos.reduce((mejor, candidato) =>
    Math.abs(candidato.puntoDeImpacto.x - origenX) > Math.abs(mejor.puntoDeImpacto.x - origenX) ? candidato : mejor,
  );
}

export interface ParametrosDecisionIA {
  readonly mascara: Mascara;
  readonly origenX: number;
  readonly objetivoX: number;
  readonly gravedad: number;
  readonly deriva: number;
  readonly ancho: number;
  readonly alto: number;
  readonly personalidad: Personalidad;
  readonly aleatorio: EstadoAleatorio;
  // Resultado del último disparo de ESTA personalidad contra ESTE objetivo,
  // si lo hubo: lo que hace posible la corrección de ia-5. null en el
  // primer disparo de la partida contra este objetivo.
  readonly ultimoIntento: UltimoIntentoIA | null;
}

export interface ResultadoDecisionIA {
  readonly entrada: EntradaDeTurno;
  readonly aleatorio: EstadoAleatorio;
  // true si ninguna raíz exacta llegaba limpia al objetivo (ia-2): la
  // entrada resultante apunta al obstáculo, no a la nave contraria.
  readonly bloqueada: boolean;
  // La solución SIN degradar que se usó de base, para que ia-4 pueda
  // verificar que el error inyectado es exactamente la diferencia entre
  // esto y `entrada`.
  readonly solucionExacta: SolucionBalistica;
}

// El punto donde se componen las dos capas del diseño: el solucionador
// exacto degradado (QUÉ trayectoria, filtrada por el trazado de ia-2) y la
// personalidad (QUÉ arma, con qué error). No escribe nada en el terreno ni
// en el daño -- solo produce una EntradaDeTurno, igual que la fuente de un
// jugador humano; es avanzar()/resolverDisparo quien la convierte en
// cambios de estado (ia-4).
export function decidirTurnoIA(params: ParametrosDecisionIA): ResultadoDecisionIA {
  const { mascara, origenX, objetivoX, gravedad, deriva, ancho, alto, personalidad, ultimoIntento } = params;

  const intentos = trazarIntentos(mascara, origenX, objetivoX, gravedad, deriva, ancho, alto);
  const viables = intentos.filter((intento) => intento.viable);

  const bloqueadaDeVerdad = viables.length === 0;
  const bloqueada = bloqueadaDeVerdad && (ultimoIntento?.fallosConsecutivos ?? 0) < UMBRAL_DESBLOQUEO_FORZADO;
  const intentoElegido = viables.length > 0 ? elegirSolucionViable(viables, personalidad) : null;
  const solucionExacta: SolucionBalistica =
    intentoElegido?.solucion ?? (intentos.length > 0 ? elegirMejorEsfuerzo(intentos, origenX).solucion : ANGULO_POR_DEFECTO);

  // ia-5 original: solo corregía si EL ÚLTIMO disparo (uno solo) había
  // fallado, con un único paso de 0.35x. partida-3 descubrió que releer
  // SIEMPRE distanciaAlObjetivoPx para decidir si corregir descarta la racha
  // acumulada en fallosConsecutivos en cuanto un disparo cae cerca por pura
  // suerte del ruido sin corregir -- la corrección se caía a factor 1 (ruido
  // completo) en mitad de una convergencia real, así que nunca terminaba de
  // asentarse. Si el llamador ya trae fallosConsecutivos, manda ese número
  // (es quien de verdad sabe la racha, incluida la de partida-completa, que
  // no siempre la resetea en un acierto puntual); si no lo trae -- ia-4/ia-5
  // no lo hacen nunca -- se deriva del umbral de un único disparo, que
  // reproduce EXACTAMENTE el 0.35x de siempre.
  const fallosParaCorregir =
    ultimoIntento?.fallosConsecutivos ?? (ultimoIntento && ultimoIntento.distanciaAlObjetivoPx > UMBRAL_FALLO_PX ? 1 : 0);
  const factorCorreccion = FACTOR_DE_CORRECCION ** fallosParaCorregir;
  const { error, aleatorio: aleatorioTrasError } = calcularErrorInyectado(personalidad, params.aleatorio, factorCorreccion);
  const { armaId, aleatorio: aleatorioFinal } = elegirArma(personalidad, bloqueada, aleatorioTrasError);

  const anguloGrados = Math.min(180, Math.max(0, solucionExacta.anguloGrados + error.anguloGrados));
  const potencia = Math.min(100, Math.max(0, solucionExacta.potencia + error.potencia));

  return {
    entrada: { arma: armaId, anguloGrados, potencia },
    aleatorio: aleatorioFinal,
    bloqueada,
    solucionExacta,
  };
}
