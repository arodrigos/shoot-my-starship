import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearMascaraPlana } from "../../utils/terrenoPlano";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo, ALTURA_CANON_PX } from "@/sim/armas/resolver";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { PRESUPUESTO_VUELO_MULTIPOZO_PASOS } from "@/sim/fisica/vuelo";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import type { EstadoProyectil } from "@/sim/fisica/proyectil";

const ANCHO = 1920;
const ALTO = 1080;
const MINA = buscarArma("gancho-pegajoso");

test("min-1: la Mina Adherente declara el comportamiento adherente-con-mecha, distinto de la mecha en vuelo de la Granada", () => {
  assert.equal(MINA.comportamiento.tipo, "adherente-con-mecha");
  if (MINA.comportamiento.tipo === "adherente-con-mecha") {
    assert.equal(MINA.comportamiento.segundosHastaDetonar, 5);
  }
});

// min-1 (camino crítico): un vuelo que choca contra terreno sólido se queda
// pegado ahí -- un único punto, nunca "perdido", pase lo que pase con el
// presupuesto de vuelo.
test("min-1: un disparo contra terreno sólido se pega en el punto de contacto, no se pierde", () => {
  const alturaSuelo = 900;
  const origenX = 300;
  const objetivoX = 900;
  const objetivoY = 900;
  const gravedad = 1;
  const mascara = crearMascaraPlana(ANCHO, ALTO, alturaSuelo);
  const [solucion] = resolverSolucionesBalisticas(origenX, alturaSuelo, objetivoX, objetivoY, gravedad);

  const resultado = resolverDisparo({
    mascara,
    gravedad,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: MINA,
    origenX,
    anguloGrados: solucion.anguloGrados,
    potencia: solucion.potencia,
    objetivoX,
    objetivoY,
    ancho: ANCHO,
    alto: ALTO,
  });

  assert.equal(resultado.fallo, false);
  assert.equal(resultado.proyectilPerdido, false);
  assert.equal(resultado.puntosDeImpacto.length, 1, "la mina se pega en UN único punto, nunca más de uno");
  assert.equal(resultado.puntosDeImpacto[0].y >= 895, true, "el punto de adherencia debe estar sobre la línea de suelo");
});

// min-1 (camino crítico): un vuelo que corta un casco se queda pegado ahí --
// el otro punto de contacto posible, con el mismo resultado de "un único
// punto, nunca perdido".
test("min-1: un disparo que corta un casco se pega en el punto de contacto con la nave, no se pierde", () => {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  const origenX = 200;
  const naveObjetivoX = origenX + 600;
  const naveObjetivoY = 500;

  const resultado = resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: MINA,
    origenX,
    // Compensa la altura del cañón (ALTURA_CANON_PX, restada internamente
    // de origenY) para que el proyectil salga EXACTAMENTE a la altura del
    // casco rival: sin esto el tiro pasa a 26px del centro, fuera del radio
    // de colisión (22px), y nunca llega a cortarlo.
    origenY: naveObjetivoY + ALTURA_CANON_PX,
    anguloGrados: 0,
    potencia: 60,
    objetivoX: naveObjetivoX,
    objetivoY: naveObjetivoY,
    ancho: ANCHO,
    alto: ALTO,
    naves: [
      { id: 0, x: origenX, y: naveObjetivoY },
      { id: 1, x: naveObjetivoX, y: naveObjetivoY },
    ],
    tiradorId: 0,
  });

  assert.equal(resultado.fallo, false);
  assert.equal(resultado.proyectilPerdido, false);
  assert.equal(resultado.puntosDeImpacto.length, 1);
  assert.equal(resultado.puntosDeImpacto[0].impactoNave, 1, "debe quedar pegada a la nave rival, no a ninguna otra superficie");
});

// cat-4: el gancho solo se ancla a roca o a casco. La órbita multipozo que
// nunca toca nada (fixture de grav-6) ya no detona en la última posición
// conocida: el gancho se pierde sin daño ni cambio en la máscara. Antes de
// catalogo-y-selector el diseño pedía lo contrario (la mina nunca se perdía).
test("min-1: una órbita multipozo estable que nunca toca nada pierde el gancho, sin daño ni cambio en la máscara", () => {
  const planeta = { id: 1, cx: 500, cy: 500, radio: 25, densidad: 1, pixelesVivos: 1_819_165 };
  const distanciaOrbita = 120;
  const velocidadOrbital = 301.59289474462014;
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  const copia = new Uint8Array(mascara.datos);
  const planetas: RegistroPlanetas = [planeta];
  const origenX = planeta.cx + distanciaOrbita;
  const potencia = ((velocidadOrbital - 300) / (1400 - 300)) * 100;

  const resultado = resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: MINA,
    origenX,
    origenY: planeta.cy + ALTURA_CANON_PX,
    anguloGrados: 90,
    potencia,
    objetivoX: origenX,
    objetivoY: planeta.cy,
    ancho: ANCHO,
    alto: ALTO,
    planetas,
  });

  assert.equal(resultado.proyectilPerdido, true);
  assert.equal(resultado.puntosDeImpacto.length, 0);
  assert.equal(resultado.danioObjetivo, 0);
  assert.deepEqual(Array.from(resultado.mascara.datos), Array.from(copia));
});
