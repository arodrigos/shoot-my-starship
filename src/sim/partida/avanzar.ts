import { buscarArma } from "@/sim/armas/catalogo";
import { alturaSuperficie, danioPorDistancia, resolverDisparo } from "@/sim/armas/resolver";
import { distanciaACasco } from "@/sim/naves/contacto";
import { crearRobot, faseDeRobots, type EstadoRobot } from "@/sim/armas/minirobot";
import { avanzarObjetos } from "@/sim/universo/objetos";
import { avanzarUniverso, factorDanio } from "@/sim/universo/efectos";
import { recalcularRegistro } from "@/sim/gravedad/planetas";
import { armaEfectiva, costeArma } from "@/sim/partida/economia";
import { categorizarResultado, type CategoriaBroma } from "@/sim/partida/categoriaBroma";
import { radioEfectoEnMundo } from "@/sim/armas/radioEfecto";
import { detonacionesDeDisparo, type Detonacion } from "@/sim/partida/detonaciones";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import {
  caeAlVacio,
  esTiroImposibleAcertado,
  estaEnterrada,
  huboDerivaTraiciona,
  idLiderDerrumbado,
} from "@/sim/partida/eventosHumor";
import { existeTiroViable, RANGO_ANGULOS_ORACULO } from "@/sim/balistica/rejilla";
import { longitudDeEmpuje, recolocarTrasImpacto } from "@/sim/naves/desplazamiento";
import { avanzarRonda, drenajeDeRonda, empiezaRonda } from "@/sim/partida/muerteSubita";
import { entrarEnMuerteSubita } from "@/sim/universo/efectos";
import { buscarEquipo, TURNOS_ESCUDO } from "@/sim/equipo/catalogo";
import { volarConPropulsores } from "@/sim/equipo/propulsores";
import { siguienteTurno, type AccionDeTurno, type EntradaDeTurno, type EstadoNave, type EstadoPartida, type IdNave } from "@/sim/partida/tipos";

const PRESUPUESTO_VIABILIDAD_DESTINO = 120;
// Con el arma base y no con la que se acaba de disparar: el rival puede haber
// usado una de área grande con la que casi siempre hay tiro, y el destino
// dejaba al otro bando, con su arma de siempre, sin ninguno.
const ARMA_VIABILIDAD_ID = "pepinazo-cortesia";

function estaProtegida(nave: EstadoNave): boolean {
  return (nave.escudoTurnosRestantes ?? 0) > 0;
}

// El escudo baja al empezar cada turno de su dueño: activado en el turno N, el
// rival juega con él puesto, y desaparece al empezar el segundo turno propio
// posterior (2 → 1 → 0), de modo que protege exactamente dos rondas de rivales.
function gastarTurnoDeEscudo(naves: EstadoNave[], dueno: IdNave): EstadoNave[] {
  const nave = naves[dueno];
  if (!estaProtegida(nave)) return naves;
  return naves.map((candidata, id) => (id === dueno ? { ...candidata, escudoTurnosRestantes: (nave.escudoTurnosRestantes ?? 1) - 1 } : candidata));
}

function conIntegridad(nave: EstadoNave, integridad: number): EstadoNave {
  return { ...nave, integridad: Math.min(100, Math.max(0, integridad)) };
}

function conDesplazamiento(nave: EstadoNave, desplazamientoPx: number, anchoMundo: number): EstadoNave {
  return { ...nave, x: Math.min(anchoMundo, Math.max(0, nave.x + desplazamientoPx)) };
}

