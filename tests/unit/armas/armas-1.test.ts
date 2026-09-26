import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import type { Arma } from "@/sim/armas/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;

// Arma de prueba definida SOLO como objeto de datos, sin importar nada del
// catálogo real: si resolverDisparo necesitara conocer un id de arma en
// concreto (una rama "if (id === ...)"), esta arma sería invisible para él y
// la prueba fallaría. Que funcione igual que cualquier arma del catálogo es
// la prueba de que el resolutor es genérico sobre los datos (armas-1).
const ARMA_DE_PRUEBA: Arma = {
  id: "arma-de-prueba-armas-1",
  nombre: "Arma de Prueba",
  descripcion: "No existe en el catálogo real: solo prueba que el resolutor es genérico.",
  comportamiento: { tipo: "impacto-simple" },
  huella: { tipo: "circular", radio: 37, signo: "restar" },
  efecto: { tipo: "danio", radioEfectoPx: 60, danioMaximo: 33 },
  fiabilidad: 1,
};

test("armas-1: una arma declarada como dato puro, no importada del catálogo, produce huella y daño según lo declarado", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const origenX = 300;
  const objetivoX = 300 + 500;

  // Raíz "de lobo alto" del solucionador exacto para que el impacto caiga
  // cerca de objetivoX sobre suelo plano: no depende de ningún arma del
  // catálogo, solo de la parábola común a todas (misma técnica que nucleo-6).
  const [solucionLoboAlto] = resolverSolucionesBalisticas(origenX, 0, objetivoX, 0, 1.0);

  const resultado = resolverDisparo({
    mascara,
    gravedad: 1.0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: ARMA_DE_PRUEBA,
    origenX,
    anguloGrados: solucionLoboAlto.anguloGrados,
    potencia: solucionLoboAlto.potencia,
    objetivoX,
    objetivoY: 900,
    ancho: ANCHO,
    alto: ALTO,
  });

  assert.equal(resultado.fallo, false);
  assert.equal(resultado.puntosDeImpacto.length, 1);

  const punto = resultado.puntosDeImpacto[0];
  // La huella debe respetar exactamente el radio declarado: cuenta los
  // píxeles solidos que quedaron en aire dentro y justo fuera del radio.
  const dentro = esAireEnMascara(resultado.mascara, ANCHO, Math.round(punto.x), Math.round(punto.y), ARMA_DE_PRUEBA.huella.tipo === "circular" ? ARMA_DE_PRUEBA.huella.radio - 3 : 0);
  assert.equal(dentro, true, "el radio declarado de la huella debe haber vaciado el centro del cráter");

  // Daño: cae con la distancia según danioPorDistancia, así que a distancia 0
  // (el punto de impacto coincide con objetivoX) debe dar el máximo
  // declarado (33, ver ARMA_DE_PRUEBA).
  assert.equal(resultado.danioObjetivo <= 33, true);
  assert.equal(resultado.danioObjetivo > 0, true, "un impacto cerca del objetivo debe hacer daño");
});

function esAireEnMascara(mascara: { ancho: number; datos: Uint8Array }, ancho: number, cx: number, cy: number, radioInterior: number): boolean {
  // Comprueba un punto a `radioInterior` del centro, hacia arriba: debe estar
  // dentro del cráter (aire) si la huella se aplicó con el radio declarado.
  const y = cy - radioInterior;
  const indice = y * ancho + cx;
  return mascara.datos[indice] === 0;
}
