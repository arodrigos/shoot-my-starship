import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo } from "@/sim/armas/resolver";
import { esComportamientoAdherente } from "@/sim/fisica/comportamientoExtendido";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import type { Arma } from "@/sim/armas/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;

// Armas inventadas SOLO en este test, una por variante nueva -- igual que
// ARMA_INVENTADA en arm-1.test.ts, para probar que el resolutor es genérico
// sobre los ejes sin tocar resolver.ts ni catalogo.ts.
const ARMA_ERRATICA: Arma = {
  id: "arma-erratica-vex-1",
  nombre: "Erratica de prueba",
  descripcion: "Solo para el test: no existe en el catálogo real.",
  comportamiento: { tipo: "erratico", magnitudPxS2: 400 },
  huella: { tipo: "circular", radio: 18, signo: "restar" },
  efecto: { tipo: "danio", radioEfectoPx: 40, danioMaximo: 15 },
  fiabilidad: 1,
};

const ARMA_MECHA: Arma = {
  id: "arma-mecha-vex-1",
  nombre: "Mecha de prueba",
  descripcion: "Solo para el test: no existe en el catálogo real.",
  comportamiento: { tipo: "mecha", segundosHastaDetonar: 5 },
  huella: { tipo: "circular", radio: 18, signo: "restar" },
  efecto: { tipo: "danio", radioEfectoPx: 40, danioMaximo: 15 },
  fiabilidad: 1,
};

const ARMA_ADHERENTE: Arma = {
  id: "arma-adherente-vex-1",
  nombre: "Adherente de prueba",
  descripcion: "Solo para el test: no existe en el catálogo real.",
  comportamiento: { tipo: "adherente-con-mecha" },
  huella: { tipo: "circular", radio: 18, signo: "restar" },
  efecto: { tipo: "danio", radioEfectoPx: 40, danioMaximo: 15 },
  fiabilidad: 1,
};

function resolverConArma(arma: Arma) {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const [solucion] = resolverSolucionesBalisticas(300, 900, 900, 900, 1);
  return resolverDisparo({
    mascara,
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma,
    origenX: 300,
    anguloGrados: solucion.anguloGrados,
    potencia: solucion.potencia,
    objetivoX: 900,
    objetivoY: 900,
    ancho: ANCHO,
    alto: ALTO,
  });
}

test("vex-1: erratico se resuelve por ejes, sin tocar el resolutor para reconocerla", () => {
  const resultado = resolverConArma(ARMA_ERRATICA);
  const referenciaSinPerturbacion = resolverConArma({ ...ARMA_ERRATICA, comportamiento: { tipo: "impacto-simple" } });
  assert.equal(resultado.fallo, false);
  assert.equal(resultado.puntosDeImpacto.length, 1);
  // La perturbación con esta magnitud tiene que cambiar de verdad la
  // trayectoria frente a un impacto-simple con la misma balística: si no,
  // el resolutor la estaría ignorando en vez de resolverla por ejes.
  assert.notDeepEqual(resultado.puntosDeImpacto, referenciaSinPerturbacion.puntosDeImpacto);
});

test("vex-1: mecha se resuelve por ejes, sin tocar el resolutor para reconocerla", () => {
  const resultado = resolverConArma(ARMA_MECHA);
  assert.equal(resultado.fallo, false);
  assert.equal(resultado.puntosDeImpacto.length, 1);
  assert.equal(resultado.danioObjetivo > 0, true);
});

test("vex-1: adherente-con-mecha se resuelve por ejes, sin tocar el resolutor para reconocerla", () => {
  const resultado = resolverConArma(ARMA_ADHERENTE);
  assert.equal(resultado.fallo, false);
  assert.equal(resultado.puntosDeImpacto.length, 1);
  assert.equal(resultado.danioObjetivo > 0, true);
});

// vex-1: la condición de adherencia es una función pura sobre el eje de
// comportamiento -- ningún llamante necesita comparar arma.id para saber si
// un arma se queda pegada.
test("vex-1: esComportamientoAdherente distingue adherente-con-mecha del resto de comportamientos", () => {
  assert.equal(esComportamientoAdherente(ARMA_ADHERENTE.comportamiento), true);
  assert.equal(esComportamientoAdherente(ARMA_ERRATICA.comportamiento), false);
  assert.equal(esComportamientoAdherente(ARMA_MECHA.comportamiento), false);
  assert.equal(esComportamientoAdherente({ tipo: "impacto-simple" }), false);
  assert.equal(esComportamientoAdherente({ tipo: "instantaneo" }), false);
  assert.equal(esComportamientoAdherente({ tipo: "rodante", distanciaMaximaPx: 10, pasoPx: 2 }), false);
  assert.equal(esComportamientoAdherente({ tipo: "submuniciones", cantidad: 3, dispersionPxS: 10 }), false);
});