// El núcleo de este bloque, con la firma que describe la arquitectura del
// diseño: avanzar(estado, entradaDeTurno) -> (estadoNuevo, eventos[]). Pura
// y determinista -- nada de azar fuera del generador con semilla, nada de
// Date.now, nada de I/O -- que es la única razón por la que este producto
// tiene criterios que pueden fallar de verdad en un test de Node (nucleo-1,
// nucleo-2, nucleo-4, nucleo-5). balistica-armas sustituye aquí el perfil de
// disparo único de nucleo-turnos por el catálogo real y la colisión contra
// la máscara: avanzar() ya no conoce ninguna física ni ningún id de arma
// propios, solo llama a resolverDisparo con lo que declara el catálogo.
export function avanzar(
  estado: EstadoPartida,
  entrada: EntradaDeTurno,
): { estado: EstadoPartida; eventos: EventoSimulacion[]; categoriaBroma: CategoriaBroma | undefined; detonaciones: Detonacion[] } {
  if (estado.resultado.tipo === "terminada") {
    throw new Error("avanzar: la partida ya ha terminado, no admite más turnos");
  }

  const tirador: IdNave = estado.turno;
  if (entrada.accion !== undefined && entrada.accion !== "disparo") {
    return avanzarConEquipo(estado, entrada.accion, entrada);
  }
  const objetivoId: IdNave = entrada.objetivoId;
  if (objetivoId === tirador || estado.naves[objetivoId] === undefined || estado.naves[objetivoId].integridad <= 0) {
    throw new Error(`avanzar: objetivoId inválido (${objetivoId}) para el tirador ${tirador}`);
  }
  const presupuesto = estado.modo === "presupuesto";
  const armaBase = armaEfectiva(buscarArma(entrada.arma), presupuesto);
  // eventos-universo: vitaminas y virus escalan el daño del arma, no su
  // alcance ni su precio; la previsualización no muestra daño, así que no hay
  // nada que desincronizar.
  const factor = factorDanio(estado, tirador);
  const arma =
    factor !== 1 && (armaBase.efecto.tipo === "danio" || armaBase.efecto.tipo === "danio-y-autodanio")
      ? { ...armaBase, efecto: { ...armaBase.efecto, danioMaximo: armaBase.efecto.danioMaximo * factor } }
      : armaBase;

  // economia-rectificada: el arma de pago se cobra al usarla, no al elegirla.
  // El guardián vive aquí (y no solo en el HUD) porque avanzar() es la fuente
  // de verdad: rechaza antes de mutar nada, así un intento sin saldo deja el
  // estado serializado intacto.
  const saldoTirador = presupuesto ? estado.saldos?.[tirador] : undefined;
  const precio = costeArma(arma);
  if (saldoTirador !== undefined && precio > saldoTirador) {
    throw new Error(`avanzar: "${arma.nombre}" cuesta ${precio} cr y la nave ${tirador} solo tiene ${saldoTirador}`);
  }
  const saldosTrasDisparo =
    saldoTirador !== undefined ? estado.saldos?.map((saldo, id) => (id === tirador && saldo !== undefined ? saldo - precio : saldo)) : estado.saldos;

  const eventos: EventoSimulacion[] = [
    {
      tipo: "disparo",
      nave: tirador,
      arma: entrada.arma,
      anguloGrados: entrada.anguloGrados,
      potencia: entrada.potencia,
    },
  ];

  const naveTiradora = estado.naves[tirador];
  const naveObjetivo = estado.naves[objetivoId];
  const objetivoY = naveObjetivo.y ?? alturaSuperficie(estado.mascara, naveObjetivo.x) ?? estado.mundo.alto - 1;
  // impacto-naves (imp-1..imp-9): el casco como cuerpo de colisión es un
  // mecanismo del sistema ESPACIAL -- el diseño entero de este bloque habla
  // de naves flotando entre planetas, nunca del suelo plano heredado de
  // nucleo-turnos. Con nave.y presente en las DOS naves (modo espacial) se
  // arma el rastreador; en suelo plano (nave.y ausente) se sigue sin cuerpo
  // de colisión, exactamente como antes de este bloque -- solo las armas que
  // ya rebotaban/rodaban lo hacían por terreno, nunca por una nave. La
  // ganancia real de este bloque en suelo plano es solo el daño en 2D real
  // (imp-3), no el casco.
  const modoEspacial = naveTiradora.y !== undefined && naveObjetivo.y !== undefined;
  // impacto-naves (imp-1): solo las naves VIVAS son cuerpo de colisión --
  // una nave ya a 0 de integridad (posible en un "danio-y-autodanio" del
  // turno anterior que aún no cerró partida) no detiene ningún vuelo.
  const navesVivas = modoEspacial
    ? estado.naves
        .map((nave, id) => ({ id: id as IdNave, nave }))
        .filter(({ nave }) => nave.integridad > 0)
        .map(({ id, nave }) => ({ id, x: nave.x, y: nave.y as number, integridad: nave.integridad }))
    : undefined;

  const resultado = resolverDisparo({
    mascara: estado.mascara,
    gravedad: estado.mundo.gravedad,
    deriva: estado.mundo.deriva,
    aleatorio: estado.aleatorio,
    arma,
    origenX: naveTiradora.x,
    origenY: naveTiradora.y,
    anguloGrados: entrada.anguloGrados,
    potencia: entrada.potencia,
    objetivoX: naveObjetivo.x,
    objetivoY,
    objetivoId,
    ancho: estado.mundo.ancho,
    alto: estado.mundo.alto,
    planetas: estado.planetas,
    naves: navesVivas,
    tiradorId: tirador,
    // potencia-dispersion (pot-1): el disparo que de verdad cambia el
    // estado de la partida -- el único sitio (junto con la comparación
    // sinDeriva de más abajo) donde esta dispersión debe aplicarse.
    incluirDispersionPotencia: true,
  });

  // humor-por-turno (hum-1, hum-4): una sola categoría por disparo, con la
  // máscara de ANTES de este disparo (resultado.mascara ya lleva el cráter
  // tallado en el punto que categorizarResultado necesita inspeccionar).
  const categoriaBroma = categorizarResultado({
    resultado,
    mascaraAntes: estado.mascara,
    objetivoId,
    objetivoX: naveObjetivo.x,
    objetivoY,
  });

  // LA DECISIÓN DECLARADA: la masa viaja congelada durante todo el vuelo
  // (resolverDisparo la usó tal cual estaba en estado.planetas) y se
  // recalcula aquí, una sola vez, al cerrar el turno -- nunca dentro del
  // bucle de integración (grav-4). Fuerza bruta sobre la máscara resultante:
  // es un coste por turno, no por paso de física.
  const planetasTrasDisparo = estado.planetas ? recalcularRegistro(estado.planetas, resultado.mascara) : estado.planetas;

  // humor-sistemico: el arma ha fallado su tirada de fiabilidad. Va antes de
  // los eventos "impacto" (que igualmente se emiten, con daño 0, para que la
  // presentación sepa dónde ha caído el petardo mojado).
  if (resultado.fallo) {
    eventos.push({ tipo: "arma-falla", nave: tirador, arma: entrada.arma });
  }
  if (resultado.proyectilPerdido) {
    eventos.push({ tipo: "proyectil-perdido", nave: tirador, arma: entrada.arma, ...(resultado.salida ? { salida: resultado.salida } : {}) });
  }

  // minirobot: el proyectil que acaba en un planeta no detona, se queda posado
  // como robot (sin explosión ni evento de impacto: aún no ha pasado nada).
  const puntoRobot =
    arma.comportamiento.tipo === "minirobot" && !resultado.fallo && !resultado.proyectilPerdido && resultado.puntosDeImpacto[0]?.impactoNave === undefined
      ? resultado.puntosDeImpacto[0]
      : undefined;
  const robotNuevo = puntoRobot
    ? crearRobot({ dueno: tirador, objetivoId, armaId: arma.id, contacto: puntoRobot, mascara: resultado.mascara, planetas: planetasTrasDisparo })
    : undefined;
  if (robotNuevo) eventos.push({ tipo: "robot-posado", nave: tirador, x: robotNuevo.x, y: robotNuevo.y });

  const detonaciones = puntoRobot
    ? []
    : detonacionesDeDisparo(arma, resultado.puntosDeImpacto, resultado.danioPorPunto, estado.mascara, estado.mundo);

  (puntoRobot ? [] : resultado.puntosDeImpacto).forEach((punto, indice) => {
    eventos.push({
      tipo: "impacto",
      x: punto.x,
      y: punto.y,
      objetivo: objetivoId,
      danio: resultado.danioPorPunto[indice],
      ...(resultado.desplazamientoObjetivoPx !== 0 ? { desplazamientoPx: resultado.desplazamientoObjetivoPx } : {}),
      ...(punto.impactoNave !== undefined ? { impactoNave: punto.impactoNave } : {}),
    });
  });

  let objetivoTrasImpacto = conIntegridad(naveObjetivo, naveObjetivo.integridad - resultado.danioObjetivo);
  if (resultado.desplazamientoObjetivoPx !== 0) {
    objetivoTrasImpacto = conDesplazamiento(objetivoTrasImpacto, resultado.desplazamientoObjetivoPx, estado.mundo.ancho);
  }

  let tiradorTrasDisparo = naveTiradora;
  let integridadTirador = naveTiradora.integridad;
  if (resultado.danioPropio > 0) {
    integridadTirador -= resultado.danioPropio;
    eventos.push({ tipo: "impacto", x: naveTiradora.x, y: resultado.origenY, objetivo: tirador, danio: resultado.danioPropio });
    eventos.push({ tipo: "autoimpacto", nave: tirador, danio: resultado.danioPropio });
  }
  // impacto-naves (imp-5): autoimpacto por gravedad -- SEPARADO del
  // danioPropio de arriba (Despedida, autodaño fijo garantizado por
  // catálogo en cada disparo). Este solo ocurre cuando el vuelo real ha
  // detenido el proyectil de verdad sobre el propio casco, tras su gracia.
  if (resultado.impactoPropio) {
    integridadTirador -= resultado.impactoPropio.danio;
    eventos.push({
      tipo: "impacto",
      x: resultado.impactoPropio.x,
      y: resultado.impactoPropio.y,
      objetivo: tirador,
      danio: resultado.impactoPropio.danio,
    });
    eventos.push({ tipo: "autoimpacto", nave: tirador, danio: resultado.impactoPropio.danio });
  }
  if (resultado.danioPropio > 0 || resultado.impactoPropio) {
    tiradorTrasDisparo = conIntegridad(naveTiradora, integridadTirador);
  }

  // humor-sistemico: derrumbe-bajo-el-lider se evalúa sobre quien iba en
  // cabeza ANTES de este disparo (más integridad de las dos), en su x de
  // antes -- ningún evento de humor mueve naves, solo el Gravitón lo hace, y
  // ese no toca la máscara, así que no hay interferencia entre los dos.
  const liderDerrumbado = idLiderDerrumbado(
    estado.naves.map((nave, id) => ({ id, integridad: nave.integridad, x: nave.x })),
    estado.mascara,
    resultado.mascara,
  );

  if ((arma.efecto.tipo === "danio" || arma.efecto.tipo === "danio-y-autodanio") && estado.mundo.deriva !== 0 && !resultado.fallo) {
    const resultadoSinDeriva = resolverDisparo({
      mascara: estado.mascara,
      gravedad: estado.mundo.gravedad,
      deriva: 0,
      aleatorio: estado.aleatorio,
      arma,
      origenX: naveTiradora.x,
      origenY: naveTiradora.y,
      anguloGrados: entrada.anguloGrados,
      potencia: entrada.potencia,
      objetivoX: naveObjetivo.x,
      objetivoY,
      objetivoId,
      ancho: estado.mundo.ancho,
      alto: estado.mundo.alto,
      planetas: estado.planetas,
      naves: navesVivas,
      tiradorId: tirador,
      incluirDispersionPotencia: true,
    });
    if (huboDerivaTraiciona(resultado, resultadoSinDeriva)) {
      eventos.push({ tipo: "deriva-traiciona", nave: tirador });
    }
  }

  if (
    esTiroImposibleAcertado(
      naveTiradora.x,
      resultado.origenY,
      naveObjetivo.x,
      objetivoY,
      estado.mundo.gravedad,
      entrada.potencia,
      entrada.anguloGrados,
      resultado,
    )
  ) {
    eventos.push({ tipo: "tiro-imposible-acertado", nave: tirador, objetivo: objetivoId });
  }

  if (estaEnterrada(tiradorTrasDisparo.x, estado.mascara, resultado.mascara)) {
    eventos.push({ tipo: "enterrado", nave: tirador });
  }
  if (estaEnterrada(objetivoTrasImpacto.x, estado.mascara, resultado.mascara)) {
    eventos.push({ tipo: "enterrado", nave: objetivoId });
  }

  // caida-al-vacio: la columna se ha quedado sin suelo donde antes lo tenía.
  // Es un evento de humor puro (cámara, texto) -- no fuerza el fin de
  // partida. El criterio de victoria del núcleo (integridad <= 0) es de
  // nucleo-turnos/ia-personalidades, ya fijado y probado por nucleo-5 e
  // ia-3; ningún criterio de humor-sistemico pide cambiarlo, y hacerlo con
  // el suelo delgado de crearMascaraPlana en los tests de ia-* desequilibra
  // esos tests ya aceptados sin necesidad (ver desviaciones).
  const tiradorCae = caeAlVacio(tiradorTrasDisparo.x, estado.mascara, resultado.mascara);
  if (tiradorCae) {
    eventos.push({ tipo: "caida-al-vacio", nave: tirador });
  }
  const objetivoCae = caeAlVacio(objetivoTrasImpacto.x, estado.mascara, resultado.mascara);
  if (objetivoCae) {
    eventos.push({ tipo: "caida-al-vacio", nave: objetivoId });
  }

  // El derrumbe no se anuncia si ese mismo líder ya ha caído al vacío este
  // turno: ese evento, más grave, ya se ha emitido arriba.
  if (liderDerrumbado !== null && !(liderDerrumbado === tirador ? tiradorCae : objetivoCae)) {
    eventos.push({ tipo: "derrumbe-bajo-el-lider", nave: liderDerrumbado });
  }

  // nucleo-n-naves-2: el daño sale del punto de impacto REAL, no de a quién
  // apuntaba el turno. objetivoId es la intención de quien dispara (y el
  // proxy de la IA); si decidiera él solo quién recibe daño, acertar a una
  // tercera nave no contaría y su casco, que sí corta el vuelo, haría de
  // escudo invulnerable. El objetivo declarado conserva su cálculo de
  // siempre (resultado.danioObjetivo) para que 1vIA siga idéntico bit a bit.
  const danioColateral = danioATercerasNaves(estado, tirador, objetivoId, arma, resultado);
  danioColateral.forEach((danio, id) => {
    eventos.push({ tipo: "danio-colateral", nave: id, danio });
  });

  // escudo-y-propulsores: el escudo bloquea el daño y el empuje de los disparos
  // AJENOS; el autodaño del tirador no pasa por aquí. Sin daño no hay
  // desplazamiento posterior, que se decide por la pérdida de integridad.
  const navesTrasDanio: EstadoNave[] = estado.naves.map((nave, id) => {
    if (id === tirador) return tiradorTrasDisparo;
    const tras = id === objetivoId ? objetivoTrasImpacto : conIntegridad(nave, nave.integridad - (danioColateral.get(id) ?? 0));
    if (!estaProtegida(nave)) return tras;
    const evitado = nave.integridad - tras.integridad;
    if (evitado > 0) eventos.push({ tipo: "escudo-bloquea", nave: id, danio: evitado });
    return nave;
  });
  // El daño que el escudo ha parado no se anuncia como recibido: la cáscara
  // cuenta el daño hecho a partir de los eventos de impacto.
  eventos.forEach((evento, indice) => {
    if (evento.tipo === "impacto" && evento.objetivo !== tirador && estaProtegida(estado.naves[evento.objetivo])) {
      eventos[indice] = { ...evento, danio: 0 };
    }
  });

  // desplazamiento-tras-impacto: toda nave viva que ha perdido integridad en
  // este turno se recoloca, para que repetir el disparo sin apuntar de nuevo
  // no vuelva a acertar. Se hace sobre la máscara ya con el cráter y con las
  // posiciones ya movidas de las naves anteriores (orden por id, determinista).
  // El objetivo declarado no puede caer en un destino por el que el mismo
  // disparo, repetido tal cual, vuelva a darle: es lo que pide el criterio
  // «repetir el disparo no acierta», y el simple alejamiento no basta cuando
  // el nuevo sitio queda en la propia trayectoria.
  const repetiriaElImpacto = (punto: { x: number; y: number }): boolean => {
    const navesConDestino = navesVivas?.map((nave) => (nave.id === objetivoId ? { ...nave, x: punto.x, y: punto.y } : nave));
    const repeticion = resolverDisparo({
      mascara: estado.mascara,
      gravedad: estado.mundo.gravedad,
      deriva: estado.mundo.deriva,
      aleatorio: estado.aleatorio,
      arma,
      origenX: naveTiradora.x,
      origenY: naveTiradora.y,
      anguloGrados: entrada.anguloGrados,
      potencia: entrada.potencia,
      objetivoX: punto.x,
      objetivoY: punto.y,
      objetivoId,
      ancho: estado.mundo.ancho,
      alto: estado.mundo.alto,
      planetas: estado.planetas,
      naves: navesConDestino,
      tiradorId: tirador,
      incluirDispersionPotencia: true,
    });
    return repeticion.danioObjetivo > 0;
  };
  // Un destino tampoco vale si deja a un bando sin ningún tiro posible contra
  // el otro (detrás de un planeta, por ejemplo): la partida se quedaría sin
  // forma de acabar salvo por la muerte súbita, y colocarNaves ya garantiza
  // lo contrario al empezar. Presupuesto acotado: se rinde al primer tiro con
  // daño y como mucho prueba PRESUPUESTO_VIABILIDAD_DESTINO vuelos.
  const sinTiroEntreLosDos = (movida: IdNave, punto: { x: number; y: number }): boolean => {
    if (navesVivas === undefined) return false;
    const naves = navesVivas.map((nave) => (nave.id === movida ? { ...nave, x: punto.x, y: punto.y } : nave));
    const comun = {
      mascara: resultado.mascara,
      ancho: estado.mundo.ancho,
      alto: estado.mundo.alto,
      planetas: estado.planetas,
      gravedad: estado.mundo.gravedad,
      deriva: estado.mundo.deriva,
      aleatorio: estado.aleatorio,
      arma: buscarArma(ARMA_VIABILIDAD_ID),
      naves,
      rangoAngulos: RANGO_ANGULOS_ORACULO,
      presupuestoIntentos: PRESUPUESTO_VIABILIDAD_DESTINO,
    };
    return !existeTiroViable({ ...comun, tiradorId: tirador, objetivoId }) || !existeTiroViable({ ...comun, tiradorId: objetivoId, objetivoId: tirador });
  };
  const desplazadas = desplazarNavesDanadas({
    estado,
    navesTrasDanio,
    mascara: resultado.mascara,
    planetas: planetasTrasDisparo,
    radioEfectoU: radioEfectoEnMundo(arma, estado.mundo.ancho, estado.mundo.alto),
    fuentes: resultado.puntosDeImpacto,
    danioMaximo: arma.efecto.tipo === "danio" || arma.efecto.tipo === "danio-y-autodanio" ? arma.efecto.danioMaximo : 0,
    objetivoId,
    descartarDestinoDelObjetivo: (punto) => repetiriaElImpacto(punto) || sinTiroEntreLosDos(objetivoId, punto),
    descartarDestinoDeOtra: sinTiroEntreLosDos,
  });
  const naves = desplazadas.naves;
  eventos.push(...desplazadas.eventos);

  // nucleo-n-naves: "último en pie" sobre TODAS las naves, no solo tirador y
  // objetivo: con daño de área cualquiera puede caer en este turno. Si no
  // queda nadie en pie (Despedida contra rivales ya muy dañados) es empate
  // real: ya no hay desempate a favor del objetivo.
  const robotsTrasDisparo = [...(estado.robots ?? []), ...(robotNuevo ? [robotNuevo] : [])];
  const vivos = naves.flatMap((nave, id) => (nave.integridad > 0 ? [id as IdNave] : []));
  if (vivos.length <= 1) {
    const ganador: IdNave | null = vivos.length === 1 ? vivos[0] : null;
    eventos.push({ tipo: "partida-fin", ganador });
    return {
      estado: {
        ...sinRobots(estado),
        mascara: resultado.mascara,
        naves,
        aleatorio: resultado.aleatorio,
        resultado: { tipo: "terminada", ganador },
        planetas: planetasTrasDisparo,
        saldos: saldosTrasDisparo,
        ...conRobots([]),
      },
      eventos,
      categoriaBroma,
      detonaciones,
    };
  }

  return cerrarTurno({
    estado,
    tirador,
    naves,
    mascara: resultado.mascara,
    planetas: planetasTrasDisparo,
    aleatorio: resultado.aleatorio,
    robots: robotsTrasDisparo,
    saldos: saldosTrasDisparo,
    eventos,
    detonaciones,
    categoriaBroma,
    armaGratis: presupuesto && costeArma(arma) === 0,
  });
}

