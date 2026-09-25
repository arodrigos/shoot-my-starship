import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const GRAVEDADES = [0.6, 1.0, 1.4];

test("armas-7: la gravedad es un parámetro del mapa -- el mismo disparo da tres alcances estrictamente ordenados de mayor a menor", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const arma = buscarArma("pepinazo-cortesia");
  const origenX = 300;

  const alcances = GRAVEDADES.map((gravedad) => {
    const resultado = resolverDisparo({
      mascara,
      gravedad,
      deriva: 0,
      aleatorio: crearEstadoAleatorio(1),
      arma,
      origenX,
      anguloGrados: 45,
      potencia: 45,
      objetivoX: 900,
      ancho: ANCHO,
      alto: ALTO,
    });
    assert.equal(resultado.fallo, false);
    return resultado.puntosDeImpacto[0].x - origenX;
  });

  // Si la gravedad estuviera cableada a una constante y no leída del mapa,
  // los tres alcances saldrían idénticos: esto es lo que distingue "es un
  // parámetro" de "está declarado pero nadie lo lee".
  for (let i = 1; i < alcances.length; i++) {
    assert.equal(
      alcances[i] < alcances[i - 1],
      true,
      `gravedad ${GRAVEDADES[i]} debería dar menos alcance que gravedad ${GRAVEDADES[i - 1]}`,
    );
  }
});

test("armas-7: el solucionador balístico exacto acierta a 2px del objetivo en los tres mundos de gravedad", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const arma = buscarArma("pepinazo-cortesia");
  const origenX = 300;
  const objetivoX = 900;

  // Si la gravedad estuviera cableada en la fórmula cerrada del solucionador
  // (en vez de recibida como parámetro), acertaría solo en el mundo donde esa
  // constante coincide con la gravedad real del mapa, y fallaría en silencio
  // en los otros dos -- que es justo lo que este test recorre.
  for (const gravedad of GRAVEDADES) {
    const [solucion] = resolverSolucionesBalisticas(origenX, 0, objetivoX, 0, gravedad);
    const resultado = resolverDisparo({
      mascara,
      gravedad,
      deriva: 0,
      aleatorio: crearEstadoAleatorio(1),
      arma,
      origenX,
      anguloGrados: solucion.anguloGrados,
      potencia: solucion.potencia,
      objetivoX,
      ancho: ANCHO,
      alto: ALTO,
    });
    assert.equal(resultado.fallo, false);
    const distancia = Math.abs(resultado.puntosDeImpacto[0].x - objetivoX);
    assert.equal(distancia <= 2, true, `gravedad ${gravedad}: el solucionador falló por ${distancia.toFixed(2)}px`);
  }
});
