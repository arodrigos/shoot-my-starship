import { buscarArma } from "@/sim/armas/catalogo";
import { radioEfectoEnMundo } from "@/sim/armas/radioEfecto";
import { aplicarHuellaDeArma, alturaSuperficie, danioPorDistancia } from "@/sim/armas/resolver";
import { octavoDelMundo } from "@/sim/naves/desplazamiento";
import type { Detonacion } from "@/sim/partida/detonaciones";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import type { EstadoNave, IdNave, ParametrosMundo } from "@/sim/partida/tipos";
import type { Planeta, RegistroPlanetas } from "@/sim/gravedad/planetas";
import { AIRE, ESCOMBRO, esMaterialPlaneta, esSolido, obtenerMaterial, type Mascara } from "@/sim/terreno/mascara";

export const MAX_SALTOS_ROBOT = 4;

// Cota de las búsquedas de superficie: el radio del planeta más un respiro,
// para que ningún bucle dependa de que la máscara tenga el aspecto esperado.
const RESPIRO_PLANETA_U = 8;
const PASO_BUSQUEDA_U = 1;
const TOPE_PASOS_POSADO = 6;
const RADIO_BUSQUEDA_CONTACTO_U = 4;

// Serializable de punta a punta (rob-3): solo números y cadenas.
export interface EstadoRobot {
  readonly dueno: IdNave;
  readonly objetivoId: IdNave;
  readonly armaId: string;
  readonly planetaId: number;
  readonly x: number;
  readonly y: number;
  readonly saltos: number;
}

interface Punto {
  readonly x: number;
  readonly y: number;
}

function posicionNave(nave: EstadoNave, mascara: Mascara, mundo: ParametrosMundo): Punto {
  return { x: nave.x, y: nave.y ?? alturaSuperficie(mascara, nave.x) ?? mundo.alto - 1 };
}

function distancia(a: Punto, b: Punto): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Planeta al que pertenece el sólido junto al punto de contacto: el material
// del píxel dice de quién es, y se mira un entorno corto porque el vuelo se
// detiene en el último paso antes de la roca.
function planetaDeContacto(mascara: Mascara, punto: Punto, planetas: RegistroPlanetas): Planeta | undefined {
  const cx = Math.round(punto.x);
  const cy = Math.round(punto.y);
  for (let radio = 0; radio <= RADIO_BUSQUEDA_CONTACTO_U; radio += 1) {
    for (let dy = -radio; dy <= radio; dy += 1) {
      for (let dx = -radio; dx <= radio; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radio) continue;
        const material = obtenerMaterial(mascara, cx + dx, cy + dy);
        if (material === AIRE || material === ESCOMBRO || !esMaterialPlaneta(material)) continue;
        const planeta = planetas.find((candidato) => candidato.id === material);
        if (planeta) return planeta;
      }
    }
  }
  return undefined;
}

// Punto de reposo: aire pegado a la superficie, nunca dentro de la roca. Se
// desplaza desde el contacto a lo largo del radio del planeta: hacia fuera si
// cayó dentro de roca, hacia dentro (hasta TOPE_PASOS_POSADO) si quedó en el
// aire.
export function posarEnSuperficie(mascara: Mascara, contacto: Punto, planeta: Planeta): Punto {
  const dx = contacto.x - planeta.cx;
  const dy = contacto.y - planeta.cy;
  const largo = Math.hypot(dx, dy) || 1;
  const ux = dx / largo;
  const uy = dy / largo;
  const en = (paso: number): Punto => ({ x: contacto.x + ux * paso, y: contacto.y + uy * paso });
  const solidoEn = (p: Punto): boolean => esSolido(mascara, Math.round(p.x), Math.round(p.y));
  let paso = 0;
  if (solidoEn(en(0))) {
    while (solidoEn(en(paso)) && paso < planeta.radio + RESPIRO_PLANETA_U) paso += PASO_BUSQUEDA_U;
    return en(paso);
  }
  while (paso > -TOPE_PASOS_POSADO && !solidoEn(en(paso - PASO_BUSQUEDA_U))) paso -= PASO_BUSQUEDA_U;
  return en(paso);
}