// escudo-y-propulsores: usar equipo ocupa el turno entero (nada de disparar).
// En presupuesto se cobra aquí, como las armas de pago, y si no llega el saldo
// se rechaza sin tocar el estado.
function avanzarConEquipo(
  estado: EstadoPartida,
  accion: Exclude<AccionDeTurno, "disparo">,
  entrada: EntradaDeTurno,
): ReturnType<typeof avanzar> {
  const tirador = estado.turno;
  const equipo = buscarEquipo(accion);
  const nave = estado.naves[tirador];
  const presupuesto = estado.modo === "presupuesto";
  const saldo = presupuesto ? estado.saldos?.[tirador] : undefined;
  if (saldo !== undefined && equipo.coste > saldo) {
    throw new Error(`avanzar: "${equipo.nombre}" cuesta ${equipo.coste} cr y la nave ${tirador} solo tiene ${saldo}`);
  }
  if (accion === "escudo" && estaProtegida(nave)) {
    throw new Error(`avanzar: la nave ${tirador} ya tiene el escudo activo`);
  }
  const saldos = saldo !== undefined ? estado.saldos?.map((valor, id) => (id === tirador && valor !== undefined ? valor - equipo.coste : valor)) : estado.saldos;

  const eventos: EventoSimulacion[] = [];
  const naves: EstadoNave[] = [...estado.naves];
  if (accion === "escudo") {
    naves[tirador] = { ...nave, escudoTurnosRestantes: TURNOS_ESCUDO };
    eventos.push({ tipo: "escudo-activado", nave: tirador, turnos: TURNOS_ESCUDO });
  } else {
    if (nave.y === undefined) throw new Error("avanzar: los propulsores solo existen en el modo espacial");
    const otras = estado.naves.flatMap((otra, id) => (id !== tirador && otra.integridad > 0 && otra.y !== undefined ? [{ x: otra.x, y: otra.y }] : []));
    const vuelo = volarConPropulsores({
      desde: { x: nave.x, y: nave.y },
      anguloGrados: entrada.anguloGrados,
      potencia: entrada.potencia,
      mundo: estado.mundo,
      mascara: estado.mascara,
      planetas: estado.planetas,
      otras,
    });
    naves[tirador] = { ...nave, x: vuelo.destino.x, y: vuelo.destino.y };
    eventos.push({ tipo: "propulsores", nave: tirador, desdeX: nave.x, desdeY: nave.y, x: vuelo.destino.x, y: vuelo.destino.y, motivo: vuelo.motivo });
  }
  // Un turno de equipo no dispara: sin categoría de broma, la cáscara no comenta.
  return cerrarTurno({
    estado: { ...estado, saldos },
    tirador,
    naves,
    mascara: estado.mascara,
    planetas: estado.planetas,
    aleatorio: estado.aleatorio,
    robots: estado.robots ?? [],
    saldos,
    eventos,
    detonaciones: [],
    categoriaBroma: undefined,
    armaGratis: false,
  });
}

