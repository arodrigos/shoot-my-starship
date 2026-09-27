import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import type { Arma } from "@/sim/armas/tipos";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { resolverCaida } from "@/sim/terreno/caida";
import { esSolido, type Mascara } from "@/sim/terreno/mascara";
import { aplicarHuellaCapsula, aplicarHuellaCircular } from "@/sim/terreno/huella";
import { crearRastreadorImpactoNaves, type NavePosicion, type RastreadorImpactoNaves } from "@/sim/naves/impacto";
import type { IdNave } from "@/sim/partida/tipos";

export interface PuntoDeImpacto {
  readonly x: number;
  readonly y: number;
  // impacto-naves (imp-1): la nave cuyo casco ha detenido el vuelo en este
  // punto exacto, si alguna -- undefined cuando el punto es una detonación
  // normal contra sólido, fuera de mundo o ápice de submuniciones.
  readonly impactoNave?: IdNave;
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
export function detenerseEnSuelo(mascara: Mascara, ancho: number, alto: number) {
  return (p: EstadoProyectil): boolean => {
    if (p.y >= alto || p.x < 0 || p.x >= ancho) {
      return true;
    }
    return esSolido(mascara, Math.round(p.x), Math.round(p.y));
  };
}

// La Pelota de Chatarra (comportamiento "rodante"): tras el primer contacto,
// camina columna a columna hacia el lado más bajo hasta distanciaMaximaPx o
// hasta encontrar un hueco (una caída brusca -- un cráter ya existente, o el
// final del soporte), que es donde detona. Es terreno, no física de
// proyectil, así que no reutiliza integrarPasoProyectil: es un recorrido
// discreto sobre la máscara.
function resolverRodadura(mascara: Mascara, xInicial: number, distanciaMaximaPx: number, pasoPx: number): PuntoDeImpacto {
  const alturaEn = (x: number): number => alturaSuperficie(mascara, x) ?? Number.POSITIVE_INFINITY;
  const yInicial = alturaEn(xInicial);
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
): ResultadoPuntosDeImpacto {
  const detenerse = detenerseEnSuelo(mascara, ancho, alto);
  const {
    proyectil: apice,
    pasos,
    perdido: apicePerdido,
    impactoNave: impactoNaveApice,
  } = simularVuelo(inicial, gravedad, deriva, (p) => p.vy >= 0 || detenerse(p), { planetas, rastreadorNaves });

  // grav-6: el propio ápice se ha perdido en órbita antes de cruzar vy>=0 --
  // no hay desde dónde repartir submuniciones.
  if (apicePerdido) {
    return { puntos: [], perdido: true };
  }

  // impacto-naves: un casco cortado de camino al ápice detona ahí mismo --
  // el casco siempre gana, nunca se reparte en submuniciones a partir de un
  // punto que ya era un impacto.
  if (pasos === 0 || detenerse(apice) || impactoNaveApice) {
    // El disparo tocó tierra (o una nave) antes de alcanzar el ápice (ángulo
    // casi horizontal apuntando cuesta abajo): no hay altura para repartir,
    // así que se resuelve como un impacto único en vez de partir en el vacío.
    return { puntos: [{ x: apice.x, y: apice.y, impactoNave: impactoNaveApice?.nave }], perdido: false };
  }

  const puntos: PuntoDeImpacto[] = [];
  for (let i = 0; i < cantidad; i++) {
    const offset = (i - (cantidad - 1) / 2) * (dispersionPxS / Math.max(1, cantidad - 1));
    const subInicial: EstadoProyectil = { x: apice.x, y: apice.y, vx: apice.vx + offset, vy: apice.vy };
    const { proyectil, perdido, impactoNave } = simularVuelo(subInicial, gravedad, deriva, detenerse, { planetas, rastreadorNaves });
    // Una submunición individual perdida en órbita simplemente no aporta
    // punto de impacto -- el resto de la andanada, si aterriza, sigue
    // contando (grav-6 no exige que TODAS se pierdan para declarar el
    // disparo entero perdido).
    if (!perdido) {
      puntos.push({ x: proyectil.x, y: proyectil.y, impactoNave: impactoNave?.nave });
    }
  }
  return { puntos, perdido: puntos.length === 0 };
}

function resolverPuntosDeImpacto(
  arma: Arma,
  inicial: EstadoProyectil,
  gravedad: number,
  deriva: number,
  mascara: Mascara,
  ancho: number,
  alto: number,
  planetas?: RegistroPlanetas,
  rastreadorNaves?: RastreadorImpactoNaves,
): ResultadoPuntosDeImpacto {
  const detenerse = detenerseEnSuelo(mascara, ancho, alto);

  if (arma.comportamiento.tipo === "submuniciones") {
    return resolverSubmuniciones(
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
  }

  const { proyectil, perdido, impactoNave } = simularVuelo(inicial, gravedad, deriva, detenerse, { planetas, rastreadorNaves });
  if (perdido) {
    return { puntos: [], perdido: true };
  }

  // impacto-naves: la rodadura es terreno, no física de proyectil -- un
  // casco impactado detona ahí mismo y nunca rueda (el corolario del diseño:
  // "la penetración atraviesa sólido pero nunca un casco, que siempre
  // detona" aplica igual de fuerte a la rodadura).
  if (arma.comportamiento.tipo === "rodante" && !impactoNave) {
    const punto = resolverRodadura(mascara, proyectil.x, arma.comportamiento.distanciaMaximaPx, arma.comportamiento.pasoPx);
    return { puntos: [punto], perdido: false };
  }

  return { puntos: [{ x: proyectil.x, y: proyectil.y, impactoNave: impactoNave?.nave }], perdido: false };
}

function aplicarHuellaDeArma(mascara: Mascara, arma: Arma, punto: PuntoDeImpacto): void {
  if (arma.huella.tipo === "circular") {
    aplicarHuellaCircular(mascara, punto.x, punto.y, arma.huella.radio, arma.huella.signo);
  } else if (arma.huella.tipo === "capsula") {
    aplicarHuellaCapsula(mascara, punto.x, punto.y, arma.huella.medioLargoPx, arma.huella.radio, arma.huella.signo);
  }
  // "ninguna": el Gravitón no toca la máscara.
}

function danioPorDistancia(radioEfectoPx: number, danioMaximo: number, distancia: number): number {
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
  readonly ancho: number;
  readonly alto: number;
  readonly planetas?: RegistroPlanetas;
  // impacto-naves: opcionales y aditivos -- sin ellos (todo llamante de
  // antes de este bloque), ninguna nave detiene el vuelo, exactamente el
  // comportamiento de siempre. Con ambos, el vuelo se detiene en el primer
  // casco vivo que corta, incluido el propio (tras su gracia).
  readonly naves?: readonly NavePosicion[];
  readonly tiradorId?: IdNave;
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

  const origenY = params.origenY ?? alturaSuperficie(mascara, params.origenX) ?? params.alto - 1;
  const rad = (params.anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(params.potencia);
  const inicial = crearProyectil(params.origenX, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));

  // impacto-naves: un rastreador NUEVO por disparo -- su gracia de casco
  // propio es estado de ESTE vuelo, nunca compartido entre disparos ni
  // reutilizado entre turnos. Solo las naves VIVAS son cuerpo de colisión
  // (imp-1); el llamante filtra las muertas antes de pasar `params.naves`.
  const rastreadorNaves =
    params.naves && params.tiradorId !== undefined ? crearRastreadorImpactoNaves(params.naves, params.tiradorId) : undefined;

  const { puntos: puntosDeImpacto, perdido: proyectilPerdido } = resolverPuntosDeImpacto(
    arma,
    inicial,
    params.gravedad,
    params.deriva,
    mascara,
    params.ancho,
    params.alto,
    params.planetas,
    rastreadorNaves,
  );

  if (fallo || proyectilPerdido) {
    const danioPorPunto = puntosDeImpacto.map(() => 0);
    return {
      mascara,
      aleatorio,
      fallo,
      danioObjetivo: 0,
      danioPorPunto,
      danioPropio: 0,
      impactoPropio: null,
      desplazamientoObjetivoPx: 0,
      puntosDeImpacto,
      origenY,
      proyectilPerdido,
    };
  }

  for (const punto of puntosDeImpacto) {
    aplicarHuellaDeArma(mascara, arma, punto);
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
    danioPorPunto = puntosDeImpacto.map((punto) =>
      danioPorDistancia(efecto.radioEfectoPx, efecto.danioMaximo, Math.hypot(punto.x - params.objetivoX, punto.y - params.objetivoY)),
    );
    if (efecto.tipo === "danio-y-autodanio") {
      danioPropio = efecto.autoDanioMaximo;
      aplicarHuellaCircular(mascara, params.origenX, origenY, efecto.radioAutoHuellaPx, "restar");
    }

    // imp-5: autoimpacto por gravedad -- SEPARADO de danioPropio (Despedida,
    // garantizado por catálogo en cada disparo). Solo ocurre cuando el
    // rastreador ha detenido el vuelo de verdad sobre el propio casco.
    const puntoAutoimpacto = puntosDeImpacto.find((punto) => punto.impactoNave === params.tiradorId);
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
    aleatorio,
    fallo,
    danioObjetivo,
    danioPorPunto,
    danioPropio,
    impactoPropio,
    desplazamientoObjetivoPx,
    puntosDeImpacto,
    origenY,
    proyectilPerdido,
  };
}
