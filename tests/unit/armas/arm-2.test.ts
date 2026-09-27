import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";

// arm-2: cada eje nuevo toma al menos dos valores distintos en el catálogo.
// Ausente cuenta como su valor por defecto (0 / false / {1,0}), igual que lo
// lee resolver.ts -- así el test no exige que TODA arma declare TODOS los
// ejes para poder contarlos.
function valoresDe<T>(seleccionar: (arma: (typeof CATALOGO_ARMAS)[number]) => T): Set<T> {
  return new Set(CATALOGO_ARMAS.map(seleccionar));
}

test("arm-2: cada eje nuevo (coste, penetración, dispersión, ráfaga, radio de daño, inmunidad a gravedad) toma al menos dos valores", () => {
  const coste = valoresDe((a) => a.coste ?? 0);
  const penetracion = valoresDe((a) => a.penetracionPx ?? 0);
  const dispersion = valoresDe((a) => a.dispersionGrados ?? 0);
  const rafagaCantidad = valoresDe((a) => a.disparosSimultaneos?.cantidad ?? 1);
  const radioDanio = valoresDe((a) => (a.efecto.tipo === "danio" || a.efecto.tipo === "danio-y-autodanio" ? a.efecto.radioEfectoPx : -1));
  const inmunidad = valoresDe((a) => a.inmuneAGravedad ?? false);

  assert.ok(coste.size >= 2, `coste solo tiene ${coste.size} valor(es) distintos`);
  assert.ok(penetracion.size >= 2, `penetración solo tiene ${penetracion.size} valor(es) distintos`);
  assert.ok(dispersion.size >= 2, `dispersión solo tiene ${dispersion.size} valor(es) distintos`);
  assert.ok(rafagaCantidad.size >= 2, `ráfaga solo tiene ${rafagaCantidad.size} valor(es) distintos`);
  assert.ok(radioDanio.size >= 2, `radio de daño solo tiene ${radioDanio.size} valor(es) distintos`);
  assert.ok(inmunidad.size >= 2, `inmunidad a gravedad solo tiene ${inmunidad.size} valor(es) distintos`);
});

test("arm-2: no hay dos armas con el mismo vector de características", () => {
  const vectores = CATALOGO_ARMAS.map((a) =>
    JSON.stringify({
      comportamiento: a.comportamiento,
      huella: a.huella,
      efecto: a.efecto,
      fiabilidad: a.fiabilidad,
      coste: a.coste ?? 0,
      penetracionPx: a.penetracionPx ?? 0,
      dispersionGrados: a.dispersionGrados ?? 0,
      disparosSimultaneos: a.disparosSimultaneos ?? { cantidad: 1, aperturaGrados: 0 },
      inmuneAGravedad: a.inmuneAGravedad ?? false,
    }),
  );
  const unicos = new Set(vectores);
  assert.equal(unicos.size, vectores.length, "hay al menos dos armas con el mismo vector de características");
});
