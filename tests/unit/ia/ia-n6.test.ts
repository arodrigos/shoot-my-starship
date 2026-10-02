import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo } from "@/sim/armas/resolver";
import { buscarArma } from "@/sim/armas/catalogo";
import { UMBRAL_FALLO_PX, decidirTurnoIA } from "@/sim/ia/decidir";
import { CHISPA } from "@/sim/ia/personalidades";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";
import { muestra } from "../../utils/muestra";

const NUM_DUELOS_CON_FALLO = muestra(100);
// Techo de sistemas del lote a recorrer buscando esos 100 fallos reales: con
// Chispa (banda baja) la mayoría de los sistemas generados fallan por encima
// del umbral a la primera, así que 400 sobra de margen sin disparar el coste
// de la búsqueda multipozo (cada sistema no cualificado solo paga UN turno).
// Con muestra reducida el tope baja en la misma proporción que los duelos.
const TOPE_SISTEMAS_LOTE = muestra(400);
// ia-n6: el umbral del 70% de ia-5 se relaja al 60% -- con varios pozos el
// paisaje de error no es suave (ia-n4b/ia-n5 ya lo miden: hay cráteres de
// gravedad que cruzar) y un disparo corregido puede caer al otro lado de uno
// sin que la corrección esté mal, solo mal de suerte con el terreno.
const UMBRAL_PROPORCION_MEJORA = 0.6;

function distanciaAlCentro(punto: { readonly x: number; readonly y: number } | undefined, objetivo: { readonly x: number; readonly y: number }): number {
  assert.ok(punto, "ia-n6: el disparo debía impactar en algún punto para medir distancia");
  return Math.hypot(punto!.x - objetivo.x, punto!.y - objetivo.y);
}

// ia-n6: "más cerca" se mide con la distancia euclídea 2D del punto de
// detonación al centro de la nave (coherente con imp-3), no con la distancia
// 1D en X que usaba ia-5 en terreno llano sin altura propia de nave.
test(`ia-n6: en modo multipozo, tras fallar por encima del umbral el siguiente disparo cae más cerca en al menos el 60% de ${NUM_DUELOS_CON_FALLO} duelos`, () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  const lote = generarLoteDeSistemas(TOPE_SISTEMAS_LOTE);

  let mejoraron = 0;
  let duelosConFallo = 0;

  for (const { sistema, naveA, naveB, aleatorio } of lote) {
    if (duelosConFallo >= NUM_DUELOS_CON_FALLO) break;

    const parametrosComunes = {
      mascara: sistema.mascara,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      planetas: sistema.planetas,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      naves: [naveA, naveB],
      tiradorId: 0 as const,
      objetivoId: 1 as const,
    };
    const parametrosVuelo = {
      mascara: sistema.mascara,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      arma: armaBase,
      origenX: naveA.x,
      origenY: naveA.y,
      objetivoX: naveB.x,
      objetivoY: naveB.y,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      planetas: sistema.planetas,
      naves: [naveA, naveB],
      tiradorId: 0 as const,
    };

    const primerIntento = decidirTurnoIA({
      ...parametrosComunes,
      origenX: naveA.x,
      objetivoX: naveB.x,
      origenY: naveA.y,
      objetivoY: naveB.y,
      personalidad: CHISPA,
      aleatorio,
      ultimoIntento: null,
    });
    if (primerIntento.bloqueada) continue;

    const disparo1 = resolverDisparo({
      ...parametrosVuelo,
      aleatorio: primerIntento.aleatorio,
      anguloGrados: primerIntento.entrada.anguloGrados,
      potencia: primerIntento.entrada.potencia,
    });
    const distancia1 = distanciaAlCentro(disparo1.puntosDeImpacto[0], naveB);
    if (distancia1 <= UMBRAL_FALLO_PX) continue;

    duelosConFallo++;

    const segundoIntento = decidirTurnoIA({
      ...parametrosComunes,
      origenX: naveA.x,
      objetivoX: naveB.x,
      origenY: naveA.y,
      objetivoY: naveB.y,
      personalidad: CHISPA,
      aleatorio: primerIntento.aleatorio,
      ultimoIntento: { distanciaAlObjetivoPx: distancia1 },
    });
    const disparo2 = resolverDisparo({
      ...parametrosVuelo,
      aleatorio: segundoIntento.aleatorio,
      anguloGrados: segundoIntento.entrada.anguloGrados,
      potencia: segundoIntento.entrada.potencia,
    });
    const distancia2 = distanciaAlCentro(disparo2.puntosDeImpacto[0], naveB);

    if (distancia2 < distancia1) {
      mejoraron++;
    }
  }

  assert.equal(duelosConFallo, NUM_DUELOS_CON_FALLO, `solo se encontraron ${duelosConFallo} duelos con fallo real de ${TOPE_SISTEMAS_LOTE} sistemas`);

  const proporcion = mejoraron / NUM_DUELOS_CON_FALLO;
  assert.ok(
    proporcion >= UMBRAL_PROPORCION_MEJORA,
    `solo mejoró el ${(proporcion * 100).toFixed(1)}% de ${NUM_DUELOS_CON_FALLO} duelos con fallo real, techo ${UMBRAL_PROPORCION_MEJORA * 100}%`,
  );
});
