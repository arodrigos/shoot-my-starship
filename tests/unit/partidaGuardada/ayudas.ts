import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { avanzar } from "@/sim/partida/avanzar";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { PERSONALIDADES } from "@/sim/ia/personalidades";
import { colocarNaves } from "@/sim/naves/colocacion";
import { factorPlanetasParaArea } from "@/sim/sistema/generador";
import { estadisticasIniciales } from "@/sim/partida/parteDeGuerra";
import { memoriaIAInicial, type JugadorConfig, type MemoriaIA } from "@/juego/jugadores";
import type { DatosPartida } from "@/juego/partidaGuardada/tipos";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";

export const SEMILLA = 20260926;

export const JUGADORES: readonly JugadorConfig[] = [
  { nombre: "Ana", tipo: "humano" },
  { nombre: "Luis", tipo: "humano" },
  { nombre: "Chispa", tipo: "ia", personalidadId: PERSONALIDADES[2].id, nivel: "normal" },
  { nombre: "La Contable", tipo: "ia", personalidadId: PERSONALIDADES[0].id, nivel: "dificil" },
];

// Mismo ensamblado que Partida.ts en modo espacial, sin Phaser.
export function partidaInicial(ancho: number, alto: number, modo: "barra-libre" | "presupuesto" = "barra-libre"): EstadoPartida {
  const mundo: ParametrosMundo = {
    ancho,
    alto,
    gravedad: 0,
    deriva: 0,
    etiquetaDeriva: "Vacío",
    factorPlanetas: factorPlanetasParaArea(ancho, alto),
  };
  const colocacion = colocarNaves(SEMILLA, mundo, crearEstadoAleatorio(SEMILLA), 4, JUGADORES.map((j) => j.tipo === "ia"));
  return {
    version: 1,
    mundo,
    mascara: colocacion.sistema.mascara,
    naves: colocacion.naves,
    ordenTurno: colocacion.naves.map((_n, id) => id),
    turno: 0,
    numeroTurno: 0,
    aleatorio: colocacion.aleatorio,
    resultado: { tipo: "en-curso" },
    planetas: colocacion.sistema.planetas,
    modo,
  };
}

// Las cuatro naves las juega una IA determinista: es lo más parecido a una
// partida real que se puede correr en Node.
export function jugar(estadoInicial: EstadoPartida, turnos: number): { estado: EstadoPartida; memorias: (MemoriaIA | null)[] } {
  const memorias: (MemoriaIA | null)[] = JUGADORES.map(() => memoriaIAInicial());
  let estado = estadoInicial;
  for (let t = 0; t < turnos && estado.resultado.tipo === "en-curso"; t += 1) {
    const memoria = memorias[estado.turno] as MemoriaIA;
    const personalidad = PERSONALIDADES[estado.turno % PERSONALIDADES.length];
    const fuente = crearFuenteIA(personalidad, memoria.ultimoIntento, memoria.usosPorArma);
    const tirador = estado.turno;
    const { entrada, estado: decidido } = fuente(estado);
    const resultado = avanzar(decidido, entrada);
    memoria.usosPorArma = { ...memoria.usosPorArma, [entrada.arma]: (memoria.usosPorArma[entrada.arma] ?? 0) + 1 };
    memoria.ultimoIntento = { distanciaAlObjetivoPx: 100 + tirador, fallosConsecutivos: t % 3 };
    estado = resultado.estado;
  }
  return { estado, memorias };
}

export function datosDe(estado: EstadoPartida, memorias: (MemoriaIA | null)[], relojTurnoS: 30 | 45 | 60 | null = 45): DatosPartida {
  return {
    estado,
    config: { jugadores: JUGADORES, modo: estado.modo ?? "barra-libre", todosVemosTodo: false, semillaSistema: SEMILLA, mapaId: null, relojTurnoS },
    cascara: {
      memoriasIA: memorias.map((m, i) => (JUGADORES[i].tipo === "ia" ? m : null)),
      estadisticas: { ...estadisticasIniciales(), disparos: 12, fallos: 5 },
    },
  };
}

// avanzar() deja claves con undefined explícito (saldos, universo) que JSON no
// conserva: "igual en profundidad" significa mismos valores, no mismas claves vacías.
export function sinClavesUndefined<T>(valor: T): T {
  if (valor instanceof Uint8Array) return valor;
  if (Array.isArray(valor)) return valor.map(sinClavesUndefined) as unknown as T;
  if (typeof valor === "object" && valor !== null) {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, sinClavesUndefined(v)]),
    ) as T;
  }
  return valor;
}
