import { createHash } from "node:crypto";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { barridoRejilla, RANGO_ANGULOS_JUGADOR } from "@/sim/balistica/rejilla";
import { colocarNaves } from "@/sim/naves/colocacion";
import { avanzar } from "@/sim/partida/avanzar";
import { serializarEstado } from "@/sim/partida/serializacion";
import type { EntradaDeTurno, EstadoPartida, IdNave, ParametrosMundo } from "@/sim/partida/tipos";
import { MUNDO_ALTO, MUNDO_ANCHO } from "./sistemaGenerado";

// Casos de equivalencia entre el turno entero y el turno partido en dos fases
// (rsp-2). Todo sale de una semilla, así que el golden de tests/unit/golden
// (tomado con el avanzar() de antes de partirlo) se puede volver a comprobar
// con cualquier implementación sin que el test guarde estados enteros.
const MUNDO: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "" };
const ARMAS = [
  "pepinazo-cortesia",
  "zanjadora-manolita",
  "vertedero-portatil",
  "racimo-de-tuppers",
  "pelota-de-chatarra",
  "graviton-segunda-mano",
  "despedida",
  "barrena-planetaria",
  "rayo-laser",
  "mosca-cojonera",
  "gancho-pegajoso",
  "minirobot-saltaplanetas",
];

// LCG propio: el caso no puede depender de Math.random ni de otro estado.
function generador(semilla: number): () => number {
  let x = (semilla * 2654435761) >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

export function estadoParaSemilla(semilla: number, numNaves: 2 | 3): EstadoPartida {
  const colocacion = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), numNaves, numNaves === 2 ? [false, false] : [false, false, false]);
  return {
    version: 1,
    mundo: MUNDO,
    mascara: colocacion.sistema.mascara,
    naves: colocacion.naves,
    ordenTurno: numNaves === 2 ? [0, 1] : [0, 1, 2],
    turno: 0,
    numeroTurno: 0,
    aleatorio: colocacion.aleatorio,
    resultado: { tipo: "en-curso" },
    planetas: colocacion.sistema.planetas,
  };
}

function objetivoVivo(estado: EstadoPartida): IdNave {
  const n = estado.naves.length;
  for (let paso = 1; paso < n; paso++) {
    const id = ((estado.turno + paso) % n) as IdNave;
    if (estado.naves[id].integridad > 0) return id;
  }
  return ((estado.turno + 1) % n) as IdNave;
}

function tiroQueAcierta(estado: EstadoPartida, armaId: string, objetivoId: IdNave): { anguloGrados: number; potencia: number } | null {
  const candidatos = barridoRejilla({
    mascara: estado.mascara,
    ancho: MUNDO.ancho,
    alto: MUNDO.alto,
    planetas: estado.planetas,
    gravedad: MUNDO.gravedad,
    deriva: MUNDO.deriva,
    aleatorio: estado.aleatorio,
    arma: buscarArma(armaId),
    naves: estado.naves.map((nave, id) => ({ id, x: nave.x, y: nave.y as number })),
    tiradorId: estado.turno,
    objetivoId,
    rangoAngulos: RANGO_ANGULOS_JUGADOR,
    presupuestoIntentos: 60,
  });
  return candidatos.length === 0 ? null : { anguloGrados: candidatos[0].anguloGrados, potencia: candidatos[0].potencia };
}

function entradaDeTurno(estado: EstadoPartida, azar: () => number, accionForzada?: "disparo" | "escudo" | "propulsores"): EntradaDeTurno {
  const objetivoId = objetivoVivo(estado);
  const dado = azar();
  const accion = accionForzada ?? (dado < 0.12 ? "escudo" : dado < 0.24 ? "propulsores" : "disparo");
  const arma = ARMAS[Math.floor(azar() * ARMAS.length)];
  const apuntado = azar() < 0.6 ? tiroQueAcierta(estado, arma, objetivoId) : null;
  const anguloGrados = apuntado?.anguloGrados ?? Math.round(azar() * 180);
  const potencia = apuntado?.potencia ?? Math.round(20 + azar() * 80);
  return { accion, arma: accion === "disparo" ? arma : "pepinazo-cortesia", anguloGrados, potencia, objetivoId };
}

export function huellaDeTurno(estado: EstadoPartida, entrada: EntradaDeTurno, jugar: typeof avanzar = avanzar): string {
  const hash = createHash("sha1");
  try {
    const r = jugar(estado, entrada);
    hash.update(serializarEstado(r.estado));
    hash.update(JSON.stringify({ eventos: r.eventos, categoriaBroma: r.categoriaBroma, detonaciones: r.detonaciones }));
  } catch (error) {
    // Rechazar el turno también es un resultado que no puede cambiar.
    hash.update(`error:${error instanceof Error ? error.message : String(error)}`);
  }
  return hash.digest("hex");
}

// Estado y entrada de un caso: de 0 a 2 turnos previos (para llegar a estados
// con robots, escudos o naves ya movidas) y el turno que se comprueba.
export function casoDeSemilla(semilla: number, jugar: typeof avanzar = avanzar): { estado: EstadoPartida; entrada: EntradaDeTurno } {
  const azar = generador(semilla);
  let estado = estadoParaSemilla(semilla, semilla % 3 === 0 ? 3 : 2);
  const previos = Math.floor(azar() * 3);
  for (let i = 0; i < previos && estado.resultado.tipo === "en-curso"; i++) {
    try {
      estado = jugar(estado, entradaDeTurno(estado, azar, i === 0 && semilla % 5 === 0 ? "disparo" : undefined)).estado;
    } catch {
      // Un previo rechazado deja el estado como estaba: el caso sigue siendo válido.
    }
  }
  if (estado.resultado.tipo === "terminada") estado = estadoParaSemilla(semilla, 2);
  return { estado, entrada: entradaDeTurno(estado, azar) };
}

// Partida de 30 turnos guionizada: devuelve la huella del estado tras cada uno.
export function huellasDePartidaGuionizada(semilla: number, turnos: number, jugar: typeof avanzar = avanzar): string[] {
  const azar = generador(semilla + 9000);
  let estado = estadoParaSemilla(semilla, 2);
  const huellas: string[] = [];
  for (let t = 0; t < turnos && estado.resultado.tipo === "en-curso"; t++) {
    const entrada = entradaDeTurno(estado, azar, t % 7 === 3 ? "escudo" : t % 7 === 5 ? "propulsores" : "disparo");
    huellas.push(huellaDeTurno(estado, entrada, jugar));
    try {
      estado = jugar(estado, entrada).estado;
    } catch {
      break;
    }
  }
  return huellas;
}
