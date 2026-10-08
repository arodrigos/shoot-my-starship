import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { MARGEN_SALIDA_U, simularVuelo, type BordeSalida, type PuntoSalida } from "@/sim/fisica/vuelo";
import { pasosDeMecha } from "@/sim/fisica/comportamientoExtendido";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { dispersionPorPotenciaGrados } from "@/sim/balistica/dispersionPotencia";
import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import type { Arma } from "@/sim/armas/tipos";
import { radioEfectoEnMundo } from "@/sim/armas/radioEfecto";
import { distanciaDeDanio } from "@/sim/naves/contacto";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { resolverCaida } from "@/sim/terreno/caida";
import { esSolido, type Mascara } from "@/sim/terreno/mascara";
import { aplicarHuellaCapsula, aplicarHuellaCircular } from "@/sim/terreno/huella";
import { crearRastreadorImpactoNaves, type NavePosicion, type RastreadorImpactoNaves, type RoceNave } from "@/sim/naves/impacto";
import type { IdNave } from "@/sim/partida/tipos";

export interface PuntoDeImpacto {
  readonly x: number;
  readonly y: number;
  // impacto-naves (imp-1): la nave cuyo casco ha detenido el vuelo en este
  // punto exacto, si alguna -- undefined cuando el punto es una detonación
  // normal contra sólido, fuera de mundo o ápice de submuniciones.
  readonly impactoNave?: IdNave;
}

export interface SalidaDePantalla extends PuntoSalida {
  readonly borde: BordeSalida;
}

function salidaDeVuelo(borde: BordeSalida | null, punto: PuntoSalida | null): SalidaDePantalla | undefined {
  return borde && punto ? { borde, x: punto.x, y: punto.y } : undefined;
}

export interface ResultadoDisparo {
  readonly mascara: Mascara;
  readonly aleatorio: EstadoAleatorio;
  readonly fallo: boolean;
  readonly danioObjetivo: number;
  // Paralelo a puntosDeImpacto: el daño que aportó cada detonación, para que
  // avanzar() pueda emitir un evento "impacto" por punto sin recalcular la
  // caída de daño por distancia (Racimo de Tuppers detona en varios sitios y
  // cada uno ilumina su propio cráter).
  readonly danioPorPunto: readonly number[];
  readonly danioPropio: number;
  // impacto-naves (imp-5): daño por AUTOIMPACTO cuando la gravedad devuelve
  // el proyectil sobre el casco de quien dispara -- null cuando no ha
  // ocurrido. Deliberadamente SEPARADO de danioPropio (Despedida, autodaño
  // fijo garantizado por catálogo): son dos mecánicas distintas que pueden
  // darse a la vez sin pisarse (ver desviaciones).
  readonly impactoPropio: { readonly danio: number; readonly x: number; readonly y: number } | null;
  // Positivo = hacia +x. Solo lo produce el Gravitón (efecto "empuje").
  readonly desplazamientoObjetivoPx: number;
  readonly puntosDeImpacto: readonly PuntoDeImpacto[];
  // Altura de la superficie bajo el tirador en el momento del disparo: la
  // necesita avanzar() para situar el evento de autodaño de Despedida, que
  // no tiene su propio punto de impacto (la huella se aplica en el origen).
  readonly origenY: number;
  // grav-6 / render-espacio: true cuando simularVuelo ha agotado el
  // presupuesto de vuelo multipozo sin que el proyectil llegara a detenerse
  // (órbita estable). puntosDeImpacto viaja vacío en ese caso -- no hay
  // ningún punto real que impactar ni huella que aplicar.
  readonly proyectilPerdido: boolean;
  // salida-pantalla: null salvo que el disparo se haya perdido al salir del
  // encuadre; la cáscara lo usa para el aviso «¡Perdido!» junto a ese borde.
  readonly salida?: SalidaDePantalla | null;
  // contacto-honesto (con-1): la nave (si alguna) rozada por este disparo --
  // aproximación mínima fuera del casco de colisión pero dentro de la
  // silueta dibujada. null en cualquier disparo sin roce, incluido todo
  // disparo con impacto real (el casco, si corta, gana). Con más de un
  // vuelo (submuniciones, ráfaga) es el primer roce encontrado, agregado
  // igual que ya agrega `perdido` -- ninguna de esas armas existe todavía en
  // este diseño, así que hoy siempre viene de un único vuelo.
  readonly roce: RoceNave | null;
  // armas-metrica: pasos de simulación (PASO_FIJO_MS cada uno) hasta la
  // PRIMERA detonación -- mismo criterio de agregación que `roce` (el primer
  // vuelo real, nunca un promedio inventado entre sub-proyectiles). Es lo
  // que permite medir "tiempo de vuelo medio" con el propio simulador en vez
  // de una fórmula balística aparte que ignoraría terreno y gravedad de N
  // cuerpos.
  readonly pasosVuelo: number;
}

// Altura del cañón sobre el punto de apoyo: la resta ia-personalidades
// también aplica antes de trazar, para que el punto de partida del vuelo
// simulado sea el mismo que el que usa un disparo real (ia-2, ia-4).
export const ALTURA_CANON_PX = 26;

function clonarMascara(mascara: Mascara): Mascara {
  return { ancho: mascara.ancho, alto: mascara.alto, datos: new Uint8Array(mascara.datos) };
}

// Exportada para que ia-personalidades calcule el mismo origen/objetivo en
// altura que usará el disparo real, sin duplicar la lectura de la máscara.
export function alturaSuperficie(mascara: Mascara, x: number): number | null {
  const columna = Math.round(Math.min(mascara.ancho - 1, Math.max(0, x)));
  const resultado = resolverCaida(mascara, columna);
  return resultado.tipo === "reposo" ? resultado.y : null;
}

