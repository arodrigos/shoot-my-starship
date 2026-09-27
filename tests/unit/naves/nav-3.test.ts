import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { existeTiroViable } from "@/sim/balistica/rejilla";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { colocarNaves } from "@/sim/naves/colocacion";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";
import type { ParametrosMundo } from "@/sim/partida/tipos";

const NUM_SEMILLAS = 500;
const MUNDO: ParametrosMundo = {
  ancho: MUNDO_ANCHO,
  alto: MUNDO_ALTO,
  gravedad: 1,
  deriva: 0,
  etiquetaDeriva: "ninguna",
};

// nav-3, revisado por impacto-naves (imp-8/imp-9): la tolerancia de
// proximidad de 60px ha desaparecido del repositorio -- lo que este test
// comprueba ahora, desde fuera y con el mismo oráculo real que usa
// colocarNaves por dentro (existeTiroViable), es que las posiciones finales
// SIEMPRE tienen un disparo del arma base que hace daño de verdad, y que
// colocarNaves nunca deja de devolver una colocación (imp-9: siempre
// termina, en algún escalón).
test("nav-3: 500 semillas tienen siempre un tiro real y viable entre las naves colocadas", () => {
  const armaBase = buscarArma("pepinazo-cortesia");

  for (let semilla = 0; semilla < NUM_SEMILLAS; semilla++) {
    const { sistema, naves, aleatorio } = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla));
    const [a, b] = naves;

    const viable = existeTiroViable({
      mascara: sistema.mascara,
      ancho: MUNDO_ANCHO,
      alto: MUNDO_ALTO,
      planetas: sistema.planetas,
      gravedad: MUNDO.gravedad,
      deriva: MUNDO.deriva,
      aleatorio,
      arma: armaBase,
      naves: [
        { id: 0, x: a.x, y: a.y as number },
        { id: 1, x: b.x, y: b.y as number },
      ],
      tiradorId: 0,
      objetivoId: 1,
    });

    assert.ok(viable, `semilla ${semilla}: ningún disparo del arma base causa daño real entre las naves colocadas`);
  }
});
