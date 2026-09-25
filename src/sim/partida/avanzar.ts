import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import { naveContraria, type EntradaDeTurno, type EstadoNave, type EstadoPartida, type IdNave } from "@/sim/partida/tipos";

// Franja de "suelo" plana cerca del borde inferior del mundo: este bloque
// (nucleo-turnos) no tiene terreno real todavía -- esa es la colisión
// contra la máscara que añade balistica-armas, sustituyendo esta condición
// de parada sin tocar integrarPasoProyectil ni simularVuelo. Sirve solo
// para poder resolver un turno completo y probar el motor de turnos antes
// de que el terreno y el catálogo de armas existan.
const MARGEN_SUELO_REFERENCIA = 60;
const ALTURA_DISPARO_SOBRE_SUELO = 30;

const POTENCIA_MINIMA_PX_S = 300;
const POTENCIA_MAXIMA_PX_S = 1400;

// Generoso a propósito para que este bloque pueda probar el motor de
// turnos sin depender todavía de un solucionador balístico (eso es
// ia-personalidades): con este radio, un disparo razonablemente apuntado
// hace daño real. El catálogo de armas del bloque balistica-armas sustituye
// este único perfil por sus diez propios.
const RADIO_IMPACTO_REFERENCIA_PX = 260;
const DANIO_MAXIMO_REFERENCIA = 34;

function alturaSuelo(altoMundo: number): number {
  return altoMundo - MARGEN_SUELO_REFERENCIA;
}

function velocidadDesdePotencia(potencia: number): number {
  const p = Math.min(100, Math.max(0, potencia)) / 100;
  return POTENCIA_MINIMA_PX_S + p * (POTENCIA_MAXIMA_PX_S - POTENCIA_MINIMA_PX_S);
}

function danioReferenciaPorDistancia(distanciaAlObjetivo: number): number {
  if (distanciaAlObjetivo >= RADIO_IMPACTO_REFERENCIA_PX) {
    return 0;
  }
  const proporcion = 1 - distanciaAlObjetivo / RADIO_IMPACTO_REFERENCIA_PX;
  return Math.round(DANIO_MAXIMO_REFERENCIA * proporcion);
}

function conIntegridad(nave: EstadoNave, integridad: number): EstadoNave {
  return { x: nave.x, integridad: Math.min(100, Math.max(0, integridad)) };
}

// El núcleo de este bloque, con la firma que describe la arquitectura del
// diseño: avanzar(estado, entradaDeTurno) -> (estadoNuevo, eventos[]). Pura
// y determinista -- nada de azar fuera del generador con semilla, nada de
// Date.now, nada de I/O -- que es la única razón por la que este producto
// tiene criterios que pueden fallar de verdad en un test de Node (nucleo-1,
// nucleo-2, nucleo-4, nucleo-5).
export function avanzar(
  estado: EstadoPartida,
  entrada: EntradaDeTurno,
): { estado: EstadoPartida; eventos: EventoSimulacion[] } {
  if (estado.resultado.tipo === "terminada") {
    throw new Error("avanzar: la partida ya ha terminado, no admite más turnos");
  }

  const tirador: IdNave = estado.turno;
  const objetivoId: IdNave = naveContraria(tirador);
  const eventos: EventoSimulacion[] = [
    {
      tipo: "disparo",
      nave: tirador,
      arma: entrada.arma,
      anguloGrados: entrada.anguloGrados,
      potencia: entrada.potencia,
    },
  ];

  const rad = (entrada.anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(entrada.potencia);
  const origenX = estado.naves[tirador].x;
  const origenY = alturaSuelo(estado.mundo.alto) - ALTURA_DISPARO_SOBRE_SUELO;
  const inicial = crearProyectil(origenX, origenY, v * Math.cos(rad), -v * Math.sin(rad));

  const sueloY = alturaSuelo(estado.mundo.alto);
  const { proyectil } = simularVuelo(inicial, estado.mundo.gravedad, estado.mundo.deriva, (p) => p.y >= sueloY);

  const objetivo = estado.naves[objetivoId];
  const distancia = Math.abs(proyectil.x - objetivo.x);
  const danio = danioReferenciaPorDistancia(distancia);

  eventos.push({ tipo: "impacto", x: proyectil.x, y: proyectil.y, objetivo: objetivoId, danio });

  const objetivoTrasImpacto = conIntegridad(objetivo, objetivo.integridad - danio);
  const naves: [EstadoNave, EstadoNave] =
    objetivoId === 0 ? [objetivoTrasImpacto, estado.naves[1]] : [estado.naves[0], objetivoTrasImpacto];

  if (objetivoTrasImpacto.integridad <= 0) {
    eventos.push({ tipo: "partida-fin", ganador: tirador });
    return {
      estado: {
        ...estado,
        naves,
        resultado: { tipo: "terminada", ganador: tirador },
      },
      eventos,
    };
  }

  eventos.push({ tipo: "turno-fin", siguienteTurno: objetivoId });
  return {
    estado: {
      ...estado,
      naves,
      turno: objetivoId,
      numeroTurno: estado.numeroTurno + 1,
    },
    eventos,
  };
}