// Exportada porque ia-2 exige EXACTAMENTE la misma condición de parada para
// el trazado que descarta soluciones bloqueadas y para el disparo real: dos
// implementaciones que "deberían" coincidir es como se cuela el desajuste
// que el criterio quiere atrapar.
//
// El techo del vuelo es tres mundos por encima del borde superior (con menos,
// cambiaba el desenlace de lobs que sí vuelven). Un tiro que se escapa hacia
// arriba, p. ej. con la gravedad a la mitad, ya no vuelve a verse, y dejarlo
// agotar el presupuesto de pasos eran ~12 s simulados de animación sin nada
// en pantalla. Todas las condiciones de parada comparten este corte para que
// núcleo, trazado de la IA y animador sigan coincidiendo.
export function detenerseEnSuelo(mascara: Mascara, ancho: number, alto: number) {
  return (p: EstadoProyectil): boolean => {
    if (p.y > alto + MARGEN_SALIDA_U || p.y < -MARGEN_SALIDA_U || p.x < -MARGEN_SALIDA_U || p.x > ancho + MARGEN_SALIDA_U) {
      return true;
    }
    return esSolido(mascara, Math.round(p.x), Math.round(p.y));
  };
}

// armas-nuevas (arm-3, arm-8): variante de detenerseEnSuelo que, en vez de
// detonar en el primer píxel sólido, sigue contando distancia recorrida
// DENTRO del sólido hasta penetracionMaximaPx y detona al salir por el otro
// lado (o al agotar el presupuesto sin salir). `puntosPenetrados` acumula
// cada paso dado dentro del sólido -- es el rastro que luego se excava como
// túnel, aparte del cráter que aplicarHuellaDeArma pone en el punto final.
// Separada de detenerseEnSuelo (no una versión con parámetro por defecto)
// porque esta SÍ necesita devolver estado además del booleano de parada, y
// detenerseEnSuelo la reutiliza ia-2/control-apuntado con la forma exacta
// que ya tienen -- tocar su firma les rompería la comparación estricta.
function crearDetenerseConPenetracion(mascara: Mascara, ancho: number, alto: number, penetracionMaximaPx: number) {
  const puntosPenetrados: { x: number; y: number }[] = [];
  let dentroDeSolido = false;
  let distanciaEnSolidoPx = 0;
  let anteriorX: number | null = null;
  let anteriorY: number | null = null;

  const detenerse = (p: EstadoProyectil): boolean => {
    if (p.y > alto + MARGEN_SALIDA_U || p.y < -MARGEN_SALIDA_U || p.x < -MARGEN_SALIDA_U || p.x > ancho + MARGEN_SALIDA_U) {
      return true;
    }
    const solido = esSolido(mascara, Math.round(p.x), Math.round(p.y));
    const pasoPx = anteriorX === null ? 0 : Math.hypot(p.x - anteriorX, p.y - anteriorY!);
    anteriorX = p.x;
    anteriorY = p.y;

    if (!solido) {
      // Si venía de dentro del sólido, esto es "salir por el otro lado":
      // detona aquí, en aire, con el túnel ya recorrido detrás.
      return dentroDeSolido;
    }

    if (!dentroDeSolido) {
      dentroDeSolido = true;
      distanciaEnSolidoPx = 0;
    } else {
      distanciaEnSolidoPx += pasoPx;
    }
    puntosPenetrados.push({ x: p.x, y: p.y });
    return distanciaEnSolidoPx >= penetracionMaximaPx;
  };

  return { detenerse, puntosPenetrados };
}

// cat-2: condición de parada del haz láser. A diferencia del túnel de la
// Barrena (detona al SALIR de la roca), el haz sigue su línea recta tras
// cruzar roca fina y puede dañar un casco que haya detrás; solo se detiene
// cuando la roca recorrida suma `penetracionMaximaPx`.
function crearDetenerseHaz(mascara: Mascara, ancho: number, alto: number, penetracionMaximaPx: number) {
  let distanciaEnSolidoPx = 0;
  let anterior: EstadoProyectil | null = null;
  return (p: EstadoProyectil): boolean => {
    if (p.y > alto + MARGEN_SALIDA_U || p.y < -MARGEN_SALIDA_U || p.x < -MARGEN_SALIDA_U || p.x > ancho + MARGEN_SALIDA_U) return true;
    // El paso de integración puede ser de decenas de píxeles: se recorre el
    // segmento de 1 en 1 para medir la roca realmente cruzada, no el paso.
    if (anterior !== null) {
      const largo = Math.hypot(p.x - anterior.x, p.y - anterior.y);
      const muestras = Math.max(1, Math.ceil(largo));
      for (let i = 1; i <= muestras; i++) {
        const t = i / muestras;
        if (esSolido(mascara, Math.round(anterior.x + (p.x - anterior.x) * t), Math.round(anterior.y + (p.y - anterior.y) * t))) {
          distanciaEnSolidoPx += largo / muestras;
        }
      }
    } else if (esSolido(mascara, Math.round(p.x), Math.round(p.y))) {
      distanciaEnSolidoPx += 1;
    }
    anterior = { ...p };
    return distanciaEnSolidoPx >= penetracionMaximaPx;
  };
}

// vuelo-extensible (vex-1, vex-2, vex-4): variante de detenerseEnSuelo para
// el arma "mecha" (granada de espoleta) -- fuerza la parada cuando el
// contador de PASOS DE SIMULACIÓN alcanza pasosHastaDetonar, tanto si el
// contacto con sólido o casco ya paró antes como si no: la granada detona
// en el aire si el temporizador gana, y en tierra/casco si el contacto
// llega primero. `detenerse` se llama una vez por posición candidata ANTES
// de integrar el siguiente paso (mismo orden que el bucle de simularVuelo),
// así que la primera llamada ve 0 pasos dados: se detona cuando el número
// de pasos YA INTEGRADOS alcanza pasosHastaDetonar, nunca antes ni un paso
// tarde. Mismo patrón de cierre con estado propio que
// crearDetenerseConPenetracion, exportada para que el animador del cliente
// (vex-2) construya la MISMA condición en vez de temporizar por su cuenta.
export function crearDetenerseConMecha(detenerseBase: (p: EstadoProyectil) => boolean, pasosHastaDetonar: number) {
  let llamadas = 0;
  return (p: EstadoProyectil): boolean => {
    if (detenerseBase(p)) {
      return true;
    }
    llamadas++;
    return llamadas > pasosHastaDetonar;
  };
}

