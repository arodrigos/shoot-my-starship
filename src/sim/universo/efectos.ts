import { crearEstadoAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { masaPlaneta, recalcularRegistro, type Planeta } from "@/sim/gravedad/planetas";
import { octavoDelMundo } from "@/sim/naves/desplazamiento";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";
import { esPosicionValida, type PuntoNave } from "@/sim/naves/zonaValida";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import { idsNavesVivas, type EstadoNave, type EstadoPartida, type IdNave } from "@/sim/partida/tipos";
import { PREMIO_LOTERIA } from "@/sim/economia/parametros";
import type { Mascara } from "@/sim/terreno/mascara";
import { buscarEvento } from "@/sim/universo/catalogoEventos";
import { programarSiguiente, sortearEvento, sortearIndice, type ContextoSorteo } from "@/sim/universo/calendario";
import { crearObjeto, MAX_OBJETOS_VIVOS } from "@/sim/universo/objetos";
import { sortearEventoGratis } from "@/sim/universo/disparoGratis";
import type { EfectoActivo, EstadoUniverso, EventoProgramado, FasePartida, TipoEfecto } from "@/sim/universo/tipos";

export const TURNOS_EFECTO_NAVE = 3;
export const FACTOR_VITAMINAS = 2;
export const FACTOR_VIRUS = 0.5;
export const FRACCION_REPARACION = 0.5;
// Aceleración que el viento solar suma a mundo.deriva (los mapas de suelo plano
// van de -18 a 26); el signo se sortea.
export const DERIVA_VIENTO_SOLAR = 20;
const MAX_CANDIDATOS_TERREMOTO = 64;
// Id fuera del rango de materiales de planeta de la máscara (1..12): el pozo no
// tiene píxeles, así que ningún contador ni reparación puede confundirlo con uno.
export const ID_AGUJERO_NEGRO = 200;
// Radio de suavizado (eps de Aarseth) del pozo: pequeño, para que sea un tirón
// concentrado y no un planeta más; no colisiona con nada porque no está en la máscara.
export const RADIO_AGUJERO_NEGRO = 30;
// Su masa es la de un planeta típico del sistema: lo bastante para torcer un tiro
// que pase cerca, sin convertir la partida en un sumidero.
const FACTOR_MASA_AGUJERO_NEGRO = 1;
const MAX_CANDIDATOS_AGUJERO_NEGRO = 32;
const SEPARACION_AGUJERO_NEGRO_U = 90;

type EstadoSinUniverso = Omit<EstadoPartida, "universo">;

// El universo solo existe si alguien lo activa: las partidas de simulación
// masiva (ia-*, armas-*) siguen idénticas bit a bit sin eventos.
export function conUniverso(estado: EstadoPartida): EstadoPartida {
  const aleatorio = crearEstadoAleatorio((estado.aleatorio.semilla ^ 0x9e3779b9) >>> 0);
  const sorteo = programarSiguiente(aleatorio, contextoDe(estado));
  const universo: EstadoUniverso = {
    aleatorio: sorteo.aleatorio,
    proximo: sorteo.evento,
    efectos: [],
    mascaraInicial: { ...estado.mascara, datos: estado.mascara.datos.slice() },
  };
  return { ...estado, universo };
}

// Al empezar la muerte súbita los corazones vivos se disuelven y, si el próximo
// evento del calendario era curativo, se vuelve a sortear conservando su
// cuenta atrás: el pronóstico no puede anunciar una cura que ya no llegará.
export function entrarEnMuerteSubita(estado: EstadoPartida): { universo: EstadoUniverso | undefined } {
  const universo = estado.universo;
  if (universo === undefined) return { universo };
  const objetos = universo.objetos?.filter((objeto) => objeto.tipo !== "corazon");
  const curativo = buscarEvento(universo.proximo.tipo).curativo;
  const resorteo = curativo ? sortearEvento(universo.aleatorio, contextoDe({ ...estado, muerteSubita: true }), universo.proximo.enTurnos) : undefined;
  return {
    universo: {
      ...universo,
      ...(resorteo ? { aleatorio: resorteo.aleatorio, proximo: resorteo.evento } : {}),
      ...(objetos !== undefined ? { objetos } : {}),
    },
  };
}

export function faseDe(estado: EstadoPartida): FasePartida {
  return estado.muerteSubita === true ? "muerte-subita" : "normal";
}

function contextoDe(estado: EstadoSinUniverso & { muerteSubita?: boolean }): ContextoSorteo {
  return {
    modo: estado.modo,
    fase: estado.muerteSubita === true ? "muerte-subita" : "normal",
    vivas: idsNavesVivas(estado as EstadoPartida),
  };
}

// Multiplicador de daño de los efectos de la nave que dispara. Vitaminas y
// virus no se acumulan: uno nuevo sustituye al anterior (ver sustituirEfecto).
export function factorDanio(estado: EstadoPartida, nave: IdNave): number {
  const efecto = estado.universo?.efectos.find((candidato) => candidato.nave === nave);
  if (efecto?.tipo === "vitaminas") return FACTOR_VITAMINAS;
  if (efecto?.tipo === "virus") return FACTOR_VIRUS;
  return 1;
}

function sustituirEfecto(efectos: readonly EfectoActivo[], nuevo: EfectoActivo): EfectoActivo[] {
  return [...efectos.filter((efecto) => efecto.nave === undefined || efecto.nave !== nuevo.nave), nuevo];
}

// Los globales se aplican sobre el mismo estado que leen la previsualización y
// el vuelo (densidad de los planetas, gravedad y deriva del mundo): no existe un
// multiplicador «solo de vuelo» que pudiera hacer mentir al trazo.
function conGravedad(estado: EstadoPartida, factor: number): EstadoPartida {
  return {
    ...estado,
    mundo: { ...estado.mundo, gravedad: estado.mundo.gravedad * factor },
    // El agujero negro tiene masa explícita y no se escala: si lo hiciera, al
    // expirar la gravedad ×2 mientras él sigue vivo quedaría con la mitad.
    planetas: estado.planetas?.map((planeta) => (planeta.masaFija !== undefined ? planeta : { ...planeta, densidad: planeta.densidad * factor })),
  };
}

// Coloca el pozo con el azar del universo, lejos de las naves vivas y dentro del
// margen del mundo; si en 32 intentos no hay hueco, usa el último candidato.
function crearAgujeroNegro(estado: EstadoPartida, aleatorioInicial: EstadoAleatorio): { planeta: Planeta | null; aleatorio: EstadoAleatorio } {
  const planetas = estado.planetas;
  if (planetas === undefined || planetas.length === 0) return { planeta: null, aleatorio: aleatorioInicial };
  const masaMedia = planetas.filter((p) => p.masaFija === undefined).reduce((suma, p) => suma + masaPlaneta(p), 0) / Math.max(1, planetas.filter((p) => p.masaFija === undefined).length);
  const margen = RADIO_AGUJERO_NEGRO * 2;
  const vivas = estado.naves.filter((nave) => nave.integridad > 0 && nave.y !== undefined);
  let aleatorio = aleatorioInicial;
  let cx = estado.mundo.ancho / 2;
  let cy = estado.mundo.alto / 2;
  for (let candidato = 0; candidato < MAX_CANDIDATOS_AGUJERO_NEGRO; candidato++) {
    const px = sortearIndice(aleatorio, 1001);
    const py = sortearIndice(px.aleatorio, 1001);
    aleatorio = py.aleatorio;
    cx = margen + (px.indice / 1000) * (estado.mundo.ancho - 2 * margen);
    cy = margen + (py.indice / 1000) * (estado.mundo.alto - 2 * margen);
    if (vivas.every((nave) => Math.hypot(nave.x - cx, (nave.y as number) - cy) >= SEPARACION_AGUJERO_NEGRO_U)) break;
  }
  const planeta: Planeta = { id: ID_AGUJERO_NEGRO, cx, cy, radio: RADIO_AGUJERO_NEGRO, densidad: 1, pixelesVivos: 0, masaFija: masaMedia * FACTOR_MASA_AGUJERO_NEGRO };
  return { planeta, aleatorio };
}

function sinAgujeroNegro(estado: EstadoPartida): EstadoPartida {
  return { ...estado, planetas: estado.planetas?.filter((planeta) => planeta.id !== ID_AGUJERO_NEGRO) };
}

function conDeriva(estado: EstadoPartida, suma: number): EstadoPartida {
  return { ...estado, mundo: { ...estado.mundo, deriva: estado.mundo.deriva + suma } };
}

// Una ronda = tantos turnos como naves vivas hay al empezar el efecto.
function turnosDeRonda(estado: EstadoPartida): number {
  return idsNavesVivas(estado).length;
}

function terremoto(estado: EstadoPartida, aleatorioInicial: EstadoAleatorio): { naves: EstadoNave[]; aleatorio: EstadoAleatorio } {
  const octavo = octavoDelMundo(estado.mundo);
  const naves = [...estado.naves];
  let aleatorio = aleatorioInicial;
  naves.forEach((nave, id) => {
    if (nave.integridad <= 0 || nave.y === undefined) return;
    const otras: PuntoNave[] = naves.flatMap((otra, idOtra) => (idOtra !== id && otra.integridad > 0 && otra.y !== undefined ? [{ x: otra.x, y: otra.y }] : []));
    for (let candidato = 0; candidato < MAX_CANDIDATOS_TERREMOTO; candidato++) {
      const angulo = sortearIndice(aleatorio, 3600);
      const distancia = sortearIndice(angulo.aleatorio, 1001);
      aleatorio = distancia.aleatorio;
      const radio = octavo * (1 + distancia.indice / 1000);
      const radianes = (angulo.indice / 3600) * 2 * Math.PI;
      const punto = { x: nave.x + radio * Math.cos(radianes), y: (nave.y as number) + radio * Math.sin(radianes) };
      if (esPosicionValida(punto, estado.mundo, estado.mascara, otras)) {
        naves[id] = { ...nave, x: punto.x, y: punto.y };
        return;
      }
    }
  });
  return { naves, aleatorio };
}

// Devuelve a cada planeta la mitad de lo que le falta, de dentro afuera y sin
// pisar ningún casco vivo, y recalcula la masa.
function repararPlanetas(estado: EstadoPartida, inicial: Mascara): { mascara: Mascara; planetas: EstadoPartida["planetas"] } {
  const planetas = estado.planetas;
  if (planetas === undefined) return { mascara: estado.mascara, planetas };
  const datos = estado.mascara.datos.slice();
  const ancho = estado.mascara.ancho;
  const cascos = estado.naves.flatMap((nave) => (nave.integridad > 0 && nave.y !== undefined ? [{ x: nave.x, y: nave.y }] : []));
  for (const planeta of planetas) {
    const perdidos: { indice: number; distancia: number }[] = [];
    for (let indice = 0; indice < datos.length; indice++) {
      if (inicial.datos[indice] !== planeta.id || datos[indice] === planeta.id) continue;
      const x = indice % ancho;
      const y = Math.floor(indice / ancho);
      if (cascos.some((casco) => Math.hypot(casco.x - x, casco.y - y) <= RADIO_CASCO_NAVE_PX)) continue;
      perdidos.push({ indice, distancia: Math.hypot(x - planeta.cx, y - planeta.cy) });
    }
    perdidos.sort((a, b) => a.distancia - b.distancia || a.indice - b.indice);
    const cuantos = Math.floor(perdidos.length * FRACCION_REPARACION);
    for (let i = 0; i < cuantos; i++) datos[perdidos[i].indice] = planeta.id;
  }
  const mascara = { ...estado.mascara, datos };
  return { mascara, planetas: recalcularRegistro(planetas, mascara) };
}

// Aplica un evento ya sorteado. Si el afectado ha muerto entre el aviso y el
// disparo, el evento se anuncia como perdido en vez de caer sobre otra nave:
// el pronóstico no puede mentir.
export function aplicarEvento(
  estado: EstadoPartida,
  evento: EventoProgramado,
  origen: "calendario" | "arma-gratis",
): { estado: EstadoPartida; eventos: EventoSimulacion[] } {
  const universo = estado.universo as EstadoUniverso;
  const anuncio = { tipo: "evento-universo" as const, evento: evento.tipo, nave: evento.afectado, origen };
  if (estado.naves[evento.afectado].integridad <= 0) {
    return { estado, eventos: [{ ...anuncio, perdido: true }] };
  }
  // Red de seguridad de ms-3: nada curativo cae en muerte súbita, venga de donde venga.
  if (estado.muerteSubita === true && buscarEvento(evento.tipo).curativo) {
    return { estado, eventos: [{ ...anuncio, perdido: true }] };
  }
  if ((evento.tipo === "corazon" || evento.tipo === "tormenta") && (universo.objetos?.length ?? 0) >= MAX_OBJETOS_VIVOS) {
    // Ya hay dos flotando: el sorteo se queda sin efecto y se anuncia como perdido.
    return { estado, eventos: [{ ...anuncio, perdido: true }] };
  }
  let siguiente: EstadoPartida = estado;
  let efectos = universo.efectos;
  let objetos = universo.objetos;
  let contadorObjetos = universo.contadorObjetos;
  let aleatorio = universo.aleatorio;
  const duracionGlobal = turnosDeRonda(estado);
  switch (evento.tipo) {
    case "loteria": {
      const saldo = estado.saldos?.[evento.afectado];
      if (saldo !== undefined) {
        siguiente = { ...estado, saldos: estado.saldos?.map((valor, id) => (id === evento.afectado && valor !== undefined ? valor + PREMIO_LOTERIA : valor)) };
      }
      break;
    }
    case "vitaminas":
    case "virus":
      efectos = sustituirEfecto(efectos, { tipo: evento.tipo, nave: evento.afectado, turnosRestantes: TURNOS_EFECTO_NAVE });
      break;
    case "reparacion": {
      const reparado = repararPlanetas(estado, universo.mascaraInicial);
      siguiente = { ...estado, mascara: reparado.mascara, planetas: reparado.planetas };
      break;
    }
    case "terremoto": {
      const movido = terremoto(estado, aleatorio);
      siguiente = { ...estado, naves: movido.naves };
      aleatorio = movido.aleatorio;
      break;
    }
    case "gravedad-x2":
    case "gravedad-mitad": {
      // Un efecto de gravedad nuevo sustituye al anterior: primero se deshace
      // el viejo para que los factores no se multipliquen entre sí.
      efectos.filter((efecto) => efecto.tipo === "gravedad-x2" || efecto.tipo === "gravedad-mitad").forEach((previo) => {
        siguiente = deshacerEfecto(siguiente, previo);
      });
      siguiente = conGravedad(siguiente, evento.tipo === "gravedad-x2" ? 2 : 0.5);
      efectos = [...efectos.filter((efecto) => efecto.tipo !== "gravedad-x2" && efecto.tipo !== "gravedad-mitad"), { tipo: evento.tipo, turnosRestantes: duracionGlobal }];
      break;
    }
    case "viento-solar": {
      const signo = sortearIndice(aleatorio, 2);
      aleatorio = signo.aleatorio;
      const suma = signo.indice === 0 ? DERIVA_VIENTO_SOLAR : -DERIVA_VIENTO_SOLAR;
      const previos = efectos.filter((efecto) => efecto.tipo === "viento-solar");
      previos.forEach((previo) => {
        siguiente = conDeriva(siguiente, -(previo.derivaAnadida ?? 0));
      });
      siguiente = conDeriva(siguiente, suma);
      efectos = [...efectos.filter((efecto) => efecto.tipo !== "viento-solar"), { tipo: "viento-solar", turnosRestantes: duracionGlobal, derivaAnadida: suma }];
      break;
    }
    case "corazon":
    case "tormenta": {
      const nuevo = crearObjeto(estado, evento.tipo, evento.afectado, aleatorio);
      aleatorio = nuevo.aleatorio;
      objetos = [...(objetos ?? []), nuevo.objeto];
      contadorObjetos = (contadorObjetos ?? 0) + 1;
      break;
    }
    case "agujero-negro": {
      // Uno solo a la vez: el nuevo sustituye al anterior y reinicia su ronda.
      const limpio = sinAgujeroNegro(siguiente);
      const pozo = crearAgujeroNegro(limpio, aleatorio);
      aleatorio = pozo.aleatorio;
      if (pozo.planeta === null) break;
      siguiente = { ...limpio, planetas: [...(limpio.planetas ?? []), pozo.planeta] };
      efectos = [...efectos.filter((efecto) => efecto.tipo !== "agujero-negro"), { tipo: "agujero-negro", turnosRestantes: duracionGlobal }];
      break;
    }
  }
  return { estado: { ...siguiente, universo: { ...universo, aleatorio, efectos, ...(objetos !== undefined ? { objetos, contadorObjetos } : {}) } }, eventos: [anuncio] };
}

function deshacerEfecto(estado: EstadoPartida, efecto: EfectoActivo): EstadoPartida {
  switch (efecto.tipo as TipoEfecto) {
    case "gravedad-x2":
      return conGravedad(estado, 0.5);
    case "gravedad-mitad":
      return conGravedad(estado, 2);
    case "viento-solar":
      return conDeriva(estado, -(efecto.derivaAnadida ?? 0));
    case "agujero-negro":
      return sinAgujeroNegro(estado);
    default:
      return estado;
  }
}

// Cierre de turno del universo: gasta los efectos, resuelve el disparo gratis y
// avanza el calendario, en ese orden. Un efecto recién aplicado no se gasta en
// el mismo cierre, así que vitaminas dura exactamente 3 turnos propios.
export function avanzarUniverso(
  estado: EstadoPartida,
  cierre: { readonly tirador: IdNave; readonly armaGratis: boolean },
): { estado: EstadoPartida; eventos: EventoSimulacion[] } {
  const universoInicial = estado.universo;
  if (universoInicial === undefined) return { estado, eventos: [] };
  const eventos: EventoSimulacion[] = [];

  let actual: EstadoPartida = estado;
  const vigentes: EfectoActivo[] = [];
  for (const efecto of universoInicial.efectos) {
    const gasta = efecto.nave === undefined || efecto.nave === cierre.tirador;
    const restantes = gasta ? efecto.turnosRestantes - 1 : efecto.turnosRestantes;
    if (restantes > 0) vigentes.push({ ...efecto, turnosRestantes: restantes });
    else actual = deshacerEfecto(actual, efecto);
  }
  actual = { ...actual, universo: { ...universoInicial, efectos: vigentes } };

  if (cierre.armaGratis && actual.modo === "presupuesto") {
    const universo = actual.universo as EstadoUniverso;
    const sorteo = sortearEventoGratis(universo.aleatorio, contextoDe(actual));
    actual = { ...actual, universo: { ...universo, aleatorio: sorteo.aleatorio } };
    if (sorteo.evento !== null) {
      const aplicado = aplicarEvento(actual, sorteo.evento, "arma-gratis");
      actual = aplicado.estado;
      eventos.push(...aplicado.eventos);
    }
  }

  const universo = actual.universo as EstadoUniverso;
  const enTurnos = universo.proximo.enTurnos - 1;
  if (enTurnos > 0) {
    return { estado: { ...actual, universo: { ...universo, proximo: { ...universo.proximo, enTurnos } } }, eventos };
  }
  const aplicado = aplicarEvento(actual, universo.proximo, "calendario");
  eventos.push(...aplicado.eventos);
  const universoTrasEvento = aplicado.estado.universo as EstadoUniverso;
  const siguiente = programarSiguiente(universoTrasEvento.aleatorio, contextoDe(aplicado.estado));
  return {
    estado: { ...aplicado.estado, universo: { ...universoTrasEvento, aleatorio: siguiente.aleatorio, proximo: siguiente.evento } },
    eventos,
  };
}
