import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { sortearEvento, type ContextoSorteo } from "@/sim/universo/calendario";
import type { EventoProgramado } from "@/sim/universo/tipos";

// Regla B de Adrián: cada disparo gratis del modo presupuesto tiene un 25 % de
// provocar un evento extra, penalización suave por no pagar.
export const PROBABILIDAD_EVENTO_GRATIS = 0.25;

// El evento sale uniforme entre todos los disponibles y le cae a una nave viva
// al azar, el tirador incluido. No toca el calendario: es el riesgo que se
// elige al usar el arma, no un anuncio.
export function sortearEventoGratis(
  aleatorio: EstadoAleatorio,
  contexto: ContextoSorteo,
): { evento: EventoProgramado | null; aleatorio: EstadoAleatorio } {
  const tirada = siguienteAleatorio(aleatorio);
  if (tirada.valor >= PROBABILIDAD_EVENTO_GRATIS) return { evento: null, aleatorio: tirada.estado };
  return sortearEvento(tirada.estado, contexto, 0);
}