// La Pelota de Chatarra (comportamiento "rodante"): tras el primer contacto,
// camina columna a columna hacia el lado más bajo hasta distanciaMaximaPx o
// hasta encontrar un hueco (una caída brusca -- un cráter ya existente, o el
// final del soporte), que es donde detona. Es terreno, no física de
// proyectil, así que no reutiliza integrarPasoProyectil: es un recorrido
// discreto sobre la máscara.
function resolverRodadura(mascara: Mascara, xInicial: number, yInicial: number, distanciaMaximaPx: number, pasoPx: number): PuntoDeImpacto {
  const alturaEn = (x: number): number => alturaSuperficie(mascara, x) ?? Number.POSITIVE_INFINITY;
  // ia-autodanio: yInicial es el punto de contacto REAL del proyectil
  // (detenerseEnSuelo también para en el borde del mapa, sin suelo sólido
  // debajo -- ahí alturaSuperficie no encuentra nada en toda la columna y
  // devolvía Infinity, haciendo rodar la bola hacia un punto de impacto
  // también infinito). Si no hay un contacto real que rodar, se detona donde
  // cayó, sin intentar rodar sobre un suelo que no existe.
  if (!Number.isFinite(yInicial)) {
    return { x: xInicial, y: yInicial };
  }
  const yIzquierda = alturaEn(xInicial - pasoPx);
  const yDerecha = alturaEn(xInicial + pasoPx);

  // "y" mayor es más abajo en pantalla: rueda hacia el lado con mayor y.
  let direccion = 0;
  if (yDerecha > yIzquierda) direccion = 1;
  else if (yIzquierda > yDerecha) direccion = -1;

  if (direccion === 0) {
    return { x: xInicial, y: yInicial };
  }

  let xActual = xInicial;
  let yActual = yInicial;
  let recorridoPx = 0;

  while (recorridoPx < distanciaMaximaPx) {
    const xSiguiente = xActual + direccion * pasoPx;
    if (xSiguiente < 0 || xSiguiente >= mascara.ancho) {
      break;
    }
    const ySiguiente = alturaEn(xSiguiente);
    xActual = xSiguiente;
    recorridoPx += pasoPx;
    // Hueco: una caída mucho mayor que el paso es un cráter o el final del
    // soporte, no una simple pendiente -- ahí se para y detona.
    if (!Number.isFinite(ySiguiente) || ySiguiente - yActual > pasoPx * 3) {
      yActual = Number.isFinite(ySiguiente) ? ySiguiente : yActual;
      break;
    }
    yActual = ySiguiente;
  }

  return { x: xActual, y: yActual };
}

// El Racimo de Tuppers (comportamiento "submuniciones"): vuela como
// cualquier otro disparo hasta el ápice (vy cruza a >= 0) y desde ahí se
// reparte en `cantidad` sub-proyectiles con dispersión simétrica en vx,
// cada uno resuelto con la MISMA simularVuelo que el disparo real -- nunca
// una física de submunición aparte.
// `planetas`, igual que en simularVuelo, es opcional y aditivo (nucleo-
// gravedad): las submuniciones son "la MISMA simularVuelo que el disparo
// real" también en esto, así que el ápice y cada sub-proyectil vuelan con
// el mismo tirón de N cuerpos que el disparo que los generó -- nunca una
// gravedad distinta a mitad de vuelo (grav-4, congelada hasta que el turno
// cierra en avanzar()).
interface ResultadoPuntosDeImpacto {
  readonly puntos: readonly PuntoDeImpacto[];
  readonly perdido: boolean;
  // salida-pantalla: borde y punto por los que se perdió el disparo; ausente
  // cuando no hay pérdida o se debe a la órbita sin fin.
  readonly salida?: SalidaDePantalla;
  // armas-nuevas (arm-3): rastro dejado dentro de un sólido por un arma con
  // penetracionPx, aparte de los puntos de impacto que reciben daño -- ver
  // crearDetenerseConPenetracion. Ausente en el resto del catálogo.
  readonly puntosPenetrados?: readonly { readonly x: number; readonly y: number }[];
  // contacto-honesto: ver el comentario de ResultadoDisparo.roce.
  readonly roce?: RoceNave;
  // armas-metrica: ver el comentario de ResultadoDisparo.pasosVuelo. Mismo
  // criterio de agregación que roce -- el primer vuelo real (el ápice en
  // submuniciones, el primer proyectil del abanico en ráfaga).
  readonly pasos: number;
  // vuelo-extensible (vex-3): estado del PRNG hilvanado tras este disparo --
  // idéntico al recibido en cualquier arma que no sea "erratico" (no
  // consume tiradas de vuelo), y avanzado tras cada perturbación consumida
  // en las que sí lo son. resolverDisparo lo usa para el aleatorio final del
  // ResultadoDisparo completo.
  readonly aleatorio: EstadoAleatorio;
}