// El proyectil acaba de aterrizar en `contacto`. undefined si no hay ningún
// planeta al que agarrarse: el robot se pierde sin efecto.
export function crearRobot(params: {
  readonly dueno: IdNave;
  readonly objetivoId: IdNave;
  readonly armaId: string;
  readonly contacto: Punto;
  readonly mascara: Mascara;
  readonly planetas: RegistroPlanetas | undefined;
}): EstadoRobot | undefined {
  if (!params.planetas) return undefined;
  const planeta = planetaDeContacto(params.mascara, params.contacto, params.planetas);
  if (!planeta) return undefined;
  const reposo = posarEnSuperficie(params.mascara, params.contacto, planeta);
  return { dueno: params.dueno, objetivoId: params.objetivoId, armaId: params.armaId, planetaId: planeta.id, x: reposo.x, y: reposo.y, saltos: 0 };
}

// Punto de reposo de un planeta mirando al objetivo: el primer sólido propio
// que encuentra un rayo desde fuera hacia el centro siguiendo la dirección
// centro->objetivo. undefined si ya no le queda roca en ese radio.
function reposoMirandoAl(planeta: Planeta, objetivo: Punto, mascara: Mascara): Punto | undefined {
  const dx = objetivo.x - planeta.cx;
  const dy = objetivo.y - planeta.cy;
  const largo = Math.hypot(dx, dy) || 1;
  const ux = dx / largo;
  const uy = dy / largo;
  for (let d = planeta.radio + RESPIRO_PLANETA_U; d >= 0; d -= PASO_BUSQUEDA_U) {
    if (obtenerMaterial(mascara, Math.round(planeta.cx + ux * d), Math.round(planeta.cy + uy * d)) === planeta.id) {
      const fuera = d + PASO_BUSQUEDA_U;
      return { x: planeta.cx + ux * fuera, y: planeta.cy + uy * fuera };
    }
  }
  return undefined;
}

// Destino del próximo salto: entre los planetas más cerca del objetivo que el
// actual, el más cercano al robot (el empate, por id, para ser determinista).
// Además se exige que el punto de reposo baje la distancia al casco: así «la
// distancia baja estrictamente» es una propiedad de cada salto.
export function elegirSalto(
  robot: EstadoRobot,
  objetivo: Punto,
  planetas: RegistroPlanetas,
  mascara: Mascara,
): { readonly planeta: Planeta; readonly reposo: Punto } | undefined {
  const actual = planetas.find((planeta) => planeta.id === robot.planetaId);
  const distanciaActual = actual ? distancia({ x: actual.cx, y: actual.cy }, objetivo) : Infinity;
  const distanciaRobot = distancia(robot, objetivo);
  let mejor: { planeta: Planeta; reposo: Punto; dRobot: number } | undefined;
  for (const planeta of planetas) {
    if (planeta.id === robot.planetaId) continue;
    if (distancia({ x: planeta.cx, y: planeta.cy }, objetivo) >= distanciaActual) continue;
    const reposo = reposoMirandoAl(planeta, objetivo, mascara);
    if (!reposo || distancia(reposo, objetivo) >= distanciaRobot) continue;
    const dRobot = distancia(reposo, robot);
    if (!mejor || dRobot < mejor.dRobot || (dRobot === mejor.dRobot && planeta.id < mejor.planeta.id)) {
      mejor = { planeta, reposo, dRobot };
    }
  }
  return mejor;
}

export interface ResultadoFaseRobots {
  readonly robots: readonly EstadoRobot[];
  readonly mascara: Mascara;
  readonly danios: ReadonlyMap<IdNave, number>;
  readonly detonaciones: Detonacion[];
  readonly eventos: EventoSimulacion[];
}

