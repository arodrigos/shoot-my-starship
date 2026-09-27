import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { decidirTurnoIA } from "@/sim/ia/decidir";
import { CHISPA } from "@/sim/ia/personalidades";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const ORIGEN_X = 300;
const OBJETIVO_X = 700;
const ENSAYOS_CON_FALLO = 200;

function distanciaDisparo(mascara: ReturnType<typeof crearMascaraPlana>, anguloGrados: number, potencia: number, aleatorio: EstadoAleatorio): number {
  const resultado = resolverDisparo({
    mascara,
    gravedad: 1.0,
    deriva: 0,
    aleatorio,
    arma: buscarArma("pepinazo-cortesia"),
    origenX: ORIGEN_X,
    anguloGrados,
    potencia,
    objetivoY: 900,
    objetivoX: OBJETIVO_X,
    ancho: ANCHO,
    alto: ALTO,
  });
  return Math.abs(resultado.puntosDeImpacto[0].x - OBJETIVO_X);
}

// Chispa (banda baja, mayor desviación) es quien más falla por su cuenta:
// generar 200 ensayos donde el PRIMER disparo ya falló, sin sesgar la
// muestra a fallos fabricados a mano -- son fallos reales de la propia
// inyección de error.
test("ia-5: tras fallar contra un objetivo quieto, el siguiente disparo cae más cerca en al menos el 70% de 200 ensayos", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  let aleatorio = crearEstadoAleatorio(555);
  let mejoraron = 0;
  let ensayos = 0;
  let vueltas = 0;

  while (ensayos < ENSAYOS_CON_FALLO) {
    vueltas++;
    assert.equal(vueltas < 100_000, true, "no se generaron suficientes fallos reales para completar la muestra");

    const primerIntento = decidirTurnoIA({
      mascara,
      origenX: ORIGEN_X,
      objetivoX: OBJETIVO_X,
      gravedad: 1.0,
      deriva: 0,
      ancho: ANCHO,
      alto: ALTO,
      personalidad: CHISPA,
      aleatorio,
      ultimoIntento: null,
    });
    aleatorio = primerIntento.aleatorio;
    // pepinazo-cortesia tiene fiabilidad 1 (nunca tira esa moneda): reusar
    // `aleatorio` para medir el impacto no consume nada que decidirTurnoIA
    // vaya a necesitar después.
    const distancia1 = distanciaDisparo(mascara, primerIntento.entrada.anguloGrados, primerIntento.entrada.potencia, aleatorio);

    // Solo cuentan como ensayo de ia-5 los turnos donde el primer disparo
    // fue realmente un fallo (el propio criterio: "tras fallar").
    if (distancia1 <= 40) {
      continue;
    }
    ensayos++;

    const segundoIntento = decidirTurnoIA({
      mascara,
      origenX: ORIGEN_X,
      objetivoX: OBJETIVO_X,
      gravedad: 1.0,
      deriva: 0,
      ancho: ANCHO,
      alto: ALTO,
      personalidad: CHISPA,
      aleatorio,
      ultimoIntento: { distanciaAlObjetivoPx: distancia1 },
    });
    aleatorio = segundoIntento.aleatorio;
    const distancia2 = distanciaDisparo(mascara, segundoIntento.entrada.anguloGrados, segundoIntento.entrada.potencia, aleatorio);

    if (distancia2 < distancia1) {
      mejoraron++;
    }
  }

  const proporcion = mejoraron / ENSAYOS_CON_FALLO;
  assert.equal(proporcion >= 0.7, true, `solo mejoró el ${(proporcion * 100).toFixed(1)}% de ${ENSAYOS_CON_FALLO} ensayos con fallo real`);
});
