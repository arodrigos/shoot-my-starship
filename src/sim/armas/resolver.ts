import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import type { Arma } from "@/sim/armas/tipos";
import { resolverCaida } from "@/sim/terreno/caida";
import { esSolido, type Mascara } from "@/sim/terreno/mascara";
import { aplicarHuellaCapsula, aplicarHuellaCircular } from "@/sim/terreno/huella";

export interface PuntoDeImpacto {
  readonly x: number;
  readonly y: number;
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
  // Positivo = hacia +x. Solo lo produce el Gravitón (efecto "empuje").
  readonly desplazamientoObjetivoPx: number;
  readonly puntosDeImpacto: readonly PuntoDeImpacto[];
  // Altura de la superficie bajo el tirador en el momento del disparo: la
  // necesita avanzar() para situar el evento de autodaño de Despedida, que
  // no tiene su propio punto de impacto (la huella se aplica en el origen).
  readonly origenY: number;
}

function clonarMascara(mascara: Mascara): Mascara {
  return { ancho: mascara.ancho, alto: mascara.alto, datos: new Uint8Array(mascara.datos) };
}

function alturaSuperficie(mascara: Mascara, x: number): number | null {
  const columna = Math.round(Math.min(mascara.ancho - 1, Math.max(0, x)));
  const resultado = resolverCaida(mascara, columna);
  return resultado.tipo === "reposo" ? resultado.y : null;
}

function detenerseEnSuelo(mascara: Mascara, ancho: number, alto: number) {
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
function resolverSubmuniciones(
  inicial: EstadoProyectil,
  gravedad: number,
  deriva: number,
  mascara: Mascara,
  ancho: number,
  alto: number,
  cantidad: number,
  dispersionPxS: number,
): PuntoDeImpacto[] {
  const detenerse = detenerseEnSuelo(mascara, ancho, alto);
  const { proyectil: apice, pasos } = simularVuelo(inicial, gravedad, deriva, (p) => p.vy >= 0 || detenerse(p));

  if (pasos === 0 || detenerse(apice)) {
    // El disparo tocó tierra antes de alcanzar el ápice (ángulo casi
    // horizontal apuntando cuesta abajo): no hay altura para repartir, así
    // que se resuelve como un impacto único en vez de partir en el vacío.
    return [{ x: apice.x, y: apice.y }];
  }

  const puntos: PuntoDeImpacto[] = [];
  for (let i = 0; i < cantidad; i++) {
    const offset = (i - (cantidad - 1) / 2) * (dispersionPxS / Math.max(1, cantidad - 1));
    const subInicial: EstadoProyectil = { x: apice.x, y: apice.y, vx: apice.vx + offset, vy: apice.vy };
    const { proyectil } = simularVuelo(subInicial, gravedad, deriva, detenerse);
    puntos.push({ x: proyectil.x, y: proyectil.y });
  }
  return puntos;
}

function resolverPuntosDeImpacto(
  arma: Arma,
  inicial: EstadoProyectil,
  gravedad: number,
  deriva: number,
  mascara: Mascara,
  ancho: number,
  alto: number,
): PuntoDeImpacto[] {
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
    );
  }

  const { proyectil } = simularVuelo(inicial, gravedad, deriva, detenerse);

  if (arma.comportamiento.tipo === "rodante") {
    const punto = resolverRodadura(mascara, proyectil.x, arma.comportamiento.distanciaMaximaPx, arma.comportamiento.pasoPx);
    return [punto];
  }

  return [{ x: proyectil.x, y: proyectil.y }];
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
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly objetivoX: number;
  readonly ancho: number;
  readonly alto: number;
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

  const origenY = alturaSuperficie(mascara, params.origenX) ?? params.alto - 1;
  const alturaCanon = 26;
  const rad = (params.anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(params.potencia);
  const inicial = crearProyectil(params.origenX, origenY - alturaCanon, v * Math.cos(rad), -v * Math.sin(rad));

  const puntosDeImpacto = resolverPuntosDeImpacto(
    arma,
    inicial,
    params.gravedad,
    params.deriva,
    mascara,
    params.ancho,
    params.alto,
  );

  if (fallo) {
    const danioPorPunto = puntosDeImpacto.map(() => 0);
    return {
      mascara,
      aleatorio,
      fallo,
      danioObjetivo: 0,
      danioPorPunto,
      danioPropio: 0,
      desplazamientoObjetivoPx: 0,
      puntosDeImpacto,
      origenY,
    };
  }

  for (const punto of puntosDeImpacto) {
    aplicarHuellaDeArma(mascara, arma, punto);
  }

  let danioPorPunto: number[] = puntosDeImpacto.map(() => 0);
  let danioPropio = 0;
  let desplazamientoObjetivoPx = 0;

  const efecto = arma.efecto;
  if (efecto.tipo === "danio" || efecto.tipo === "danio-y-autodanio") {
    danioPorPunto = puntosDeImpacto.map((punto) =>
      danioPorDistancia(efecto.radioEfectoPx, efecto.danioMaximo, Math.abs(punto.x - params.objetivoX)),
    );
    if (efecto.tipo === "danio-y-autodanio") {
      danioPropio = efecto.autoDanioMaximo;
      aplicarHuellaCircular(mascara, params.origenX, origenY, efecto.radioAutoHuellaPx, "restar");
    }
  } else if (efecto.tipo === "empuje") {
    const puntoRelevante = puntosDeImpacto[0];
    const direccion = Math.sign(params.objetivoX - puntoRelevante.x) || 1;
    desplazamientoObjetivoPx = direccion * efecto.desplazamientoPx;
  }

  const danioObjetivo = danioPorPunto.reduce((total, danio) => total + danio, 0);

  return { mascara, aleatorio, fallo, danioObjetivo, danioPorPunto, danioPropio, desplazamientoObjetivoPx, puntosDeImpacto, origenY };
}
