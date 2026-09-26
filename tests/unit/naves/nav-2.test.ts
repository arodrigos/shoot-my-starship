import { test } from "node:test";
import assert from "node:assert/strict";
import { generarSistema } from "@/sim/sistema/generador";
import { esSolido } from "@/sim/terreno/mascara";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import {
  colocarNaves,
  HOLGURA_SOLIDO_NAVE_PX,
  MARGEN_MUNDO_NAVE_PX,
  SEPARACION_MINIMA_NAVES_PX,
} from "@/sim/naves/colocacion";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

const NUM_SEMILLAS = 500;
const MUNDO: ParametrosMundo = {
  ancho: MUNDO_ANCHO,
  alto: MUNDO_ALTO,
  gravedad: 1,
  deriva: 0,
  etiquetaDeriva: "ninguna",
};

// Comprobación independiente de la que usa colocarNaves por dentro: recorre
// la máscara de verdad en vez de confiar en la misma función que coloca, o
// el test solo demostraría que la función está de acuerdo consigo misma.
function distanciaAlSolidoMasCercano(mascara: Mascara, x: number, y: number, limite: number): number {
  const cx = Math.round(x);
  const cy = Math.round(y);
  let minimo = Infinity;
  for (let dy = -limite; dy <= limite; dy++) {
    for (let dx = -limite; dx <= limite; dx++) {
      if (esSolido(mascara, cx + dx, cy + dy)) {
        minimo = Math.min(minimo, Math.hypot(dx, dy));
      }
    }
  }
  return minimo;
}

test("nav-2: 500 semillas, colocación siempre válida (holgura de sólido, separación y margen de mundo)", () => {
  for (let semilla = 0; semilla < NUM_SEMILLAS; semilla++) {
    const sistema = generarSistema(semilla, MUNDO_ANCHO, MUNDO_ALTO);
    const { naves } = colocarNaves(sistema, MUNDO, crearEstadoAleatorio(semilla));

    for (const [indice, nave] of naves.entries()) {
      assert.ok(nave.y !== undefined, `semilla ${semilla}: nave ${indice} sin y`);

      const distanciaSolido = distanciaAlSolidoMasCercano(
        sistema.mascara,
        nave.x,
        nave.y as number,
        HOLGURA_SOLIDO_NAVE_PX + 1,
      );
      assert.ok(
        distanciaSolido >= HOLGURA_SOLIDO_NAVE_PX,
        `semilla ${semilla}: nave ${indice} a ${distanciaSolido}px de un sólido, mínimo ${HOLGURA_SOLIDO_NAVE_PX}`,
      );

      assert.ok(
        nave.x >= MARGEN_MUNDO_NAVE_PX && nave.x <= MUNDO_ANCHO - MARGEN_MUNDO_NAVE_PX,
        `semilla ${semilla}: nave ${indice} fuera del margen de mundo en x=${nave.x}`,
      );
      assert.ok(
        (nave.y as number) >= MARGEN_MUNDO_NAVE_PX && (nave.y as number) <= MUNDO_ALTO - MARGEN_MUNDO_NAVE_PX,
        `semilla ${semilla}: nave ${indice} fuera del margen de mundo en y=${nave.y}`,
      );
    }

    const [a, b] = naves;
    const separacion = Math.hypot(a.x - b.x, (a.y as number) - (b.y as number));
    assert.ok(
      separacion >= SEPARACION_MINIMA_NAVES_PX,
      `semilla ${semilla}: naves a ${separacion}px, mínimo ${SEPARACION_MINIMA_NAVES_PX}`,
    );
  }
});
