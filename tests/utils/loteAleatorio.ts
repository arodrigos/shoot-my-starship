import { createHash } from "node:crypto";
import { crearEstadoAleatorio, siguienteAleatorio } from "@/sim/aleatorio";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { comprobarInvariante, crearPartidaInicial, jugarPartida } from "@/sim/partida/motor";
import { generarMascara } from "@/sim/terreno/generador";
import type { Mascara } from "@/sim/terreno/mascara";
import type { EstadoPartida, FuenteDeTurno, ParametrosMundo } from "@/sim/partida/tipos";

// 960x540 y no los 1920x1080 de nucleo-2/3/6 (balistica-armas, desviación
// declarada en el entregable): con terreno real, cada disparo clona la
// máscara entera, y 500 partidas de hasta cientos de turnos cada una sobre
// un mundo a tamaño completo hacían el lote inviable en CI. El tamaño no
// afecta a lo que nucleo-4/5 comprueban (determinismo e invariantes), solo
// a cuántos píxeles hay que copiar por disparo.
export const MUNDO_LOTE: ParametrosMundo = { ancho: 960, alto: 540, gravedad: 1.0, deriva: 0, etiquetaDeriva: "lote" };
// Con disparos apuntados (en vez del ángulo puramente al azar de antes de
// este bloque) las partidas convergen mucho antes en la inmensa mayoría de
// semillas, pero el terreno real ocasionalmente entierra a una nave en mal
// sitio -- 400 no bastaba para una semilla de las 1000 probadas; 800 es el
// margen que las cubre todas sin dejar de ser una red de seguridad y no el
// desenlace normal.
export const LIMITE_TURNOS_LOTE = 800;

// Fuente que consume el generador que vive en el propio estado de la
// partida (nunca Math.random): usarla en el lote es lo que hace que
// nucleo-4 y nucleo-5 comprueben algo real, no una secuencia fija. Apunta
// con el solucionador balístico (armas-7) y le añade ruido en ángulo y
// potencia -- ni una IA perfecta ni un disparo puramente al azar, que con
// el catálogo real casi nunca conecta en un mundo de 960px de ancho.
export const fuenteAleatoria: FuenteDeTurno = (estado) => {
  const tirador = estado.naves[estado.turno];
  const objetivo = estado.naves[estado.turno === 0 ? 1 : 0];
  const soluciones = resolverSolucionesBalisticas(tirador.x, 0, objetivo.x, 0, estado.mundo.gravedad);
  const base = soluciones[0] ?? { anguloGrados: 45, potencia: 90 };

  const pasoAngulo = siguienteAleatorio(estado.aleatorio);
  const pasoPotencia = siguienteAleatorio(pasoAngulo.estado);
  const anguloGrados = Math.min(179, Math.max(1, base.anguloGrados + (pasoAngulo.valor - 0.5) * 16));
  const potencia = Math.min(100, Math.max(80, base.potencia + (pasoPotencia.valor - 0.5) * 20));

  return {
    entrada: { arma: "pepinazo-cortesia", anguloGrados, potencia },
    estado: { ...estado, aleatorio: pasoPotencia.estado },
  };
};

export interface ResultadoPartidaLote {
  readonly semilla: number;
  readonly ganador: number | null;
  readonly numeroTurno: number;
  readonly agotada: boolean;
  readonly problemas: readonly string[];
}

const NAVE0_X = 150;
const NAVE1_X = 810;

function jugarUnaPartidaDelLote(semilla: number, mascara: Mascara): ResultadoPartidaLote {
  const inicial: EstadoPartida = crearPartidaInicial(MUNDO_LOTE, mascara, NAVE0_X, NAVE1_X, semilla);
  const { estado, agotada } = jugarPartida(inicial, [fuenteAleatoria, fuenteAleatoria], LIMITE_TURNOS_LOTE);
  return {
    semilla,
    ganador: estado.resultado.tipo === "terminada" ? estado.resultado.ganador : null,
    numeroTurno: estado.numeroTurno,
    agotada,
    problemas: comprobarInvariante(estado),
  };
}

// "500 partidas con la misma semilla inicial" solo tiene un significado
// preciso si esa semilla fija el lote entero: aquí se deriva una semilla de
// partida por cada una a partir de una única semilla maestra, así que
// jugarLote(semilla, n) es en sí mismo determinista de punta a punta.
export function semillasDelLote(semillaMaestra: number, n: number): number[] {
  const semillas: number[] = [];
  let estadoAleatorio = crearEstadoAleatorio(semillaMaestra);
  for (let i = 0; i < n; i++) {
    const paso = siguienteAleatorio(estadoAleatorio);
    estadoAleatorio = paso.estado;
    semillas.push(Math.floor(paso.valor * 0xffffffff));
  }
  return semillas;
}

export function jugarLote(semillaMaestra: number, n: number): ResultadoPartidaLote[] {
  // Un único terreno para todo el lote, generado a partir de la propia
  // semilla maestra: cada partida recibe la MISMA referencia inicial, lo
  // que es seguro porque resolverDisparo nunca muta la máscara que recibe,
  // solo devuelve una copia nueva (balistica-armas). Generar 500 mundos en
  // vez de uno no aportaría nada a lo que nucleo-4/5 comprueban y multiplicaría
  // el coste del lote por 500.
  const mascara = generarMascara(semillaMaestra, MUNDO_LOTE.ancho, MUNDO_LOTE.alto);
  return semillasDelLote(semillaMaestra, n).map((semilla) => jugarUnaPartidaDelLote(semilla, mascara));
}

export function hashDeLote(lote: readonly ResultadoPartidaLote[]): string {
  return createHash("sha256").update(JSON.stringify(lote)).digest("hex");
}
