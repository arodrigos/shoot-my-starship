import { codificarRle } from "@/juego/partidaGuardada/codecRle";
import { versionApp } from "@/juego/pwa/estadoPwa";
import type { Mascara } from "@/sim/terreno/mascara";
import { VERSION_ESQUEMA, type DatosPartida, type ResultadoLectura, type Rotulo } from "@/juego/partidaGuardada/tipos";
import { validarInstantanea } from "@/juego/partidaGuardada/validar";

// Misma fuente que __debug.pwa.version: una constante de build, no depende de
// que el service worker esté activo (los e2e lo bloquean).
export const VERSION_JUEGO = versionApp();

export function rotuloDePartida(datos: DatosPartida): Rotulo {
  const { estado, config } = datos;
  return {
    ronda: estado.ronda ?? Math.floor(estado.numeroTurno / estado.ordenTurno.length) + 1,
    nombres: config.jugadores.map((jugador) => jugador.nombre),
  };
}

function mascaraCodificada(mascara: Mascara) {
  return { ancho: mascara.ancho, alto: mascara.alto, datos: { codificacion: "rle-1", datos: codificarRle(mascara.datos) } };
}

export interface OpcionesCrear {
  readonly versionJuego?: string;
  readonly ahora?: number;
}

// La cadena es JSON puro: el Uint8Array de la máscara (y el de
// universo.mascaraInicial, que serializarEstado no cubre) se sustituye aquí
// por su RLE, así que no queda ningún valor no serializable.
export function crearInstantanea(datos: DatosPartida, opciones: OpcionesCrear = {}): string {
  const { estado } = datos;
  const estadoCodificado = {
    ...estado,
    mascara: mascaraCodificada(estado.mascara),
    ...(estado.universo ? { universo: { ...estado.universo, mascaraInicial: mascaraCodificada(estado.universo.mascaraInicial) } } : {}),
  };
  return JSON.stringify({
    version: VERSION_ESQUEMA,
    versionJuego: opciones.versionJuego ?? VERSION_JUEGO,
    guardadaEn: opciones.ahora ?? Date.now(),
    rotulo: rotuloDePartida(datos),
    config: datos.config,
    estado: estadoCodificado,
    cascara: datos.cascara,
  });
}

export function leerInstantanea(cadena: string, versionActual: string = VERSION_JUEGO): ResultadoLectura {
  return validarInstantanea(cadena, versionActual);
}
