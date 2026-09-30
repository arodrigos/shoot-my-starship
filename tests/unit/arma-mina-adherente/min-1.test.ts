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

// min-1 (camino crítico): el caso límite que corrige la suposición original
// de vuelo-extensible -- una órbita multipozo estable (grav-6) donde
// `detenerse` nunca se cumple y el vuelo agota su presupuesto. Para
// cualquier otra arma esto es "proyectil-perdido" legítimo (grav-6); para la
// mina NO puede serlo, porque "ningún turno se queda sin resultado" (min-1)
// es una exigencia explícita del diseño. Reconstruye el fixture de grav-6
// pasando por la interfaz pública de ángulo/potencia (en vez de inyectar el
// EstadoProyectil directamente, como hace grav-6 contra simularVuelo): 90°
// exactos anula la componente x salvo el error de redondeo de coma flotante
// de Math.cos(pi/2) (~1.8e-14 px/s), catorce órdenes de magnitud por debajo
// de la velocidad orbital -- perturbación despreciable frente a los 720
// pasos de presupuesto, pero real, así que primero se confirma con
// simularVuelo que la órbita sigue sin tocar nada con esa perturbación
// incluida.
test("min-1: una órbita multipozo estable que nunca toca nada detona igualmente al agotar el presupuesto, nunca se pierde", () => {
  const planeta = { id: 1, cx: 500, cy: 500, radio: 25, densidad: 1, pixelesVivos: 1_819_165 };
  const distanciaOrbita = 120;
  const velocidadOrbital = 301.59289474462014;
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  const planetas: RegistroPlanetas = [planeta];

  const origenX = planeta.cx + distanciaOrbita;
  const anguloGrados = 90;
  const potencia = ((velocidadOrbital - 300) / (1400 - 300)) * 100;

  // Confirma primero, a nivel de física pura (igual que grav-6), que la
  // perturbación de redondeo de 90° no le hace tocar nada dentro del
  // presupuesto: si este assert.doesNotThrow fallara, el fixture no estaría
  // modelando el caso límite que se pretende.
  const inicialCrudo: EstadoProyectil = {
    x: origenX,
    y: planeta.cy,
    vx: velocidadOrbital * Math.cos((anguloGrados * Math.PI) / 180),
    vy: -velocidadOrbital * Math.sin((anguloGrados * Math.PI) / 180),
  };
  const sim = simularVuelo(inicialCrudo, 0, 0, () => false, { planetas });
  assert.equal(sim.perdido, true, "el fixture debe reproducir fielmente la órbita estable de grav-6 (perdido a nivel de física pura)");
  assert.equal(sim.pasos, PRESUPUESTO_VUELO_MULTIPOZO_PASOS);

  const resultado = resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: MINA,
    origenX,
    // resolverDisparo resta ALTURA_CANON_PX de origenY al construir el
    // proyectil inicial (el cañón no dispara desde el punto exacto que se le
    // da) -- se compensa aquí para que el punto de partida real coincida con
    // INICIO.y = planeta.cy del fixture de grav-6.
    origenY: planeta.cy + ALTURA_CANON_PX,
    anguloGrados,
    potencia,
    objetivoX: origenX,
    objetivoY: planeta.cy,
    ancho: ANCHO,
    alto: ALTO,
    planetas,
  });

  assert.equal(resultado.proyectilPerdido, false, "la mina nunca puede quedar perdida: debe detonar en la última posición conocida");
  assert.equal(resultado.puntosDeImpacto.length, 1);
  assert.equal(Number.isFinite(resultado.puntosDeImpacto[0].x), true);
  assert.equal(Number.isFinite(resultado.puntosDeImpacto[0].y), true);
});
