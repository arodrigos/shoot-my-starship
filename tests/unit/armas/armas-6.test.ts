import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;
const N_DISPAROS = 1000;

// Dispara N_DISPAROS veces en secuencia (encadenando el estado aleatorio de
// un disparo al siguiente, igual que haría avanzar() turno a turno) y
// devuelve la secuencia de éxito/fallo. Es la misma resolverDisparo real, no
// una tirada de moneda aparte -- si el catálogo cambiara la fiabilidad del
// Petardo, este test la seguiría automáticamente.
function secuenciaDeFallos(semilla: number): boolean[] {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const arma = buscarArma("petardo-de-feria");
  let aleatorio: EstadoAleatorio = crearEstadoAleatorio(semilla);
  const secuencia: boolean[] = [];

  for (let i = 0; i < N_DISPAROS; i++) {
    const resultado = resolverDisparo({
      mascara,
      gravedad: 1.0,
      deriva: 0,
      aleatorio,
      arma,
      origenX: 300,
      anguloGrados: 45,
      potencia: 50,
      objetivoX: 900,
      ancho: ANCHO,
      alto: ALTO,
    });
    secuencia.push(resultado.fallo);
    aleatorio = resultado.aleatorio;
  }
  return secuencia;
}

test("armas-6: el Petardo de Feria falla a la tasa declarada (25% ±3 puntos) de forma reproducible con semilla fija", () => {
  const SEMILLA = 24680;
  const primeraEjecucion = secuenciaDeFallos(SEMILLA);
  const segundaEjecucion = secuenciaDeFallos(SEMILLA);

  // Misma semilla, misma secuencia exacta de éxito/fallo en las dos
  // ejecuciones: es lo que distingue "reproducible" de "aleatorio de
  // verdad", que sería igual de válido para un jugador pero invisible a un
  // test automatizado.
  assert.deepEqual(segundaEjecucion, primeraEjecucion);

  const fallos = primeraEjecucion.filter(Boolean).length;
  const proporcionFallos = fallos / N_DISPAROS;
  const tasaFalloDeclarada = 1 - buscarArma("petardo-de-feria").fiabilidad;

  assert.equal(
    Math.abs(proporcionFallos - tasaFalloDeclarada) <= 0.03,
    true,
    `proporción de fallos observada ${(proporcionFallos * 100).toFixed(1)}%, esperada ${(tasaFalloDeclarada * 100).toFixed(0)}% ±3 puntos`,
  );
});