// Fase de robots al empezar el turno de `turno`: solo se mueven los de su
// dueño, sin gastarle el turno. Los robots de un dueño muerto desaparecen; si
// el objetivo murió, el robot elige al rival vivo más cercano a él.
export function faseDeRobots(params: {
  readonly robots: readonly EstadoRobot[];
  readonly turno: IdNave;
  readonly naves: readonly EstadoNave[];
  readonly mascara: Mascara;
  readonly mundo: ParametrosMundo;
  readonly planetas: RegistroPlanetas | undefined;
}): ResultadoFaseRobots {
  const { naves, mundo, planetas } = params;
  const viva = (id: IdNave): boolean => naves[id] !== undefined && naves[id].integridad > 0;
  let mascara = params.mascara;
  const eventos: EventoSimulacion[] = [];
  const detonaciones: Detonacion[] = [];
  const danios = new Map<IdNave, number>();
  const restantes: EstadoRobot[] = [];

  for (const robot of params.robots) {
    if (!viva(robot.dueno)) continue;
    if (robot.dueno !== params.turno) {
      restantes.push(robot);
      continue;
    }
    let objetivoId = robot.objetivoId;
    if (!viva(objetivoId) || objetivoId === robot.dueno) {
      const rivales = naves.flatMap((_nave, id) => (id !== robot.dueno && viva(id) ? [id] : []));
      if (rivales.length === 0) continue;
      objetivoId = rivales.reduce((cercano, id) =>
        distancia(robot, posicionNave(naves[id], mascara, mundo)) < distancia(robot, posicionNave(naves[cercano], mascara, mundo)) ? id : cercano,
      );
    }
    const objetivo = posicionNave(naves[objetivoId], mascara, mundo);
    const puedeSaltar = robot.saltos < MAX_SALTOS_ROBOT && distancia(robot, objetivo) > octavoDelMundo(mundo) && planetas !== undefined;
    const salto = puedeSaltar ? elegirSalto(robot, objetivo, planetas, mascara) : undefined;
    if (salto) {
      const siguiente: EstadoRobot = { ...robot, objetivoId, planetaId: salto.planeta.id, x: salto.reposo.x, y: salto.reposo.y, saltos: robot.saltos + 1 };
      restantes.push(siguiente);
      eventos.push({ tipo: "robot-salta", nave: robot.dueno, desdeX: robot.x, desdeY: robot.y, x: siguiente.x, y: siguiente.y, saltos: siguiente.saltos });
      continue;
    }

    // Detona sobre el casco del objetivo: es lo que significa «saltar encima».
    const arma = buscarArma(robot.armaId);
    const radio = radioEfectoEnMundo(arma, mundo.ancho, mundo.alto);
    const danioMaximo = arma.efecto.tipo === "danio" ? arma.efecto.danioMaximo : 0;
    let danioAlObjetivo = 0;
    naves.forEach((nave, id) => {
      if (!viva(id)) return;
      const danio = danioPorDistancia(radio, danioMaximo, distancia(objetivo, posicionNave(nave, mascara, mundo)));
      if (danio > 0) danios.set(id, (danios.get(id) ?? 0) + danio);
      if (id === objetivoId) danioAlObjetivo = danio;
    });
    const clon: Mascara = { ancho: mascara.ancho, alto: mascara.alto, datos: Uint8Array.from(mascara.datos) };
    aplicarHuellaDeArma(clon, arma, objetivo);
    mascara = clon;
    detonaciones.push({ x: objetivo.x, y: objetivo.y, armaId: arma.id, radioEfectoU: radio, danioAplicado: danioAlObjetivo, sobre: danioAlObjetivo > 0 ? "nave" : "vacio" });
    eventos.push({ tipo: "robot-detona", nave: robot.dueno, objetivo: objetivoId, x: objetivo.x, y: objetivo.y, danio: danioAlObjetivo });
  }
  return { robots: restantes, mascara, danios, detonaciones, eventos };
}
