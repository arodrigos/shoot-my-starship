import type { EventoSimulacion } from "@/sim/partida/eventos";
import type { IdNave } from "@/sim/partida/tipos";

// premios-calculo: estadísticas POR ASIENTO para el parte de guerra. Vive
// fuera de src/sim: es presentación sobre los eventos que ya emite avanzar(),
// y por eso puede ser pura y probarse en Node sin Phaser.
export interface EstadisticasAsiento {
  readonly asiento: IdNave;
  readonly disparos: number;
  readonly aciertos: number;
  readonly danioHecho: number;
  readonly danioRecibido: number;
  readonly autoimpactos: number;
  readonly bajas: number;
  readonly remateFinal: boolean;
  readonly pixelesDestruidos: number;
  readonly perdidos: number;
  readonly giroMaximoGrados: number;
  readonly vivo: boolean;
  readonly integridadFinal: number;
}

export function estadisticasAsientoIniciales(asiento: IdNave): EstadisticasAsiento {
  return {
    asiento,
    disparos: 0,
    aciertos: 0,
    danioHecho: 0,
    danioRecibido: 0,
    autoimpactos: 0,
    bajas: 0,
    remateFinal: false,
    pixelesDestruidos: 0,
    perdidos: 0,
    giroMaximoGrados: 0,
    vivo: true,
    integridadFinal: 0,
  };
}

export function estadisticasIniciales(asientos: number): EstadisticasAsiento[] {
  return Array.from({ length: asientos }, (_, i) => estadisticasAsientoIniciales(i));
}

interface Punto {
  readonly x: number;
  readonly y: number;
}

// Suma de |Δrumbo| entre segmentos consecutivos de la trayectoria. Los puntos
// repetidos se saltan: un segmento de longitud 0 no tiene rumbo y daría NaN.
// Una ida y vuelta en línea recta cuenta 180, que es lo que el jugador ve.
export function giroAcumuladoGrados(puntos: readonly Punto[]): number {
  let giro = 0;
  let rumboPrevio: number | null = null;
  for (let i = 1; i < puntos.length; i++) {
    const dx = puntos[i].x - puntos[i - 1].x;
    const dy = puntos[i].y - puntos[i - 1].y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) continue;
    const rumbo = Math.atan2(dy, dx);
    if (rumboPrevio !== null) {
      let delta = rumbo - rumboPrevio;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      giro += Math.abs(delta);
    }
    rumboPrevio = rumbo;
  }
  return (giro * 180) / Math.PI;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface ContextoTurno {
  // Integridad de cada asiento tras el turno: de ahí salen las bajas, el
  // estado final y el remate (los eventos no anuncian muertes).
  readonly integridades?: readonly number[];
  readonly pixelesDestruidos?: number;
}

// Atribuye siempre al tirador del turno (el de su evento 'disparo'); un turno
// de equipo (escudo, propulsores) no tiene disparo y solo refresca el estado.
export function acumularTurno(
  acumulado: readonly EstadisticasAsiento[],
  eventos: readonly EventoSimulacion[],
  trayectoria: readonly Punto[] | null,
  contexto: ContextoTurno = {},
): EstadisticasAsiento[] {
  const siguiente: Mutable<EstadisticasAsiento>[] = acumulado.map((e) => ({ ...e }));
  const disparo = eventos.find((e) => e.tipo === "disparo");
  const tirador = disparo?.nave;
  const de = (id: IdNave): Mutable<EstadisticasAsiento> | undefined => siguiente[id];

  let danioDelTurno = 0;
  if (tirador !== undefined && de(tirador)) {
    const yo = de(tirador)!;
    yo.disparos += 1;
    for (const e of eventos) {
      if (e.tipo === "impacto" && e.objetivo !== tirador) {
        yo.danioHecho += e.danio;
        danioDelTurno += e.danio;
        const victima = de(e.objetivo);
        if (victima) victima.danioRecibido += e.danio;
      } else if (e.tipo === "danio-colateral" && e.nave !== tirador) {
        yo.danioHecho += e.danio;
        danioDelTurno += e.danio;
        const victima = de(e.nave);
        if (victima) victima.danioRecibido += e.danio;
      } else if (e.tipo === "autoimpacto" && e.nave === tirador) {
        yo.autoimpactos += 1;
      } else if (e.tipo === "proyectil-perdido" && e.nave === tirador) {
        yo.perdidos += 1;
      }
    }
    if (danioDelTurno > 0) yo.aciertos += 1;
    yo.pixelesDestruidos += contexto.pixelesDestruidos ?? 0;
    if (trayectoria) yo.giroMaximoGrados = Math.max(yo.giroMaximoGrados, giroAcumuladoGrados(trayectoria));
  }

  let bajasDelTurno = 0;
  if (contexto.integridades) {
    siguiente.forEach((e, id) => {
      const integridad = contexto.integridades![id];
      if (integridad === undefined) return;
      if (e.vivo && integridad <= 0) {
        e.vivo = false;
        if (tirador !== undefined && id !== tirador) bajasDelTurno += 1;
      }
      e.integridadFinal = Math.max(0, integridad);
    });
    if (tirador !== undefined && de(tirador)) de(tirador)!.bajas += bajasDelTurno;
  }

  const fin = eventos.find((e) => e.tipo === "partida-fin");
  if (fin && fin.ganador !== null && fin.ganador === tirador && bajasDelTurno > 0) de(tirador)!.remateFinal = true;
  return siguiente;
}
