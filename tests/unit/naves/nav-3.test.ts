import { test } from "node:test";
import assert from "node:assert/strict";
import { generarSistema } from "@/sim/sistema/generador";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { colocarNaves, TOLERANCIA_IMPACTO_NAVE_PX } from "@/sim/naves/colocacion";
import { buscarDisparoViable } from "@/sim/balistica/busqueda";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";
import type { ParametrosMundo } from "@/sim/partida/tipos";

const NUM_SEMILLAS = 500;
const MAX_INTENTOS_COLOCACION = 5;
const MUNDO: ParametrosMundo = {
  ancho: MUNDO_ANCHO,
  alto: MUNDO_ALTO,
  gravedad: 1,
  deriva: 0,
  etiquetaDeriva: "ninguna",
};

test("nav-3: 500 semillas tienen siempre un tiro posible, ninguna agota los reintentos", () => {
  for (let semilla = 0; semilla < NUM_SEMILLAS; semilla++) {
    const sistema = generarSistema(semilla, MUNDO_ANCHO, MUNDO_ALTO);

    const { naves, intentos } = colocarNaves(sistema, MUNDO, crearEstadoAleatorio(semilla));
    assert.ok(
      intentos <= MAX_INTENTOS_COLOCACION,
      `semilla ${semilla}: agotó los ${MAX_INTENTOS_COLOCACION} reintentos de colocación`,
    );

    // Comprobación independiente con el buscador real: no basta con que
    // colocarNaves haya aceptado la colocación por dentro, hay que
    // reproducir el disparo desde fuera con las posiciones finales.
    const [a, b] = naves;
    const disparo = buscarDisparoViable({
      mascara: sistema.mascara,
      ancho: MUNDO_ANCHO,
      alto: MUNDO_ALTO,
      planetas: sistema.planetas,
      gravedad: MUNDO.gravedad,
      deriva: MUNDO.deriva,
      origenX: a.x,
      origenY: a.y as number,
      objetivoX: b.x,
      objetivoY: b.y as number,
      toleranciaPx: TOLERANCIA_IMPACTO_NAVE_PX,
    });

    assert.ok(disparo !== null, `semilla ${semilla}: ningún disparo del arma base llega a la nave contraria`);
    assert.ok(
      (disparo as NonNullable<typeof disparo>).distanciaFinalPx <= TOLERANCIA_IMPACTO_NAVE_PX,
      `semilla ${semilla}: el disparo encontrado no está dentro de tolerancia`,
    );
  }
});
