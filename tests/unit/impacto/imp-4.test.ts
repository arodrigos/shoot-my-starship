import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 2000;
const ALTO = 1000;
const ALTURA_SUELO = 700;
const ORIGEN_X = 1000;
const NUM_DISTANCIAS = 50;

test("imp-4: la caída de daño es monótona, máxima en el impacto directo y exactamente 0 desde el radio declarado", () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  const efecto = armaBase.efecto;
  if (efecto.tipo !== "danio") {
    throw new Error("imp-4 espera que el arma base sea de tipo daño");
  }

  const mascara = crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO);

  function disparar(objetivoX: number, objetivoY: number) {
    return resolverDisparo({
      mascara,
      gravedad: 1,
      deriva: 0,
      aleatorio: crearEstadoAleatorio(1),
      arma: armaBase,
      origenX: ORIGEN_X,
      anguloGrados: 90,
      potencia: 60,
      objetivoX,
      objetivoY,
      ancho: ANCHO,
      alto: ALTO,
    });
  }

  const punto = disparar(ORIGEN_X, ALTURA_SUELO).puntosDeImpacto[0];
  const distanciaMaxima = efecto.radioEfectoPx + 20;

  const muestras = Array.from({ length: NUM_DISTANCIAS }, (_, i) => {
    const distancia = (distanciaMaxima * i) / (NUM_DISTANCIAS - 1);
    const danio = disparar(punto.x + distancia, punto.y).danioObjetivo;
    return { distancia, danio };
  });

  assert.equal(muestras[0].danio, efecto.danioMaximo, "en el impacto directo (distancia 0) el daño debe ser el máximo del arma");

  for (let i = 1; i < muestras.length; i++) {
    assert.ok(
      muestras[i].danio <= muestras[i - 1].danio,
      `el daño no puede crecer al alejarse: ${muestras[i - 1].danio} (${muestras[i - 1].distancia.toFixed(1)}px) -> ${muestras[i].danio} (${muestras[i].distancia.toFixed(1)}px)`,
    );
  }

  for (const muestra of muestras) {
    if (muestra.distancia >= efecto.radioEfectoPx) {
      assert.equal(muestra.danio, 0, `a ${muestra.distancia.toFixed(1)}px, por encima del radio de daño (${efecto.radioEfectoPx}px), el daño debe ser exactamente 0`);
    }
  }
});
