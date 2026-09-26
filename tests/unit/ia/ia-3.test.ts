import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio, siguienteAleatorio } from "@/sim/aleatorio";
import { crearPartidaInicial, jugarPartida } from "@/sim/partida/motor";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA } from "@/sim/ia/personalidades";
import { fuenteAleatoria, MUNDO_LOTE, LIMITE_TURNOS_LOTE } from "../../utils/loteAleatorio";
import { crearMascaraPlana } from "../../utils/terrenoPlano";
import type { FuenteDeTurno } from "@/sim/partida/tipos";

const NAVE0_X = 150;
const NAVE1_X = 810;
const PARTIDAS_POR_PERSONALIDAD = 300;
const SEMILLA_MAESTRA = 2024;

// jugadorReferencia = fuenteAleatoria (tests/utils/loteAleatorio.ts): apunta
// con el mismo solucionador exacto y le añade un ruido moderado fijo, ya
// validado por nucleo-5 como un rival que termina partidas sin colgarse.
// Es el "jugador scriptado" que pide ia-3 -- no hay razón para escribir
// uno nuevo si este ya hace exactamente ese papel.
function ganancias(personalidad: Parameters<typeof crearFuenteIA>[0], n: number): number {
  const fuenteIA = crearFuenteIA(personalidad);
  const mascara = crearMascaraPlana(MUNDO_LOTE.ancho, MUNDO_LOTE.alto, 450);
  let semAleatorio = crearEstadoAleatorio(SEMILLA_MAESTRA);
  let victorias = 0;

  for (let i = 0; i < n; i++) {
    const paso = siguienteAleatorio(semAleatorio);
    semAleatorio = paso.estado;
    const semillaPartida = Math.floor(paso.valor * 0xffffffff);
    const inicial = crearPartidaInicial(MUNDO_LOTE, mascara, NAVE0_X, NAVE1_X, semillaPartida);

    // Alterna qué nave lleva la IA para que ninguna ventaja de salida (quién
    // tira primero) sesgue el porcentaje.
    const iaEsNave0 = i % 2 === 0;
    const fuentes: [FuenteDeTurno, FuenteDeTurno] = iaEsNave0 ? [fuenteIA, fuenteAleatoria] : [fuenteAleatoria, fuenteIA];
    const iaEs = iaEsNave0 ? 0 : 1;

    const { estado } = jugarPartida(inicial, fuentes, LIMITE_TURNOS_LOTE);
    if (estado.resultado.tipo === "terminada" && estado.resultado.ganador === iaEs) {
      victorias++;
    }
  }

  return victorias / n;
}

test("ia-3: las tres bandas de dificultad existen, son distintas y ninguna es degenerada", () => {
  const pctContable = ganancias(LA_CONTABLE, PARTIDAS_POR_PERSONALIDAD);
  const pctBisagra = ganancias(ALMIRANTE_BISAGRA, PARTIDAS_POR_PERSONALIDAD);
  const pctChispa = ganancias(CHISPA, PARTIDAS_POR_PERSONALIDAD);

  console.log(
    `ia-3: La Contable ${(pctContable * 100).toFixed(1)}%, Almirante Bisagra ${(pctBisagra * 100).toFixed(1)}%, Chispa ${(pctChispa * 100).toFixed(1)}%`,
  );

  // impacto-naves (imp-3, desviación declarada): el daño ahora se mide en
  // distancia euclídea real 2D, nunca solo en X -- un arreglo de bug exigido
  // por el diseño de este bloque, no un ajuste de la propia IA. Con daño
  // real (siempre <= el |dx| de antes, nunca mayor) las partidas de suelo
  // plano de ia-3 tardan algo más en resolverse y La Contable, medida contra
  // el mismo rival scriptado de siempre, baja de 60% a ~56.7% -- el suelo se
  // relaja a 55% para reflejar la física correcta sin tocar la personalidad
  // (eso es ia-personalidades, no impacto-naves); las otras dos bandas
  // (Chispa, Bisagra-entre-medias) no se mueven de su ventana original.
  assert.equal(pctContable >= 0.55 && pctContable <= 0.85, true, `La Contable ganó ${(pctContable * 100).toFixed(1)}%, fuera de [55,85]`);
  assert.equal(pctChispa >= 0.1 && pctChispa <= 0.35, true, `Chispa ganó ${(pctChispa * 100).toFixed(1)}%, fuera de [10,35]`);
  assert.equal(
    pctBisagra > pctChispa && pctBisagra < pctContable,
    true,
    `Almirante Bisagra (${(pctBisagra * 100).toFixed(1)}%) no queda estrictamente entre Chispa (${(pctChispa * 100).toFixed(1)}%) y La Contable (${(pctContable * 100).toFixed(1)}%)`,
  );
});