function resolverSubmuniciones(
  inicial: EstadoProyectil,
  gravedad: number,
  deriva: number,
  mascara: Mascara,
  ancho: number,
  alto: number,
  cantidad: number,
  dispersionPxS: number,
  planetas?: RegistroPlanetas,
  rastreadorNaves?: RastreadorImpactoNaves,
): Omit<ResultadoPuntosDeImpacto, "aleatorio"> {
  const detenerse = detenerseEnSuelo(mascara, ancho, alto);
  const {
    proyectil: apice,
    pasos,
    perdido: apicePerdido,
    bordeSalida: apiceBorde,
    puntoSalida: apicePunto,
    impactoNave: impactoNaveApice,
    roceNave: roceApice,
  } = simularVuelo(inicial, gravedad, deriva, (p) => p.vy >= 0 || detenerse(p), { planetas, rastreadorNaves, encuadre: { ancho, alto } });

  const apiceSalida: SalidaDePantalla | undefined = apiceBorde && apicePunto ? { borde: apiceBorde, ...apicePunto } : undefined;
  // grav-6: el propio ápice se ha perdido en órbita antes de cruzar vy>=0 --
  // no hay desde dónde repartir submuniciones.
  if (apicePerdido) {
    return { puntos: [], perdido: true, pasos, salida: apiceSalida };
  }

  // impacto-naves: un casco cortado de camino al ápice detona ahí mismo --
  // el casco siempre gana, nunca se reparte en submuniciones a partir de un
  // punto que ya era un impacto.
  if (pasos === 0 || detenerse(apice) || impactoNaveApice) {
    // El disparo tocó tierra (o una nave) antes de alcanzar el ápice (ángulo
    // casi horizontal apuntando cuesta abajo): no hay altura para repartir,
    // así que se resuelve como un impacto único en vez de partir en el vacío.
    return {
      puntos: [{ x: apice.x, y: apice.y, impactoNave: impactoNaveApice?.nave }],
      perdido: false,
      roce: roceApice ?? undefined,
      pasos,
    };
  }

  const puntos: PuntoDeImpacto[] = [];
  let salida: SalidaDePantalla | undefined;
  let roce: RoceNave | undefined = roceApice ?? undefined;
  for (let i = 0; i < cantidad; i++) {
    const offset = (i - (cantidad - 1) / 2) * (dispersionPxS / Math.max(1, cantidad - 1));
    const subInicial: EstadoProyectil = { x: apice.x, y: apice.y, vx: apice.vx + offset, vy: apice.vy };
    const { proyectil, perdido, impactoNave, roceNave, bordeSalida, puntoSalida } = simularVuelo(subInicial, gravedad, deriva, detenerse, {
      planetas,
      rastreadorNaves,
      encuadre: { ancho, alto },
    });
    if (perdido && bordeSalida && puntoSalida && !salida) salida = { borde: bordeSalida, ...puntoSalida };
    // Una submunición individual perdida en órbita simplemente no aporta
    // punto de impacto -- el resto de la andanada, si aterriza, sigue
    // contando (grav-6 no exige que TODAS se pierdan para declarar el
    // disparo entero perdido).
    if (!perdido) {
      puntos.push({ x: proyectil.x, y: proyectil.y, impactoNave: impactoNave?.nave });
    }
    if (!roce && roceNave) {
      roce = roceNave;
    }
  }
  return { puntos, perdido: puntos.length === 0, roce, pasos, salida: puntos.length === 0 ? salida : undefined };
}

// Un punto está "anclado" si cae dentro del mundo y toca roca en su entorno
// inmediato: la parada contra sólido deja el proyectil en la superficie, cuyo
// píxel exacto puede ser aire, así que se sondea un entorno corto.
const SONDA_ANCLAJE_PX = 3;
function estaAnclado(mascara: Mascara, x: number, y: number, ancho: number, alto: number): boolean {
  if (x < 0 || x >= ancho || y < 0 || y >= alto) return false;
  const desplazamientos: readonly (readonly [number, number])[] = [
    [0, 0],
    [SONDA_ANCLAJE_PX, 0],
    [-SONDA_ANCLAJE_PX, 0],
    [0, SONDA_ANCLAJE_PX],
    [0, -SONDA_ANCLAJE_PX],
  ];
  return desplazamientos.some(([dx, dy]) => esSolido(mascara, Math.round(x + dx), Math.round(y + dy)));
}