interface ContextoCierre {
  readonly estado: EstadoPartida;
  readonly tirador: IdNave;
  readonly naves: EstadoNave[];
  readonly mascara: EstadoPartida["mascara"];
  readonly planetas: EstadoPartida["planetas"];
  readonly aleatorio: EstadoPartida["aleatorio"];
  readonly robots: readonly EstadoRobot[];
  readonly saldos: EstadoPartida["saldos"];
  readonly eventos: EventoSimulacion[];
  readonly detonaciones: Detonacion[];
  readonly categoriaBroma: CategoriaBroma | undefined;
  readonly armaGratis: boolean;
}

// Cierre común a todo turno (disparo, escudo o propulsores): fase de robots del
// siguiente jugador, fin de partida, relevo y cuenta atrás de su escudo.
function cerrarTurno(contexto: ContextoCierre): ReturnType<typeof avanzar> {
  const { estado, tirador, naves, mascara, planetas, aleatorio: aleatorioInicial, robots, saldos, eventos, detonaciones, categoriaBroma, armaGratis } = contexto;
  // minirobot: al empezar el turno de su dueño, sin gastarle el turno. Se
  // resuelve aquí, al cerrar el turno anterior, porque el estado que ve el
  // jugador al empezar ya es el de después de que sus robots se muevan.
  let navesFinal: EstadoNave[] = naves;
  let mascaraFinal = mascara;
  let planetasFinal = planetas;
  const aleatorioFinal = aleatorioInicial;
  let robotsFinal = robots;
  const detonacionesFinal = [...detonaciones];
  const turnoSiguiente = siguienteTurno({ ...estado, naves }, tirador);
  if (robots.length > 0) {
    const fase = faseDeRobots({ robots, turno: turnoSiguiente, naves, mascara, mundo: estado.mundo, planetas });
    robotsFinal = [...fase.robots];
    eventos.push(...fase.eventos);
    detonacionesFinal.push(...fase.detonaciones);
    if (fase.detonaciones.length > 0) {
      mascaraFinal = fase.mascara;
      planetasFinal = planetas ? recalcularRegistro(planetas, fase.mascara) : planetas;
      const heridas = naves.map((nave, id) => {
        const danio = fase.danios.get(id);
        if (danio === undefined) return nave;
        if (estaProtegida(nave)) {
          eventos.push({ tipo: "escudo-bloquea", nave: id, danio });
          return nave;
        }
        return conIntegridad(nave, nave.integridad - danio);
      });
      // El robot empuja en radial desde su detonación; el más dañino fija la
      // longitud (no hay un daño máximo de arma que compararle).
      const recolocadas = desplazarNavesDanadas({
        estado: { ...estado, naves },
        navesTrasDanio: heridas,
        mascara: mascaraFinal,
        planetas: planetasFinal,
        radioEfectoU: fase.detonaciones[0].radioEfectoU,
        fuentes: fase.detonaciones,
        danioMaximo: Math.max(...fase.danios.values()),
        objetivoId: -1,
        descartarDestinoDelObjetivo: () => false,
      });
      navesFinal = recolocadas.naves;
      eventos.push(...recolocadas.eventos);
    }
  }

  // eventos-objetos: se mueven antes de comprobar quién sigue vivo (una
  // tormenta puede matar) y antes de que el universo cambie la gravedad, para
  // que el vuelo coincida con la ruta que el pronóstico dibujó este turno.
  let universoFinal = estado.universo;
  if (estado.universo !== undefined) {
    const fase = avanzarObjetos({ ...estado, naves: navesFinal, mascara: mascaraFinal, planetas: planetasFinal }, navesFinal);
    navesFinal = fase.naves;
    universoFinal = fase.universo;
    eventos.push(...fase.eventos);
  }

  const vivosFinal = navesFinal.flatMap((nave, id) => (nave.integridad > 0 ? [id as IdNave] : []));
  if (vivosFinal.length <= 1) {
    // Un robot puede matar a los dos últimos a la vez: empate real, sin
    // objetivo declarado al que concedérselo.
    const ganador: IdNave | null = vivosFinal.length === 1 ? vivosFinal[0] : null;
    eventos.push({ tipo: "partida-fin", ganador });
    return {
      estado: {
        ...sinRobots(estado),
        mascara: mascaraFinal,
        naves: navesFinal,
        aleatorio: aleatorioFinal,
        resultado: { tipo: "terminada", ganador },
        planetas: planetasFinal,
        saldos,
        universo: universoFinal,
        ...conRobots([]),
      },
      eventos,
      categoriaBroma,
      detonaciones: detonacionesFinal,
    };
  }

  const proximoTurno = siguienteTurno({ ...estado, naves: navesFinal }, tirador);
  eventos.push({ tipo: "turno-fin", siguienteTurno: proximoTurno });

  // muerte-subita: al empezar una ronda nueva todas las vivas pagan el drenaje
  // a la vez, sin que el escudo lo pare. Si las últimas caen juntas, empate.
  let rondaFinal = estado.ronda;
  let universoTrasRonda = universoFinal;
  let faseMuerteSubita = estado.muerteSubita;
  if (estado.ronda !== undefined && empiezaRonda(estado, tirador, proximoTurno)) {
    const fase = avanzarRonda(estado, navesFinal);
    rondaFinal = fase.ronda;
    navesFinal = fase.naves;
    eventos.push(...fase.eventos);
    const vivasTrasDrenaje = navesFinal.flatMap((nave, id) => (nave.integridad > 0 ? [id as IdNave] : []));
    if (vivasTrasDrenaje.length <= 1) {
      const ganador: IdNave | null = vivasTrasDrenaje.length === 1 ? vivasTrasDrenaje[0] : null;
      eventos.push({ tipo: "partida-fin", ganador });
      return {
        estado: {
          ...sinRobots(estado),
          mascara: mascaraFinal,
          naves: navesFinal,
          aleatorio: aleatorioFinal,
          resultado: { tipo: "terminada", ganador },
          planetas: planetasFinal,
          saldos,
          universo: universoFinal,
          ronda: rondaFinal,
          muerteSubita: true,
          ...conRobots([]),
        },
        eventos,
        categoriaBroma,
        detonaciones: detonacionesFinal,
      };
    }
    if (faseMuerteSubita !== true && drenajeDeRonda(rondaFinal) > 0) {
      faseMuerteSubita = true;
      universoTrasRonda = entrarEnMuerteSubita({ ...estado, naves: navesFinal, universo: universoFinal }).universo;
    }
  }
  const universo = avanzarUniverso(
    {
      ...sinRobots(estado),
      mascara: mascaraFinal,
      naves: gastarTurnoDeEscudo(navesFinal, proximoTurno),
      aleatorio: aleatorioFinal,
      turno: proximoTurno,
      numeroTurno: estado.numeroTurno + 1,
      planetas: planetasFinal,
      saldos,
      universo: universoTrasRonda,
      ...(rondaFinal !== undefined ? { ronda: rondaFinal } : {}),
      ...(faseMuerteSubita === true ? { muerteSubita: true } : {}),
      ...conRobots(robotsFinal),
    },
    { tirador, armaGratis },
  );
  eventos.push(...universo.eventos);
  return { estado: universo.estado, eventos, categoriaBroma, detonaciones: detonacionesFinal };
}

