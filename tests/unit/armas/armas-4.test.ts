import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;

test("armas-4: la deriva mueve el punto de impacto de forma monótona, y la diferencia crece con |deriva|", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const arma = buscarArma("pepinazo-cortesia");
  const origenX = 300;
  const objetivoX = 900;
  // deriva=0 usa la raíz "de lobo alto" del solucionador exacto para que el
  // punto central caiga dentro del mapa: con deriva distinta de 0 el punto
  // real se desplaza, pero el ángulo/potencia del disparo son los mismos en
  // las cinco pruebas -- es la deriva, y solo la deriva, la que varía.
  const [{ anguloGrados, potencia }] = resolverSolucionesBalisticas(origenX, 0, objetivoX, 0, 1.0);

  // Cinco valores de deriva, tal y como pide el criterio (armas-4).
  const derivas = [-40, -20, 0, 20, 40];
  const impactosX = derivas.map((deriva) => {
    const resultado = resolverDisparo({
      mascara,
      gravedad: 1.0,
      deriva,
      aleatorio: crearEstadoAleatorio(1),
      arma,
      origenX,
      anguloGrados,
      potencia,
      objetivoX,
      objetivoY: 900,
      ancho: ANCHO,
      alto: ALTO,
    });
    assert.equal(resultado.fallo, false);
    return resultado.puntosDeImpacto[0].x;
  });

  // Orden estrictamente creciente: si la deriva estuviera cableada al HUD
  // pero no a la física, los cinco valores saldrían idénticos y esta
  // comprobación fallaría aquí, no en un vistazo a la pantalla.
  for (let i = 1; i < impactosX.length; i++) {
    assert.equal(impactosX[i] > impactosX[i - 1], true, `deriva ${derivas[i]} debería impactar más a la derecha que deriva ${derivas[i - 1]}`);
  }

  // La diferencia respecto al disparo sin deriva debe crecer con |deriva|.
  const centro = impactosX[Math.floor(derivas.length / 2)];
  const diferenciasAbsolutas = impactosX.map((x) => Math.abs(x - centro));
  const derivaCeroIndice = derivas.indexOf(0);
  assert.equal(diferenciasAbsolutas[derivaCeroIndice], 0);
  assert.equal(diferenciasAbsolutas[0] > diferenciasAbsolutas[1], true, "deriva -40 debe desviar más que deriva -20");
  assert.equal(diferenciasAbsolutas[4] > diferenciasAbsolutas[3], true, "deriva 40 debe desviar más que deriva 20");
});
