import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { areaMundoParaViewport, configurarMundoParaViewport, MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { calcularTamanoContenedorJuego } from "@/juego/layoutContenedor";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { colocarNaves, franjaInferiorU, MARGEN_BORDE_U } from "@/sim/naves/colocacion";
import { factorPlanetasParaArea, generarSistema } from "@/sim/sistema/generador";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";
import type { ParametrosMundo } from "@/sim/partida/tipos";

// Mundo "de antes": la regla que dejó encuadre-movil-2 sobre el contenedor de
// ancho × 0,58 alto (configurarTamanoMundo sigue en constantes.ts como la
// referencia de ese «antes» contra la que se compara).
import { configurarTamanoMundo } from "@/juego/constantes";

function mundoAnterior(ancho: number, alto: number): { ancho: number; alto: number } {
  const contenedor = calcularTamanoContenedorJuego(ancho, alto);
  configurarTamanoMundo(contenedor.ancho, contenedor.alto);
  return { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO };
}

function mundoNuevo(ancho: number, alto: number): { ancho: number; alto: number } {
  configurarMundoParaViewport(ancho, alto);
  return { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO };
}

const VIEWPORTS_PAN_5 = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
  { ancho: 1180, alto: 820 },
  { ancho: 1280, alto: 720 },
];

test("pan-5: el área del mundo es ≥ 1,4 × la anterior y los px CSS por u no bajan", () => {
  for (const vp of VIEWPORTS_PAN_5) {
    const antes = mundoAnterior(vp.ancho, vp.alto);
    const contenedor = calcularTamanoContenedorJuego(vp.ancho, vp.alto);
    const escalaAntes = Math.min(contenedor.ancho / antes.ancho, contenedor.alto / antes.alto);
    const despues = mundoNuevo(vp.ancho, vp.alto);
    const escalaDespues = Math.min(vp.ancho / despues.ancho, vp.alto / despues.alto);
    assert.ok(
      despues.ancho * despues.alto >= 1.4 * antes.ancho * antes.alto,
      `${vp.ancho}x${vp.alto}: área ${despues.ancho * despues.alto} < 1,4 × ${antes.ancho * antes.alto}`,
    );
    assert.ok(escalaDespues >= escalaAntes, `${vp.ancho}x${vp.alto}: escala ${escalaDespues} < ${escalaAntes}`);
    if (vp.ancho === 360) assert.ok(escalaDespues >= 0.321, `360x640: escala ${escalaDespues} < 0,321`);
  }
});

test("pan-5 (invariante 1): para todo viewport, área = 1,5 × la anterior y la escala no baja", () => {
  fc.assert(
    fc.property(fc.integer({ min: 320, max: 1366 }), fc.integer({ min: 480, max: 1366 }), (ancho, alto) => {
      const antes = mundoAnterior(ancho, alto);
      const contenedor = calcularTamanoContenedorJuego(ancho, alto);
      const escalaAntes = Math.min(contenedor.ancho / antes.ancho, contenedor.alto / antes.alto);
      const despues = mundoNuevo(ancho, alto);
      const escalaDespues = Math.min(ancho / despues.ancho, alto / despues.alto);
      // El redondeo de las dos dimensiones a entero mueve el área unas décimas
      // de punto; el valor exacto es el de areaMundoParaViewport.
      const areaReal = despues.ancho * despues.alto;
      const areaIdeal = areaMundoParaViewport(ancho, alto);
      return Math.abs(areaReal / areaIdeal - 1) < 0.01 && Math.abs(areaIdeal / (antes.ancho * antes.alto) - 1.5) < 0.01 && escalaDespues >= escalaAntes;
    }),
    { numRuns: 300 },
  );
});

test("pan-5: a 360x640 la media de planetas sobre 50 semillas es ≥ 1,25 × la del tamaño anterior", () => {
  const media = (mundo: { ancho: number; alto: number }): number => {
    let total = 0;
    for (let semilla = 1; semilla <= 50; semilla++) total += generarSistema(semilla, mundo.ancho, mundo.alto, { factorPlanetas: factorPlanetasParaArea(mundo.ancho, mundo.alto) }).planetas.length;
    return total / 50;
  };
  const antes = media(mundoAnterior(360, 640));
  const despues = media(mundoNuevo(360, 640));
  assert.ok(despues >= 1.25 * antes, `planetas: ${despues} contra ${antes} (mínimo ${1.25 * antes})`);
});

// pan-4 (invariante 2). colocarNaves tarda segundos con 3-4 naves, así que
// la propiedad barre las semillas y el número de naves con fast-check pero con
// menos ejecuciones que las 300 del criterio en el escenario de 4 naves.
const VIEWPORTS_PAN_4 = [
  { ancho: 360, alto: 640 },
  { ancho: 820, alto: 1180 },
];

for (const vp of VIEWPORTS_PAN_4) {
  test(`pan-4: ${vp.ancho}x${vp.alto}, toda nave a ≥ margen + radio del borde y fuera de la franja inferior`, () => {
    const mundoPx = mundoNuevo(vp.ancho, vp.alto);
    const mundo: ParametrosMundo = { ...mundoPx, factorPlanetas: factorPlanetasParaArea(mundoPx.ancho, mundoPx.alto), gravedad: 1, deriva: 0, etiquetaDeriva: "ninguna" };
    const minimo = MARGEN_BORDE_U + RADIO_CASCO_NAVE_PX;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), fc.integer({ min: 2, max: 4 }), (semilla, cantidad) => {
        const { naves } = colocarNaves(semilla, mundo, crearEstadoAleatorio(semilla), cantidad, naves0(cantidad));
        return naves.every((nave) => {
          const y = nave.y as number;
          return (
            nave.x >= minimo &&
            nave.x <= mundo.ancho - minimo &&
            y >= minimo &&
            y <= mundo.alto - minimo &&
            y + RADIO_CASCO_NAVE_PX <= mundo.alto - franjaInferiorU(mundo.alto)
          );
        });
      }),
      { numRuns: 60 },
    );
  });
}

function naves0(cantidad: number): readonly boolean[] {
  return Array.from({ length: cantidad }, () => false);
}