function sinRobots(estado: EstadoPartida): EstadoPartida {
  const copia: { -readonly [K in keyof EstadoPartida]: EstadoPartida[K] } = { ...estado };
  delete copia.robots;
  return copia;
}

// `robots` solo existe en el estado mientras haya alguno: así una partida sin
// robots serializa idéntica a como lo hacía antes de este arma.
function conRobots(robots: readonly EstadoRobot[]): { robots?: readonly EstadoRobot[] } {
  return robots.length > 0 ? { robots } : {};
}

// Terceras naves vivas (ni tirador ni objetivo declarado) con el daño que les
// toca por su distancia a cada punto de detonación. Mapa vacío si el disparo
// falló, se perdió o su efecto no es de daño.
function danioATercerasNaves(
  estado: EstadoPartida,
  tirador: IdNave,
  objetivoId: IdNave,
  arma: ReturnType<typeof buscarArma>,
  resultado: ReturnType<typeof resolverDisparo>,
): Map<IdNave, number> {
  const danios = new Map<IdNave, number>();
  const efecto = arma.efecto;
  if (resultado.fallo || resultado.proyectilPerdido) return danios;
  if (efecto.tipo !== "danio" && efecto.tipo !== "danio-y-autodanio") return danios;
  const radio = radioEfectoEnMundo(arma, estado.mundo.ancho, estado.mundo.alto);
  estado.naves.forEach((nave, id) => {
    if (id === tirador || id === objetivoId || nave.integridad <= 0) return;
    const y = nave.y ?? alturaSuperficie(estado.mascara, nave.x) ?? estado.mundo.alto - 1;
    const danio = resultado.puntosDeImpacto.reduce(
      (total, punto) => total + danioPorDistancia(radio, efecto.danioMaximo, distanciaACasco(punto.x, punto.y, { id: id as IdNave, x: nave.x, y, integridad: nave.integridad })),
      0,
    );
    if (danio > 0) danios.set(id, danio);
  });
  return danios;
}

