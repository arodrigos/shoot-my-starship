import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { crearMascaraVacia, esSolido, SOLIDO } from "@/sim/terreno/mascara";

const ANCHO = 1920;
const ALTO = 1080;
// "Planeta sintético": una pared vertical de sólido, más gruesa que ningún
// arma normal pero más fina que la penetración declarada de la Barrena
// (260px) -- suficiente para comprobar el túnel sin generar un sistema real.
const PARED_X_INICIO = 700;
const PARED_X_FIN = 760;
const ORIGEN_Y = 500;
const FILA_DE_VUELO = ORIGEN_Y - 26; // ALTURA_CANON_PX de resolver.ts

function crearMuroSintetico() {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  for (let y = FILA_DE_VUELO - 30; y < FILA_DE_VUELO + 30; y++) {
    for (let x = PARED_X_INICIO; x < PARED_X_FIN; x++) {
      mascara.datos[y * ANCHO + x] = SOLIDO;
    }
  }
  return mascara;
}

// Disparo horizontal puro (ángulo 0, gravedad 0): la fila de vuelo es
// constante, así que el "camino de aire de lado a lado" se puede comprobar
// en una sola fila conocida en vez de tener que rastrear una parábola.
function dispararRecto(mascara: ReturnType<typeof crearMuroSintetico>, armaId: string, huellaRadio?: number) {
  const base = buscarArma(armaId);
  return resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: huellaRadio === undefined ? base : { ...base, huella: { tipo: "circular", radio: huellaRadio, signo: "restar" } },
    origenX: 300,
    origenY: ORIGEN_Y,
    anguloGrados: 0,
    potencia: 40,
    objetivoX: 1200,
    objetivoY: ORIGEN_Y,
    ancho: ANCHO,
    alto: ALTO,
  });
}

test("arm-3: la Barrena Planetaria atraviesa el muro sintético y deja un túnel de aire de lado a lado", () => {
  const mascara = crearMuroSintetico();
  const resultado = dispararRecto(mascara, "barrena-planetaria");

  assert.equal(resultado.fallo, false);
  // Camino de aire a lo largo de toda la fila de vuelo, cruzando el muro
  // entero: ni un solo píxel sólido entre el lado de origen y el otro lado.
  for (let x = PARED_X_INICIO - 5; x < PARED_X_FIN + 5; x++) {
    assert.equal(esSolido(resultado.mascara, x, FILA_DE_VUELO), false, `x=${x} sigue sólido: el túnel no es pasante`);
  }
});

test("arm-3: un arma sin penetración detona en la superficie del muro y NO abre túnel pasante", () => {
  const mascara = crearMuroSintetico();
  // Radio de huella 26 (el de la Tostadora retirada): lo que se prueba es la
  // ausencia de penetración, no el tamaño del cráter del Pepinazo.
  const resultado = dispararRecto(mascara, "pepinazo-cortesia", 26);

  assert.equal(resultado.fallo, false);
  // El lado lejano del muro, dentro del muro pero fuera del alcance del
  // cráter de entrada (radio 26), tiene que seguir intacto: sin túnel, solo
  // un cráter local en el punto de impacto real (~x=707).
  assert.equal(esSolido(resultado.mascara, PARED_X_FIN - 10, FILA_DE_VUELO), true, "el lado lejano del muro no debería haberse abierto");
});
