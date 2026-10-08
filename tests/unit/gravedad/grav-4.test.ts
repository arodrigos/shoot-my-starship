import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { ALTURA_CANON_PX, alturaSuperficie, detenerseEnSuelo, patronPerdigones, resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { avanzar } from "@/sim/partida/avanzar";
import { crearPartidaInicial } from "@/sim/partida/motor";
import type { EstadoPartida } from "@/sim/partida/tipos";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { aplicarHuellaCapsula, aplicarHuellaCircular } from "@/sim/terreno/huella";
import { contarPixelesPorMaterial, type Planeta } from "@/sim/gravedad/planetas";

const ANCHO = 2000;
const ALTO = 1200;
const ALTURA_SUELO = 1000;

function construirMundoConGroundYPlaneta(): { mascara: ReturnType<typeof crearMascaraVacia>; planeta: Planeta } {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  aplicarHuellaCapsula(mascara, ANCHO / 2, ALTURA_SUELO, ANCHO / 2, 1, "sumar", 1);
  for (let y = ALTURA_SUELO; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) mascara.datos[y * ANCHO + x] = 1;
  }
  const cx = 1200;
  const cy = 400;
  const radio = 300;
  aplicarHuellaCircular(mascara, cx, cy, radio, "sumar", 2);
  const pixelesVivos = contarPixelesPorMaterial(mascara).get(2) ?? 0;
  return { mascara, planeta: { id: 2, cx, cy, radio, densidad: 1, pixelesVivos } };
}

test("grav-4: la masa se queda congelada durante todo el vuelo de un disparo de submuniciones", () => {
  const { mascara, planeta } = construirMundoConGroundYPlaneta();
  const arma = buscarArma("racimo-de-tuppers");
  if (arma.comportamiento.tipo !== "submuniciones") {
    throw new Error("este test necesita un arma de submuniciones; el catálogo cambió");
  }
  const { cantidad } = arma.comportamiento;

  const origenX = 100;
  const anguloGrados = 60;
  const potencia = 90;
  const objetivoX = 1800;

  const resultado = resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma,
    origenX,
    anguloGrados,
    potencia,
    objetivoX,
    objetivoY: ALTURA_SUELO,
    ancho: ANCHO,
    alto: ALTO,
    planetas: [planeta],
  });

  // Réplica manual de lo que hace resolverSubmuniciones por dentro: el
  // portador vuela con `planeta` como UN SOLO valor, sin tocar, y los
  // perdigones salen de su punto de detonación. Es la propiedad que grav-4
  // exige y que una recalculación a mitad de vuelo rompería.
  const origenY = alturaSuperficie(mascara, origenX) ?? ALTO - 1;
  const rad = (anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(potencia);
  const inicial = crearProyectil(origenX, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  const detenerse = detenerseEnSuelo(mascara, ANCHO, ALTO);
  const encuadre = { ancho: ANCHO, alto: ALTO };
  const { proyectil, perdido } = simularVuelo(inicial, 0, 0, detenerse, { planetas: [planeta], encuadre });
  const puntosEsperados = perdido ? [] : patronPerdigones(proyectil, cantidad);

  assert.equal(resultado.puntosDeImpacto.length, puntosEsperados.length);
  resultado.puntosDeImpacto.forEach((punto, indice) => {
    assert.equal(punto.x, puntosEsperados[indice].x, `submunición ${indice}: x diverge de la masa congelada`);
    assert.equal(punto.y, puntosEsperados[indice].y, `submunición ${indice}: y diverge de la masa congelada`);
  });
});

test("grav-4: al cerrar el turno, la masa del planeta baja con el cráter que dejó el disparo", () => {
  const { mascara, planeta } = construirMundoConGroundYPlaneta();
  const mundo = { ancho: ANCHO, alto: ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "grav-4" };
  const estadoInicial: EstadoPartida = crearPartidaInicial(mundo, mascara, [100, 1800], 1, [planeta]);

  const { estado: estadoTrasDisparo } = avanzar(estadoInicial, {
    arma: "pepinazo-cortesia",
    anguloGrados: 55,
    potencia: 95,
    objetivoId: 1,
  });

  assert.ok(estadoTrasDisparo.planetas);
  const [planetaTrasDisparo] = estadoTrasDisparo.planetas!;
  assert.ok(
    planetaTrasDisparo.pixelesVivos < planeta.pixelesVivos,
    "el impacto debe haber erosionado el planeta y su masa debe reflejarlo ya en el turno siguiente",
  );
});
