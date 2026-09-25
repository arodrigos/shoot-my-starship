import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import { naveContraria, type EntradaDeTurno, type EstadoNave, type EstadoPartida, type IdNave } from "@/sim/partida/tipos";

function conIntegridad(nave: EstadoNave, integridad: number): EstadoNave {
  return { x: nave.x, integridad: Math.min(100, Math.max(0, integridad)) };
}

function conDesplazamiento(nave: EstadoNave, desplazamientoPx: number, anchoMundo: number): EstadoNave {
  return { x: Math.min(anchoMundo, Math.max(0, nave.x + desplazamientoPx)), integridad: nave.integridad };
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
): { estado: EstadoPartida; eventos: EventoSimulacion[] } {
  if (estado.resultado.tipo === "terminada") {
    throw new Error("avanzar: la partida ya ha terminado, no admite más turnos");
  }

  const tirador: IdNave = estado.turno;
  const objetivoId: IdNave = naveContraria(tirador);
  const arma = buscarArma(entrada.arma);
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

  const resultado = resolverDisparo({
    mascara: estado.mascara,
    gravedad: estado.mundo.gravedad,
    deriva: estado.mundo.deriva,
    aleatorio: estado.aleatorio,
    arma,
    origenX: naveTiradora.x,
    anguloGrados: entrada.anguloGrados,
    potencia: entrada.potencia,
    objetivoX: naveObjetivo.x,
    ancho: estado.mundo.ancho,
    alto: estado.mundo.alto,
  });

  resultado.puntosDeImpacto.forEach((punto, indice) => {
    eventos.push({
      tipo: "impacto",
      x: punto.x,
      y: punto.y,
      objetivo: objetivoId,
      danio: resultado.danioPorPunto[indice],
      ...(resultado.desplazamientoObjetivoPx !== 0 ? { desplazamientoPx: resultado.desplazamientoObjetivoPx } : {}),
    });
  });

  let objetivoTrasImpacto = conIntegridad(naveObjetivo, naveObjetivo.integridad - resultado.danioObjetivo);
  if (resultado.desplazamientoObjetivoPx !== 0) {
    objetivoTrasImpacto = conDesplazamiento(objetivoTrasImpacto, resultado.desplazamientoObjetivoPx, estado.mundo.ancho);
  }

  let tiradorTrasDisparo = naveTiradora;
  if (resultado.danioPropio > 0) {
    tiradorTrasDisparo = conIntegridad(naveTiradora, naveTiradora.integridad - resultado.danioPropio);
    eventos.push({ tipo: "impacto", x: naveTiradora.x, y: resultado.origenY, objetivo: tirador, danio: resultado.danioPropio });
  }

  const naves: [EstadoNave, EstadoNave] =
    objetivoId === 0 ? [objetivoTrasImpacto, tiradorTrasDisparo] : [tiradorTrasDisparo, objetivoTrasImpacto];

  const huboGanador = objetivoTrasImpacto.integridad <= 0 || tiradorTrasDisparo.integridad <= 0;
  if (huboGanador) {
    // Si ambas caen en el mismo disparo (Despedida contra un objetivo ya
    // muy dañado), gana quien queda con más integridad; en empate exacto
    // gana el objetivo, porque quien dispara asumió el riesgo del autodaño.
    const ganador: IdNave = tiradorTrasDisparo.integridad > objetivoTrasImpacto.integridad ? tirador : objetivoId;
    eventos.push({ tipo: "partida-fin", ganador });
    return {
      estado: {
        ...estado,
        mascara: resultado.mascara,
        naves,
        aleatorio: resultado.aleatorio,
        resultado: { tipo: "terminada", ganador },
      },
      eventos,
    };
  }

  eventos.push({ tipo: "turno-fin", siguienteTurno: objetivoId });
  return {
    estado: {
      ...estado,
      mascara: resultado.mascara,
      naves,
      aleatorio: resultado.aleatorio,
      turno: objetivoId,
      numeroTurno: estado.numeroTurno + 1,
    },
    eventos,
  };
}
