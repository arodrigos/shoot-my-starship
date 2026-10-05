import { buscarArma } from "@/sim/armas/catalogo";
import { alturaSuperficie, resolverDisparo } from "@/sim/armas/resolver";
import { recalcularRegistro } from "@/sim/gravedad/planetas";
import { costeArma, ingresoPorDanio } from "@/sim/partida/economia";
import { categorizarResultado, type CategoriaBroma } from "@/sim/partida/categoriaBroma";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import {
  caeAlVacio,
  esTiroImposibleAcertado,
  estaEnterrada,
  huboDerivaTraiciona,
  idLiderDerrumbado,
} from "@/sim/partida/eventosHumor";
import { siguienteTurno, type EntradaDeTurno, type EstadoNave, type EstadoPartida, type IdNave } from "@/sim/partida/tipos";

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
): { estado: EstadoPartida; eventos: EventoSimulacion[]; categoriaBroma: CategoriaBroma } {
  if (estado.resultado.tipo === "terminada") {
    throw new Error("avanzar: la partida ya ha terminado, no admite más turnos");
  }

  const tirador: IdNave = estado.turno;
  const objetivoId: IdNave = entrada.objetivoId;
  if (objetivoId === tirador || estado.naves[objetivoId] === undefined || estado.naves[objetivoId].integridad <= 0) {
    throw new Error(`avanzar: objetivoId inválido (${objetivoId}) para el tirador ${tirador}`);
  }
  const arma = buscarArma(entrada.arma);

  // modos-y-presupuesto / nucleo-n-naves-3: el guardián vive aquí (y no solo
  // en el HUD) por la misma razón que el guardián de "partida ya terminada"
  // de arriba -- el control deshabilita el botón antes de que esto se
  // alcance en el juego real, pero avanzar() es la fuente de verdad y no
  // confía en que la cáscara nunca deje pasar un disparo que no se puede
  // pagar. Solo quien tiene saldo declarado en `saldos` participa del
  // guardián: en 1vIA, la IA sigue sin tener entrada en `saldos` y por tanto
  // sigue disparando como en barra libre siempre (ver desviaciones).
  const saldoTirador = estado.saldos?.[tirador];
  const disparaConPresupuesto = estado.modo === "presupuesto" && saldoTirador !== undefined;
  if (disparaConPresupuesto) {
    const coste = costeArma(arma);
    if (coste > saldoTirador) {
      throw new Error(`avanzar: saldo insuficiente para disparar "${arma.nombre}" (cuesta ${coste}, saldo ${saldoTirador})`);
    }
  }

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
        .map(({ id, nave }) => ({ id, x: nave.x, y: nave.y as number }))
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

  // modos-y-presupuesto (modo-1): se descuenta el precio y se ingresa por el
  // daño CAUSADO de verdad (resultado.danioObjetivo, tras fiabilidad y
  // dispersión) en la misma operación -- nunca dos pasos con un estado
  // intermedio, que es lo que dejaría hueco a un redondeo distinto del que
  // espera el test.
  const saldosTrasDisparo = disparaConPresupuesto
    ? estado.saldos?.map((saldo, id) =>
        id === tirador ? (saldo ?? 0) - costeArma(arma) + ingresoPorDanio(resultado.danioObjetivo) : saldo,
      )
    : estado.saldos;

  // humor-sistemico: el arma ha fallado su tirada de fiabilidad. Va antes de
  // los eventos "impacto" (que igualmente se emiten, con daño 0, para que la
  // presentación sepa dónde ha caído el petardo mojado).
  if (resultado.fallo) {
    eventos.push({ tipo: "arma-falla", nave: tirador, arma: entrada.arma });
  }
  if (resultado.proyectilPerdido) {
    eventos.push({ tipo: "proyectil-perdido", nave: tirador });
  }

  resultado.puntosDeImpacto.forEach((punto, indice) => {
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

  // contacto-honesto (con-3): el roce se anuncia SIN tocar la integridad --
  // por eso el evento se emite aquí, antes de que objetivoTrasImpacto o
  // tiradorTrasDisparo se calculen, y ninguno de los dos lo lee.
  if (resultado.roce) {
    eventos.push({ tipo: "roce", nave: resultado.roce.nave, x: resultado.roce.x, y: resultado.roce.y });
  }

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

  const naves: EstadoNave[] = estado.naves.map((nave, id) => {
    if (id === tirador) return tiradorTrasDisparo;
    if (id === objetivoId) return objetivoTrasImpacto;
    return nave;
  });

  // nucleo-n-naves: "último en pie" generalizado. Solo tirador y objetivo
  // cambian de integridad en este turno, así que un tercero nunca puede
  // pasar de vivo a eliminado aquí -- basta mirar cuántos de ellos dos
  // sobreviven, igual que hacía el núcleo de 2 naves con los dos únicos
  // participantes posibles.
  const tiradorVive = tiradorTrasDisparo.integridad > 0;
  const objetivoVive = objetivoTrasImpacto.integridad > 0;
  const huboGanador = !tiradorVive || !objetivoVive;
  if (huboGanador) {
    const otrosVivos = naves.some((nave, id) => id !== tirador && id !== objetivoId && nave.integridad > 0);
    // Si ambas caen en el mismo disparo (Despedida contra un objetivo ya muy
    // dañado) y no queda nadie más en pie, gana quien queda con más
    // integridad; en empate exacto gana el objetivo, porque quien dispara
    // asumió el riesgo del autodaño. Si las dos caen pero queda alguien más
    // vivo, es un empate real entre tirador y objetivo (ninguno gana), y la
    // partida sigue si ese alguien más sigue en juego.
    const ganador: IdNave | null =
      tiradorVive || objetivoVive
        ? tiradorVive
          ? tirador
          : objetivoId
        : otrosVivos
          ? null
          : tiradorTrasDisparo.integridad > objetivoTrasImpacto.integridad
            ? tirador
            : objetivoId;
    if (!otrosVivos) {
      eventos.push({ tipo: "partida-fin", ganador });
      return {
        estado: {
          ...estado,
          mascara: resultado.mascara,
          naves,
          aleatorio: resultado.aleatorio,
          resultado: { tipo: "terminada", ganador },
          planetas: planetasTrasDisparo,
          saldos: saldosTrasDisparo,
        },
        eventos,
        categoriaBroma,
      };
    }
  }

  const proximoTurno = siguienteTurno({ ...estado, naves }, tirador);
  eventos.push({ tipo: "turno-fin", siguienteTurno: proximoTurno });
  return {
    estado: {
      ...estado,
      mascara: resultado.mascara,
      naves,
      aleatorio: resultado.aleatorio,
      turno: proximoTurno,
      numeroTurno: estado.numeroTurno + 1,
      planetas: planetasTrasDisparo,
      saldos: saldosTrasDisparo,
    },
    eventos,
    categoriaBroma,
  };
}
