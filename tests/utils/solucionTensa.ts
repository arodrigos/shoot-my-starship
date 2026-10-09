import { resolverSolucionesBalisticas, type SolucionBalistica } from "@/sim/balistica/solucionador";
import { GRAVEDAD_REFERENCIA_PX_S2 } from "@/sim/fisica/proyectil";
import { POTENCIA_MAXIMA_PX_S } from "@/sim/balistica/potencia";
import { ALTURA_CANON_PX } from "@/sim/armas/resolver";

// Holgura que se deja entre el vértice de la parábola y el borde superior del
// mundo, para no rozar el margen por el que un tiro se pierde.
const HOLGURA_SUPERIOR_PX = 40;

// A potencia máxima el mortero sube más que el mundo y, desde que un tiro se
// pierde al cruzar el margen por arriba, sale de la pantalla antes de caer.
// Estos tests quieren un tiro que llegue al objetivo, así que bajan la
// velocidad hasta que el vértice cabe sobre el suelo del fixture y, si ni así,
// usan la raíz tendida. Los tests de armas pasan (0, 0) para decir "a ras de
// suelo": se traduce a la salida real del cañón y al suelo del fixture.
export function solucionTensa(
  origenX: number,
  origenY: number,
  objetivoX: number,
  objetivoY: number,
  gravedad: number,
  suelo: number = 900,
): SolucionBalistica {
  if (origenY === 0 && objetivoY === 0) {
    origenY = suelo - ALTURA_CANON_PX;
    objetivoY = suelo;
  }
  const g = gravedad * GRAVEDAD_REFERENCIA_PX_S2;
  for (let fraccion = 1; fraccion >= 0.3; fraccion -= 0.02) {
    const v = POTENCIA_MAXIMA_PX_S * fraccion;
    // La raíz 0 es el mortero: acierta con precisión en estos fixtures (la
    // tendida a velocidad máxima se pasa por la integración).
    const [mortero] = resolverSolucionesBalisticas(origenX, origenY, objetivoX, objetivoY, gravedad, v);
    if (mortero === undefined) continue;
    const vy = v * Math.sin((mortero.anguloGrados * Math.PI) / 180);
    if ((vy * vy) / (2 * g) <= origenY - HOLGURA_SUPERIOR_PX) return mortero;
  }
  const soluciones = resolverSolucionesBalisticas(origenX, origenY, objetivoX, objetivoY, gravedad);
  const tendida = soluciones[soluciones.length - 1];
  if (tendida === undefined) throw new Error("sin solución balística para el fixture");
  return tendida;
}
