import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { FACILIDAD_MEDIDA_PCT } from "@/sim/armas/facilidadMedida";
import type { Arma } from "@/sim/armas/tipos";
import type { Personalidad } from "@/sim/ia/tipos";
import { armaEfectiva, costeArma } from "@/sim/partida/economia";

// Gasto medio de ahorro: la ahorradora reparte el saldo como si le quedaran
// como mucho 12 turnos propios, y nunca menos de uno.
const TURNOS_DE_REFERENCIA_AHORRO = 12;
const PROBABILIDAD_PAGO_MIXTA = 0.5;

export interface CompraIA {
  readonly armaId: string;
  readonly aleatorio: EstadoAleatorio;
}

function haceDanio(arma: Arma): boolean {
  return arma.efecto.tipo !== "empuje" && arma.efecto.danioMaximo > 0;
}

function agotada(arma: Arma, usosPorArma: Readonly<Record<string, number>>): boolean {
  return arma.usosMaximos !== undefined && (usosPorArma[arma.id] ?? 0) >= arma.usosMaximos;
}

// Daño esperado por disparo: el daño máximo ponderado por la facilidad medida
// de acertar y por la fiabilidad. Es la misma medida que usó el reprecio, así
// «mejor daño por crédito» significa lo mismo para la IA que para el precio.
function danioEsperado(arma: Arma): number {
  if (arma.efecto.tipo === "empuje") return 0;
  return arma.efecto.danioMaximo * ((FACILIDAD_MEDIDA_PCT[arma.id] ?? 0) / 100) * arma.fiabilidad;
}

// La gratis de reserva: la primera con daño de su orden de preferencia, para
// que quien no puede pagar siga haciendo algo útil en vez de fallar el turno.
function gratisDeReserva(personalidad: Personalidad): string {
  const enOrden = personalidad.ordenPreferenciaArmas.map(buscarArma).filter((arma) => costeArma(arma) === 0);
  const elegida = enOrden.find(haceDanio) ?? enOrden[0];
  return elegida.id;
}

// Decide qué arma «compra» la IA este turno con su saldo. Pura y determinista:
// la misma semilla con el mismo estado da la misma elección. Solo considera
// armas de la lista de preferencia de la personalidad y de pago con daño: las
// utilitarias no son una compra de ataque.
export function decidirCompraTurno(
  personalidad: Personalidad,
  saldo: number,
  turnoPropio: number,
  aleatorio: EstadoAleatorio,
  usosPorArma: Readonly<Record<string, number>> = {},
): CompraIA {
  const asequibles = personalidad.ordenPreferenciaArmas
    .map((id) => armaEfectiva(buscarArma(id), true))
    .filter((arma) => costeArma(arma) > 0 && costeArma(arma) <= saldo && haceDanio(arma) && !agotada(arma, usosPorArma));
  const reserva = gratisDeReserva(personalidad);

  if (personalidad.id === "almirante-bisagra") {
    // El reduce conserva la primera de su orden entre las de igual precio.
    const cara = asequibles.reduce<Arma | null>((mejor, arma) => (mejor === null || costeArma(arma) > costeArma(mejor) ? arma : mejor), null);
    return { armaId: cara?.id ?? reserva, aleatorio };
  }

  if (personalidad.id === "la-contable") {
    const techo = saldo / Math.max(1, TURNOS_DE_REFERENCIA_AHORRO - turnoPropio);
    const dentro = asequibles.filter((arma) => costeArma(arma) <= techo);
    const mejor = dentro.reduce<Arma | null>(
      (actual, arma) => (actual === null || danioEsperado(arma) / costeArma(arma) > danioEsperado(actual) / costeArma(actual) ? arma : actual),
      null,
    );
    return { armaId: mejor?.id ?? reserva, aleatorio };
  }

  // Mixta (Chispa): una moneda decide entre pagar y quedarse en las gratis.
  const paso = siguienteAleatorio(aleatorio);
  const pagada = paso.valor < PROBABILIDAD_PAGO_MIXTA ? asequibles[0] : undefined;
  return { armaId: pagada?.id ?? reserva, aleatorio: paso.estado };
}