// Un único vuelo con el comportamiento del arma (impacto-simple, rodante,
// submuniciones o instantáneo) y, si declara penetracionPx, el rastro de
// túnel que deja. La ráfaga (resolverPuntosDeImpacto) llama a esto una vez
// por proyectil del abanico -- nunca al revés -- para que "cuántos vuelan"
// sea ortogonal a "cómo vuela cada uno".
function resolverUnDisparo(
  arma: Arma,
  inicial: EstadoProyectil,
  gravedad: number,
  deriva: number,
  mascara: Mascara,
  ancho: number,
  alto: number,
  aleatorio: EstadoAleatorio,
  planetas?: RegistroPlanetas,
  rastreadorNaves?: RastreadorImpactoNaves,
): ResultadoPuntosDeImpacto {
  if (arma.comportamiento.tipo === "submuniciones") {
    // Ninguna variante de vuelo-extensible consume el PRNG de vuelo aquí:
    // "submuniciones" ya ocupa el eje de comportamiento del arma (una
    // declara UNO de los siete tipos, nunca dos a la vez), así que el
    // estado del PRNG que entra sale intacto.
    const resultado = resolverSubmuniciones(
      inicial,
      gravedad,
      deriva,
      mascara,
      ancho,
      alto,
      arma.comportamiento.cantidad,
      arma.comportamiento.dispersionPxS,
      planetas,
      rastreadorNaves,
    );
    return { ...resultado, aleatorio };
  }

  if (arma.comportamiento.tipo === "instantaneo") {
    // armas-nuevas (arm-4): gravedad y deriva forzadas a 0, sin planetas --
    // "inmune a la gravedad" es, literalmente, no dársela a integrarPasoProyectil.
    // Sigue siendo la MISMA simularVuelo (mismo oráculo de vuelo) y el mismo
    // rastreadorNaves que cualquier otra arma (arm-8): el casco corta igual.
    //
    // arm-6: detenerseEnSuelo por sí sola solo vigila el borde inferior y los
    // laterales (y >= alto, x fuera de [0, ancho)) porque cualquier OTRA arma
    // tiene gravedad real que acaba devolviéndola a tierra. El láser es la
    // única que vuela en línea recta con gravedad 0 de verdad: apuntado hacia
    // arriba y sin nada sólido en el camino, puede escapar por el borde
    // superior sin que ninguna de esas condiciones se cumpla nunca, y
    // simularVuelo agota sus 100.000 pasos y lanza en vez de perder el tiro.
    // Se añade aquí, solo para el instantáneo, el borde que le falta.
    // cat-2: con penetracionPx el haz atraviesa hasta esa cantidad de roca
    // ACUMULADA y sigue: solo detona dentro de la roca cuando la agota (si no,
    // en el primer casco, sólido que no puede cruzar, o el borde).
    const penetracionHaz = arma.penetracionPx ?? 0;
    const detenerseSuelo = penetracionHaz > 0 ? crearDetenerseHaz(mascara, ancho, alto, penetracionHaz) : detenerseEnSuelo(mascara, ancho, alto);
    const detenerse = detenerseSuelo;
    const { proyectil, pasos, perdido, impactoNave, roceNave, bordeSalida, puntoSalida } = simularVuelo(inicial, 0, 0, detenerse, { rastreadorNaves, encuadre: { ancho, alto } });
    if (perdido) {
      return { puntos: [], perdido: true, aleatorio, pasos, salida: salidaDeVuelo(bordeSalida, puntoSalida) };
    }
    return {
      puntos: [{ x: proyectil.x, y: proyectil.y, impactoNave: impactoNave?.nave }],
      perdido: false,
      roce: roceNave ?? undefined,
      aleatorio,
      pasos,
    };
  }

  if (arma.comportamiento.tipo === "erratico") {
    // vex-1/vex-3: mosca -- perturbación por paso hilvanada al PRNG del
    // disparo, disfrazada de deriva/gravedad extra (ver
    // comportamientoExtendido.ts). Detiene igual que cualquier arma sin
    // penetración: primer sólido, borde de mundo o casco.
    const detenerse = detenerseEnSuelo(mascara, ancho, alto);
    const { proyectil, pasos, perdido, impactoNave, roceNave, aleatorioFinal, bordeSalida, puntoSalida } = simularVuelo(inicial, gravedad, deriva, detenerse, {
      planetas,
      rastreadorNaves,
      perturbacion: { magnitudPxS2: arma.comportamiento.magnitudPxS2, aleatorio },
    });
    const aleatorioTrasVuelo = aleatorioFinal ?? aleatorio;
    if (perdido) {
      return { puntos: [], perdido: true, aleatorio: aleatorioTrasVuelo, pasos, salida: salidaDeVuelo(bordeSalida, puntoSalida) };
    }
    return {
      puntos: [{ x: proyectil.x, y: proyectil.y, impactoNave: impactoNave?.nave }],
      perdido: false,
      roce: roceNave ?? undefined,
      aleatorio: aleatorioTrasVuelo,
      pasos,
    };
  }

  if (arma.comportamiento.tipo === "mecha") {
    // vex-1/vex-4: granada de espoleta -- detona al primer contacto O al
    // agotar pasosHastaDetonar, lo que llegue antes; ambos se resuelven
    // dentro de esta misma llamada síncrona, así que no queda ningún
    // proyectil pendiente al terminar el turno.
    const detenerseBase = detenerseEnSuelo(mascara, ancho, alto);
    const detenerse = crearDetenerseConMecha(detenerseBase, pasosDeMecha(arma.comportamiento.segundosHastaDetonar));
    const { proyectil, pasos, perdido, impactoNave, roceNave, bordeSalida, puntoSalida } = simularVuelo(inicial, gravedad, deriva, detenerse, { planetas, rastreadorNaves, encuadre: { ancho, alto } });
    if (perdido) {
      return { puntos: [], perdido: true, aleatorio, pasos, salida: salidaDeVuelo(bordeSalida, puntoSalida) };
    }
    return {
      puntos: [{ x: proyectil.x, y: proyectil.y, impactoNave: impactoNave?.nave }],
      perdido: false,
      roce: roceNave ?? undefined,
      aleatorio,
      pasos,
    };
  }

  if (arma.comportamiento.tipo === "adherente-con-mecha") {
    // arma-mina-adherente (min-1): comparte parada de VUELO con
    // impacto-simple (primer sólido o casco, detenerseEnSuelo) -- la
    // adherencia en sí es pintura del cliente (esComportamientoAdherente),
    // no física nueva. Lo que SÍ cambia aquí: a diferencia del resto del
    // catálogo, para quien "perdido en órbita multipozo" es un resultado
    // legítimo (grav-6), la mina nunca puede dejar un turno sin resultado --
    // si se agota el presupuesto de vuelo sin que detenerse se cumpliera
    // nunca, detona igualmente en la última posición conocida del proyectil
    // en vez de declararse perdida. Corrige la suposición original de
    // vuelo-extensible (ver desviaciones en el entregable): "sin rama nueva"
    // era cierto para la física de vuelo, no para este caso límite.
    const detenerse = detenerseEnSuelo(mascara, ancho, alto);
    const { proyectil, pasos, impactoNave, roceNave, bordeSalida, puntoSalida } = simularVuelo(inicial, gravedad, deriva, detenerse, { planetas, rastreadorNaves, encuadre: { ancho, alto } });
    // cat-4: el gancho solo se ancla a roca de planeta o a un casco. En el
    // borde del mundo (o si el presupuesto de vuelo se agota en el vacío) se
    // pierde sin efecto: ni daño ni cambio en la máscara.
    if (!impactoNave && !estaAnclado(mascara, proyectil.x, proyectil.y, ancho, alto)) {
      return { puntos: [], perdido: true, aleatorio, pasos, salida: salidaDeVuelo(bordeSalida, puntoSalida) };
    }
    return {
      puntos: [{ x: proyectil.x, y: proyectil.y, impactoNave: impactoNave?.nave }],
      perdido: false,
      roce: roceNave ?? undefined,
      aleatorio,
      pasos,
    };
  }

  const penetracionMaximaPx = arma.penetracionPx ?? 0;
  const tracker = penetracionMaximaPx > 0 ? crearDetenerseConPenetracion(mascara, ancho, alto, penetracionMaximaPx) : null;
  const detenerse = tracker ? tracker.detenerse : detenerseEnSuelo(mascara, ancho, alto);

  const { proyectil, pasos, perdido, impactoNave, roceNave, bordeSalida, puntoSalida } = simularVuelo(inicial, gravedad, deriva, detenerse, { planetas, rastreadorNaves, encuadre: { ancho, alto } });
  if (perdido) {
    return { puntos: [], perdido: true, aleatorio, pasos, salida: salidaDeVuelo(bordeSalida, puntoSalida) };
  }

  // impacto-naves: la rodadura es terreno, no física de proyectil -- un
  // casco impactado detona ahí mismo y nunca rueda (el corolario del diseño:
  // "la penetración atraviesa sólido pero nunca un casco, que siempre
  // detona" aplica igual de fuerte a la rodadura).
  if (arma.comportamiento.tipo === "rodante" && !impactoNave) {
    const punto = resolverRodadura(mascara, proyectil.x, proyectil.y, arma.comportamiento.distanciaMaximaPx, arma.comportamiento.pasoPx);
    return { puntos: [punto], perdido: false, roce: roceNave ?? undefined, aleatorio, pasos };
  }

  // Resto del catálogo ("impacto-simple", rodante con casco, penetración):
  // la caída genérica, sin rama propia. "adherente-con-mecha" (la mina) ya
  // se resolvió arriba, antes de este punto -- ver el comentario de esa rama.
  return {
    puntos: [{ x: proyectil.x, y: proyectil.y, impactoNave: impactoNave?.nave }],
    perdido: false,
    puntosPenetrados: tracker?.puntosPenetrados,
    roce: roceNave ?? undefined,
    aleatorio,
    pasos,
  };
}

