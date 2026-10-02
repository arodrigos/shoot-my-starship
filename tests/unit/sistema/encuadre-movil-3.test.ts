import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generarSistema,
  GROSOR_ANILLO_MAX,
  GROSOR_ANILLO_MIN,
  MAX_ANILLOS,
  MAX_ASTEROIDES,
  PLANETAS_MAX,
  PLANETAS_MIN,
} from "@/sim/sistema/generador";
import { configurarTamanoMundo, MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { calcularTamanoContenedorJuego } from "@/juego/layoutContenedor";

const NUM_SEMILLAS = 100;

// encuadre-movil-3: configurarTamanoMundo cambia el tamaño de mundo que ve
// generarSistema (retrato con área reducida, paisaje con área completa) --
// este test comprueba, a 100 semillas por caso, que el generador sigue
// respetando sus propios topes duros en AMBOS mundos, no solo en el
// histórico 1920x1080 que cubre sis-2.
const CASOS = [
  { nombre: "retrato 360x640", viewport: { width: 360, height: 640 } },
  { nombre: "paisaje 1280x720", viewport: { width: 1280, height: 720 } },
];

for (const caso of CASOS) {
  test(`encuadre-movil-3: 100 semillas respetan los topes del sistema en ${caso.nombre}`, () => {
    const contenedor = calcularTamanoContenedorJuego(caso.viewport.width, caso.viewport.height);
    configurarTamanoMundo(contenedor.ancho, contenedor.alto);
    const ancho = MUNDO_ANCHO;
    const alto = MUNDO_ALTO;

    for (let semilla = 0; semilla < NUM_SEMILLAS; semilla++) {
      const sistema = generarSistema(semilla, ancho, alto);

      assert.ok(
        sistema.planetas.length >= PLANETAS_MIN && sistema.planetas.length <= PLANETAS_MAX,
        `${caso.nombre} semilla ${semilla}: ${sistema.planetas.length} planetas fuera de [${PLANETAS_MIN}, ${PLANETAS_MAX}]`,
      );
      assert.ok(
        sistema.anillos.length <= MAX_ANILLOS,
        `${caso.nombre} semilla ${semilla}: ${sistema.anillos.length} anillos, tope ${MAX_ANILLOS}`,
      );
      assert.ok(
        sistema.asteroides.length <= MAX_ASTEROIDES,
        `${caso.nombre} semilla ${semilla}: ${sistema.asteroides.length} asteroides, tope ${MAX_ASTEROIDES}`,
      );
      for (const anillo of sistema.anillos) {
        assert.ok(
          anillo.grosor >= GROSOR_ANILLO_MIN && anillo.grosor <= GROSOR_ANILLO_MAX,
          `${caso.nombre} semilla ${semilla}: grosor de anillo ${anillo.grosor} fuera de [${GROSOR_ANILLO_MIN}, ${GROSOR_ANILLO_MAX}]`,
        );
      }
    }
  });
}
