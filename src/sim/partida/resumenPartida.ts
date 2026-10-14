import { crearEstadoAleatorio, siguienteAleatorio } from "@/sim/aleatorio";
import { NOMBRE_TU_NAVE, PLANTILLAS_RESUMEN, type SituacionResumen } from "@/contenido/resumenesPartida";
import { RONDA_MUERTE_SUBITA } from "@/sim/partida/muerteSubita";

// voz-resumenes: cada cuántos turnos resueltos habla el locutor de partida.
export const TURNOS_ENTRE_RESUMENES = 3;
export const LONGITUD_MAXIMA_RESUMEN = 140;
// Un resumen no se repite hasta pasados cinco.
export const MEMORIA_PLANTILLAS = 5;
const LONGITUD_MAXIMA_NOMBRE = 14;
const RACHA_MINIMA = 3;
const VENTAJA_CLARA = 40;
const RONDAS_DE_AVISO = 2;

export interface AsientoResumen {
  readonly nombre: string;
  readonly integridad: number;
  readonly fallosSeguidos: number;
  // undefined fuera del modo presupuesto.
  readonly credito?: number;
  readonly viva: boolean;
  // Es el humano local único: el texto le habla a él («Te desplazaron»).
  readonly esYo?: boolean;
  // La nave acabó el turno desplazada por un impacto.
  readonly desplazada?: boolean;
}

export interface EntradaResumen {
  readonly asientos: readonly AsientoResumen[];
  readonly ronda: number;
  // Ids ("situacion:indice") de los resúmenes anteriores, el último al final.
  readonly recientes: readonly string[];
  // Solo para el gancho de pruebas: fija la situación en vez de sortearla.
  readonly situacionForzada?: SituacionResumen;
}

export interface Resumen {
  readonly texto: string;
  readonly plantilla: string;
}

export function tocaResumen(turnosResueltos: number): boolean {
  return turnosResueltos > 0 && turnosResueltos % TURNOS_ENTRE_RESUMENES === 0;
}

function recortarNombre(nombre: string): string {
  const limpio = nombre.trim() === "" ? "Alguien" : nombre.trim();
  return limpio.length > LONGITUD_MAXIMA_NOMBRE ? `${limpio.slice(0, LONGITUD_MAXIMA_NOMBRE - 1)}…` : limpio;
}

function situacionesPosibles(entrada: EntradaResumen, enCabeza: readonly AsientoResumen[], ventaja: number): { situacion: SituacionResumen; otro?: AsientoResumen }[] {
  if (enCabeza.length > 1) return [{ situacion: "empate" }];
  const vivas = entrada.asientos.filter((asiento) => asiento.viva);
  const lista: { situacion: SituacionResumen; otro?: AsientoResumen }[] = [];
  const racha = vivas.filter((asiento) => asiento.fallosSeguidos >= RACHA_MINIMA).sort((a, b) => b.fallosSeguidos - a.fallosSeguidos)[0];
  if (racha) lista.push({ situacion: "racha-fallos", otro: racha });
  const sinCredito = vivas.find((asiento) => asiento.credito !== undefined && asiento.credito <= 0);
  if (sinCredito) lista.push({ situacion: "sin-credito", otro: sinCredito });
  if (entrada.ronda >= RONDA_MUERTE_SUBITA - RONDAS_DE_AVISO) lista.push({ situacion: "muerte-subita" });
  const desplazada = entrada.asientos.find((asiento) => asiento.desplazada);
  if (desplazada) lista.push({ situacion: "desplazada", otro: desplazada });
  lista.push({ situacion: ventaja >= VENTAJA_CLARA ? "lider-claro" : "reñido" });
  return lista;
}

// Pura: mismo estado y misma semilla dan el mismo texto. Todas las plantillas
// con líder lo nombran y las de empate dicen «empate»: es la invariante que
// comprueba el property test.
export function resumenPartida(entrada: EntradaResumen, semilla: number): Resumen {
  const vivas = entrada.asientos.filter((asiento) => asiento.viva);
  const candidatas = vivas.length > 0 ? vivas : entrada.asientos;
  const maxima = Math.max(...candidatas.map((asiento) => asiento.integridad));
  const enCabeza = candidatas.filter((asiento) => asiento.integridad === maxima);
  const lider = enCabeza[0];
  const segunda = candidatas.filter((asiento) => asiento.integridad < maxima).reduce((mejor, asiento) => Math.max(mejor, asiento.integridad), 0);
  const ventaja = Math.round(maxima - segunda);

  const desplazadaForzada = entrada.situacionForzada === "desplazada" ? entrada.asientos.find((asiento) => asiento.desplazada) : undefined;
  const opciones = desplazadaForzada
    ? [{ situacion: "desplazada" as const, otro: desplazadaForzada }]
    : situacionesPosibles(entrada, enCabeza, ventaja);
  let aleatorio = crearEstadoAleatorio(semilla);
  const sorteo = (limite: number): number => {
    const paso = siguienteAleatorio(aleatorio);
    aleatorio = paso.estado;
    return Math.floor(paso.valor * limite);
  };
  const { situacion, otro } = opciones[sorteo(opciones.length)];
  const plantillas = PLANTILLAS_RESUMEN[situacion];
  const prohibidas = new Set(entrada.recientes.slice(-MEMORIA_PLANTILLAS));
  const libres = plantillas.map((_, indice) => indice).filter((indice) => !prohibidas.has(`${situacion}:${indice}`));
  const indice = libres[sorteo(libres.length)];

  const nombreDesplazada = recortarNombre(otro?.nombre ?? "");
  const valores: Record<string, string> = {
    desplazada: otro?.esYo ? "Te desplazaron" : `${nombreDesplazada} fue desplazada`,
    lider: recortarNombre(lider?.nombre ?? ""),
    vida: String(Math.round(maxima)),
    ventaja: String(ventaja),
    otro: recortarNombre(otro?.nombre ?? ""),
    n: String(otro?.fallosSeguidos ?? 0),
  };
  const texto = plantillas[indice]
    .replace(/\{(\w+)\}/g, (_, clave: string) => valores[clave] ?? "")
    // «Tu nave» va en minúscula salvo al empezar frase: «Racha de 3 fallos para tu nave».
    .replace(new RegExp(`(?<!^|[.!?¡¿]\\s)${NOMBRE_TU_NAVE}`, "g"), NOMBRE_TU_NAVE.toLowerCase());
  return { texto, plantilla: `${situacion}:${indice}` };
}