// armas-nuevas (arm-5): la ráfaga -- un abanico de `cantidad` proyectiles
// idénticos, repartidos simétricamente en aperturaGrados alrededor del
// ángulo de disparo real (ya con la dispersión de arm-5 aplicada encima).
// Ausente o cantidad <= 1 es el disparo único de siempre, sin coste extra.
function resolverPuntosDeImpacto(
  arma: Arma,
  inicial: EstadoProyectil,
  gravedad: number,
  deriva: number,
  mascara: Mascara,
  ancho: number,
  alto: number,
  aleatorio: EstadoAleatorio,
  planetas?: RegistroPlanetas,
  rastreadorNaves?: RastreadorImpactoNaves,
): ResultadoPuntosDeImpacto {
  const rafaga = arma.disparosSimultaneos;
  if (!rafaga || rafaga.cantidad <= 1) {
    return resolverUnDisparo(arma, inicial, gravedad, deriva, mascara, ancho, alto, aleatorio, planetas, rastreadorNaves);
  }

  const velocidad = Math.hypot(inicial.vx, inicial.vy);
  const anguloBaseRad = Math.atan2(-inicial.vy, inicial.vx);
  const puntos: PuntoDeImpacto[] = [];
  const puntosPenetrados: { x: number; y: number }[] = [];
  let algunoLlego = false;
  let salida: SalidaDePantalla | undefined;
  let roce: RoceNave | undefined;
  // armas-metrica: pasos del PRIMER proyectil del abanico -- mismo criterio
  // que roce, el primer vuelo real dispara el reloj del disparo entero.
  let pasosPrimerProyectil = 0;
  // vex-3: cada proyectil del abanico hilvana el PRNG desde donde lo dejó
  // el anterior -- mismo patrón que ya usa submuniciones al hilvanar el
  // ESTADO de simulación entre sub-proyectiles, aplicado aquí al PRNG.
  let aleatorioActual = aleatorio;

  for (let i = 0; i < rafaga.cantidad; i++) {
    const offsetGrados = (i - (rafaga.cantidad - 1) / 2) * (rafaga.aperturaGrados / Math.max(1, rafaga.cantidad - 1));
    const anguloRad = anguloBaseRad + (offsetGrados * Math.PI) / 180;
    const subInicial: EstadoProyectil = {
      x: inicial.x,
      y: inicial.y,
      vx: velocidad * Math.cos(anguloRad),
      vy: -velocidad * Math.sin(anguloRad),
    };
    const resultado = resolverUnDisparo(arma, subInicial, gravedad, deriva, mascara, ancho, alto, aleatorioActual, planetas, rastreadorNaves);
    aleatorioActual = resultado.aleatorio;
    if (i === 0) {
      pasosPrimerProyectil = resultado.pasos;
    }
    // Igual que en submuniciones: una flecha perdida en órbita no invalida
    // el resto del abanico, que sigue contando si alguna aterriza.
    if (!resultado.perdido) {
      algunoLlego = true;
      puntos.push(...resultado.puntos);
      if (resultado.puntosPenetrados) {
        puntosPenetrados.push(...resultado.puntosPenetrados);
      }
    }
    if (!salida && resultado.salida) {
      salida = resultado.salida;
    }
    if (!roce && resultado.roce) {
      roce = resultado.roce;
    }
  }

  return {
    puntos,
    perdido: !algunoLlego,
    salida: algunoLlego ? undefined : salida,
    puntosPenetrados: puntosPenetrados.length > 0 ? puntosPenetrados : undefined,
    roce,
    aleatorio: aleatorioActual,
    pasos: pasosPrimerProyectil,
  };
}