interface ParametrosDesplazarNaves {
  readonly estado: EstadoPartida;
  readonly navesTrasDanio: readonly EstadoNave[];
  readonly mascara: EstadoPartida["mascara"];
  readonly planetas: EstadoPartida["planetas"];
  readonly radioEfectoU: number;
  // Puntos de detonación del turno; los que traen velocidad empujan en esa
  // dirección y los demás (robot, área sin vuelo) en radial desde el punto.
  readonly fuentes: readonly { readonly x: number; readonly y: number; readonly vx?: number; readonly vy?: number }[];
  readonly danioMaximo: number;
  readonly objetivoId: IdNave;
  readonly descartarDestinoDelObjetivo: (punto: { x: number; y: number }) => boolean;
  // Cualquier otra nave dañada (el tirador por su propio disparo, una tercera
  // por el área) tampoco puede acabar donde ya no hay tiro entre los dos.
  readonly descartarDestinoDeOtra?: (id: IdNave, punto: { x: number; y: number }) => boolean;
}

// La detonación más cercana al centro de la nave es la que la empuja: con el
// Racimo, cada nave sale en la dirección de la submunición que la alcanzó.
function direccionDeEmpuje(nave: { x: number; y: number }, fuentes: ParametrosDesplazarNaves["fuentes"]): { x: number; y: number } {
  let mejor: ParametrosDesplazarNaves["fuentes"][number] | undefined;
  let distanciaMejor = Infinity;
  for (const fuente of fuentes) {
    const distancia = Math.hypot(nave.x - fuente.x, nave.y - fuente.y);
    if (distancia < distanciaMejor) {
      mejor = fuente;
      distanciaMejor = distancia;
    }
  }
  if (mejor === undefined) return { x: 0, y: -1 };
  if (mejor.vx !== undefined && mejor.vy !== undefined && Math.hypot(mejor.vx, mejor.vy) > 1e-9) return { x: mejor.vx, y: mejor.vy };
  return { x: nave.x - mejor.x, y: nave.y - mejor.y };
}

