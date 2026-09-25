import { GRAVEDAD_REFERENCIA_PX_S2 } from "@/sim/fisica/proyectil";
import { potenciaDesdeVelocidad, POTENCIA_MAXIMA_PX_S } from "@/sim/balistica/potencia";

export interface SolucionBalistica {
  readonly anguloGrados: number;
  readonly potencia: number;
}

// Fórmula cerrada del alcance con diferencia de altura, resuelta para el
// ángulo con la potencia FIJA en POTENCIA_MAXIMA_PX_S -- fijar la potencia es
// lo que permite dar DOS raíces de ÁNGULO (mortero alto y tiro tenso) en vez
// de una familia infinita de pares (ángulo, potencia). SOLO es exacta con
// deriva 0: es la mitad "solución balística exacta" de la IA de dos capas
// del diseño (armas-7 la ejercita variando gravedad, no deriva); envolverla
// en error de puntería y en una política de arma/objetivo con personalidad
// es ia-personalidades, que reutiliza esta misma función en vez de
// reescribir la fórmula.
//
// velocidadPxS es opcional (por defecto POTENCIA_MAXIMA_PX_S, el mismo
// comportamiento de siempre para ia-personalidades y el resto de llamadas
// existentes): humor-sistemico lo usa con la potencia REAL de un disparo ya
// hecho para clasificar si su ángulo se aleja mucho de la solución exacta a
// esa potencia, sin duplicar esta fórmula en otro fichero.
export function resolverSolucionesBalisticas(
  origenX: number,
  origenY: number,
  objetivoX: number,
  objetivoY: number,
  gravedad: number,
  velocidadPxS: number = POTENCIA_MAXIMA_PX_S,
): SolucionBalistica[] {
  const g = gravedad * GRAVEDAD_REFERENCIA_PX_S2;
  const v = velocidadPxS;
  const distanciaX = objetivoX - origenX;
  const distancia = Math.abs(distanciaX);
  if (distancia < 1e-6) {
    return [];
  }
  const dirX = Math.sign(distanciaX);
  // h > 0 si el objetivo está más abajo que el origen (y crece hacia abajo).
  const h = objetivoY - origenY;

  // Cuadrática en u = tan(theta): a*u² + b*u + c = 0, derivada de
  // h = -D*tan(theta) + (g*D²)/(2*v²)*(1 + tan²(theta)).
  const a = (g * distancia * distancia) / (2 * v * v);
  const b = -distancia;
  const c = a - h;
  const discriminante = b * b - 4 * a * c;
  if (a === 0 || discriminante < 0) {
    return [];
  }

  const raiz = Math.sqrt(discriminante);
  const potencia = potenciaDesdeVelocidad(v);
  const soluciones: SolucionBalistica[] = [];

  for (const signo of [1, -1] as const) {
    const u = (-b + signo * raiz) / (2 * a);
    const thetaLocalGrados = (Math.atan(u) * 180) / Math.PI;
    // anguloGrados sigue la convención de EntradaDeTurno (0 = +x, 90 =
    // vertical, 180 = -x): si el objetivo está a la izquierda, el ángulo
    // efectivo es el espejo respecto a 90.
    const anguloGrados = dirX >= 0 ? thetaLocalGrados : 180 - thetaLocalGrados;
    if (anguloGrados >= 0 && anguloGrados <= 180) {
      soluciones.push({ anguloGrados, potencia });
    }
  }

  return soluciones;
}