export function aplicarHuellaDeArma(mascara: Mascara, arma: Arma, punto: PuntoDeImpacto): void {
  if (arma.huella.tipo === "circular") {
    aplicarHuellaCircular(mascara, punto.x, punto.y, arma.huella.radio, arma.huella.signo);
  } else if (arma.huella.tipo === "capsula") {
    aplicarHuellaCapsula(mascara, punto.x, punto.y, arma.huella.medioLargoPx, arma.huella.radio, arma.huella.signo);
  }
  // "ninguna": el Gravitón no toca la máscara.
}

export function danioPorDistancia(radioEfectoPx: number, danioMaximo: number, distancia: number): number {
  if (radioEfectoPx <= 0 || distancia >= radioEfectoPx) {
    return 0;
  }
  return Math.round(danioMaximo * (1 - distancia / radioEfectoPx));
}

export interface ParametrosResolverDisparo {
  readonly mascara: Mascara;
  readonly gravedad: number;
  readonly deriva: number;
  readonly aleatorio: EstadoAleatorio;
  readonly arma: Arma;
  readonly origenX: number;
  // Opcional y aditivo (render-espacio, nav-1): con una nave flotando entre
  // planetas ya no hay ninguna columna de terreno bajo ella de la que
  // derivar la altura -- si se recibe, se usa tal cual; si no (todo llamante
  // anterior a este bloque, terreno de suelo plano de siempre), se sigue
  // derivando con alturaSuperficie exactamente como antes.
  readonly origenY?: number;
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly objetivoX: number;
  // impacto-naves (imp-3): obligatoria -- el daño se mide en distancia
  // EUCLÍDEA 2D al punto de detonación, nunca solo en X (herencia del suelo
  // plano de siempre, donde toda nave estaba a la misma altura). No tiene
  // valor por defecto razonable: un llamante que la omita mediría mal a
  // propósito.
  readonly objetivoY: number;
  // Nave objetivo, para medir el daño contra su silueta visible y no contra
  // su centro. Si falta, se busca en `naves` la que está en (objetivoX,
  // objetivoY); sin ninguna de las dos, se mide al centro como siempre.
  readonly objetivoId?: IdNave;
  readonly ancho: number;
  readonly alto: number;
  readonly planetas?: RegistroPlanetas;
  // impacto-naves: opcionales y aditivos -- sin ellos (todo llamante de
  // antes de este bloque), ninguna nave detiene el vuelo, exactamente el
  // comportamiento de siempre. Con ambos, el vuelo se detiene en el primer
  // casco vivo que corta, incluido el propio (tras su gracia).
  readonly naves?: readonly NavePosicion[];
  readonly tiradorId?: IdNave;
  // potencia-dispersion (pot-1): false por defecto a propósito -- este
  // mismo resolutor es también EL oráculo de toda exploración de la IA
  // (barridoRejilla, busquedaMultipozo) y de medir:armas, que reutilizan
  // deliberadamente el MISMO EstadoAleatorio sin hilvanar entre llamadas
  // para comparar candidatos de forma determinista entre sí (ver el
  // comentario de `volar` en busquedaMultipozo.ts). Si la dispersión
  // universal se aplicara siempre, cada punto de esas rejillas de
  // exploración recibiría un desvío fijo no cero, desplazando geometrías ya
  // calibradas (medido: rompe la precondición de ia-autodanio-1 y aplana
  // por completo las bandas de ia-punteria-3). Se activa explícitamente
  // solo donde un disparo se resuelve DE VERDAD (avanzar.ts) o donde la IA
  // muestrea el riesgo a propósito (busquedaMultipozo.ts, fase 2c).
  readonly incluirDispersionPotencia?: boolean;
}