function desplazarNavesDanadas(parametros: ParametrosDesplazarNaves): { naves: EstadoNave[]; eventos: EventoSimulacion[] } {
  const { estado, navesTrasDanio, mascara, planetas, radioEfectoU, fuentes, danioMaximo, objetivoId, descartarDestinoDelObjetivo, descartarDestinoDeOtra } = parametros;
  const naves = [...navesTrasDanio];
  const eventos: EventoSimulacion[] = [];
  naves.forEach((nave, id) => {
    const antes = estado.naves[id];
    // Sin y no hay modo espacial: el suelo plano heredado no recoloca.
    if (nave.y === undefined || nave.integridad <= 0 || nave.integridad >= antes.integridad) return;
    const otras = naves.flatMap((otra, idOtra) => (idOtra !== id && otra.integridad > 0 && otra.y !== undefined ? [{ x: otra.x, y: otra.y }] : []));
    const destino = recolocarTrasImpacto({
      desde: { x: nave.x, y: nave.y },
      direccion: direccionDeEmpuje({ x: nave.x, y: nave.y }, fuentes),
      longitud: longitudDeEmpuje(estado.mundo, radioEfectoU, antes.integridad - nave.integridad, danioMaximo),
      mundo: estado.mundo,
      mascara,
      ...(planetas !== undefined ? { pozos: planetas } : {}),
      otras,
      ...(id === objetivoId
        ? { descartar: descartarDestinoDelObjetivo }
        : descartarDestinoDeOtra !== undefined
          ? { descartar: (punto: { x: number; y: number }) => descartarDestinoDeOtra(id as IdNave, punto) }
          : {}),
    });
    naves[id] = { ...nave, x: destino.x, y: destino.y };
    eventos.push({ tipo: "desplazamiento", nave: id, desdeX: nave.x, desdeY: nave.y, x: destino.x, y: destino.y, reserva: destino.reserva, puntos: destino.puntos, motivoParada: destino.motivoParada });
  });
  return { naves, eventos };
}