// Resuelve un disparo de principio a fin: vuelo (con el comportamiento del
// arma), tirada de fiabilidad, huella en el terreno y efecto sobre la nave.
// Es el único punto donde el catálogo declarativo se convierte en cambios de
// estado -- avanzar() no conoce ningún id de arma, solo llama aquí.
export function resolverDisparo(params: ParametrosResolverDisparo): ResultadoDisparo {
  const { arma } = params;
  const mascara = clonarMascara(params.mascara);

  let aleatorio = params.aleatorio;
  let fallo = false;
  if (arma.fiabilidad < 1) {
    const paso = siguienteAleatorio(aleatorio);
    aleatorio = paso.estado;
    fallo = paso.valor >= arma.fiabilidad;
  }

  // armas-nuevas (arm-5): dispersión angular, un segundo giro del MISMO
  // EstadoAleatorio hilvanado -- nunca el azar no determinista del lenguaje
  // (nucleo-4, scripts/comprobar-sin-math-random.mjs). Sin dispersionGrados
  // (o en 0) no se consume tirada, para no desplazar el estado que ya
  // asumen los tests de armas sin este eje.
  let anguloEfectivoGrados = params.anguloGrados;
  if (arma.dispersionGrados) {
    const paso = siguienteAleatorio(aleatorio);
    aleatorio = paso.estado;
    anguloEfectivoGrados += (paso.valor * 2 - 1) * arma.dispersionGrados;
  }

  // potencia-dispersion (pot-1): universal, de cualquier arma -- se suma
  // ENCIMA de la dispersionGrados propia del arma, nunca la sustituye.
  // Mismo patrón de giro hilvanado que fiabilidad y dispersionGrados arriba:
  // nunca azar sin hilvanar (nucleo-4, scripts/comprobar-sin-math-random.mjs).
  const amplitudPotenciaGrados = params.incluirDispersionPotencia ? dispersionPorPotenciaGrados(params.potencia) : 0;
  if (amplitudPotenciaGrados > 0) {
    const paso = siguienteAleatorio(aleatorio);
    aleatorio = paso.estado;
    anguloEfectivoGrados += (paso.valor * 2 - 1) * amplitudPotenciaGrados;
  }

  const origenY = params.origenY ?? alturaSuperficie(mascara, params.origenX) ?? params.alto - 1;
  const rad = (anguloEfectivoGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(params.potencia);
  const inicial = crearProyectil(params.origenX, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));

  // impacto-naves: un rastreador NUEVO por disparo -- su gracia de casco
  // propio es estado de ESTE vuelo, nunca compartido entre disparos ni
  // reutilizado entre turnos. Solo las naves VIVAS son cuerpo de colisión
  // (imp-1); el llamante filtra las muertas antes de pasar `params.naves`.
  const rastreadorNaves =
    params.naves && params.tiradorId !== undefined ? crearRastreadorImpactoNaves(params.naves, params.tiradorId) : undefined;

  const {
    puntos: puntosDeImpacto,
    perdido: proyectilPerdido,
    salida,
    puntosPenetrados,
    roce,
    aleatorio: aleatorioTrasVuelo,
    pasos: pasosVuelo,
  } = resolverPuntosDeImpacto(
    arma,
    inicial,
    params.gravedad,
    params.deriva,
    mascara,
    params.ancho,
    params.alto,
    aleatorio,
    params.planetas,
    rastreadorNaves,
  );

  // minirobot: el vuelo acaba en un planeta y ahí se queda; ni cráter ni daño
  // hasta que avanzar() lo haga detonar en un turno posterior. Si ha tocado un
  // casco, en cambio, detona al instante como cualquier otra arma.
  const robotPosado =
    arma.comportamiento.tipo === "minirobot" && puntosDeImpacto.length > 0 && puntosDeImpacto[0].impactoNave === undefined;

  if (fallo || proyectilPerdido || robotPosado) {
    const danioPorPunto = puntosDeImpacto.map(() => 0);
    return {
      mascara,
      aleatorio: aleatorioTrasVuelo,
      fallo,
      danioObjetivo: 0,
      danioPorPunto,
      danioPropio: 0,
      impactoPropio: null,
      desplazamientoObjetivoPx: 0,
      puntosDeImpacto,
      origenY,
      proyectilPerdido,
      salida: salida ?? null,
      roce: roce ?? null,
      pasosVuelo,
    };
  }

  for (const punto of puntosDeImpacto) {
    aplicarHuellaDeArma(mascara, arma, punto);
  }

  // armas-nuevas (arm-3): el túnel de la Barrena -- cada punto que atravesó
  // sólido de camino, excavado con el mismo radio y signo que su cráter
  // final. Solo definido para huella "circular"; ningún arma con
  // penetracionPx del catálogo declara otra cosa.
  if (puntosPenetrados && puntosPenetrados.length > 0 && arma.huella.tipo === "circular") {
    for (const punto of puntosPenetrados) {
      aplicarHuellaCircular(mascara, punto.x, punto.y, arma.huella.radio, arma.huella.signo);
    }
  }

  let danioPorPunto: number[] = puntosDeImpacto.map(() => 0);
  let danioPropio = 0;
  let impactoPropio: ResultadoDisparo["impactoPropio"] = null;
  let desplazamientoObjetivoPx = 0;

  const efecto = arma.efecto;
  if (efecto.tipo === "danio" || efecto.tipo === "danio-y-autodanio") {
    // imp-3: distancia EUCLÍDEA 2D al punto de detonación -- nunca solo en
    // X, que es como se medía antes de este bloque (herencia del suelo
    // plano, donde toda nave estaba a la misma altura y la X ya bastaba).
    const radioEfecto = radioEfectoEnMundo(arma, params.ancho, params.alto);
    const objetivoId = params.objetivoId ?? params.naves?.find((nave) => nave.x === params.objetivoX && nave.y === params.objetivoY)?.id;
    danioPorPunto = puntosDeImpacto.map((punto) =>
      danioPorDistancia(
        radioEfecto,
        efecto.danioMaximo,
        objetivoId !== undefined
          ? distanciaDeDanio(punto.x, punto.y, { id: objetivoId, x: params.objetivoX, y: params.objetivoY }, radioEfecto)
          : Math.hypot(punto.x - params.objetivoX, punto.y - params.objetivoY),
      ),
    );
    if (efecto.tipo === "danio-y-autodanio") {
      danioPropio = efecto.autoDanioMaximo;
      aplicarHuellaCircular(mascara, params.origenX, origenY, efecto.radioAutoHuellaPx, "restar");
    }

    // imp-5: autoimpacto por gravedad -- SEPARADO de danioPropio (Despedida,
    // garantizado por catálogo en cada disparo). Solo ocurre cuando el
    // rastreador ha detenido el vuelo de verdad sobre el propio casco.
    // cat-4: la onda del gancho nunca daña a quien dispara.
    const puntoAutoimpacto =
      arma.ondaFraccionDiagonal !== undefined ? undefined : puntosDeImpacto.find((punto) => punto.impactoNave === params.tiradorId);
    if (puntoAutoimpacto) {
      const danio = danioPorDistancia(
        efecto.radioEfectoPx,
        efecto.danioMaximo,
        Math.hypot(puntoAutoimpacto.x - params.origenX, puntoAutoimpacto.y - origenY),
      );
      if (danio > 0) {
        impactoPropio = { danio, x: puntoAutoimpacto.x, y: puntoAutoimpacto.y };
      }
    }
  } else if (efecto.tipo === "empuje") {
    const puntoRelevante = puntosDeImpacto[0];
    const direccion = Math.sign(params.objetivoX - puntoRelevante.x) || 1;
    desplazamientoObjetivoPx = direccion * efecto.desplazamientoPx;
  }

  const danioObjetivo = danioPorPunto.reduce((total, danio) => total + danio, 0);

  return {
    mascara,
    aleatorio: aleatorioTrasVuelo,
    fallo,
    danioObjetivo,
    danioPorPunto,
    danioPropio,
    impactoPropio,
    desplazamientoObjetivoPx,
    puntosDeImpacto,
    origenY,
    proyectilPerdido,
    salida: salida ?? null,
    roce: roce ?? null,
    pasosVuelo,
  };
}
