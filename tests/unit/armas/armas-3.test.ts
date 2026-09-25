import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { crearMascaraVacia, SOLIDO, type Mascara } from "@/sim/terreno/mascara";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 800;
const ALTO = 600;

function contarSolidos(mascara: Mascara): number {
  let total = 0;
  for (const valor of mascara.datos) {
    if (valor === SOLIDO) total++;
  }
  return total;
}

function bboxDePixelesQueCambiaron(antes: Mascara, despues: Mascara): { ancho: number; alto: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < antes.alto; y++) {
    for (let x = 0; x < antes.ancho; x++) {
      const indice = y * antes.ancho + x;
      if (antes.datos[indice] !== despues.datos[indice]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { ancho: maxX - minX + 1, alto: maxY - minY + 1 };
}

function crearMascaraPendiente(ancho: number, alto: number, alturaBase: number, pendiente: number): Mascara {
  const mascara = crearMascaraVacia(ancho, alto);
  for (let x = 0; x < ancho; x++) {
    const alturaSuelo = Math.min(alto - 1, Math.round(alturaBase + x * pendiente));
    for (let y = alturaSuelo; y < alto; y++) {
      mascara.datos[y * ancho + x] = SOLIDO;
    }
  }
  return mascara;
}

test("armas-3: Vertedero Portátil aumenta el número de píxeles sólidos del terreno", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 400);
  const arma = buscarArma("vertedero-portatil");
  const solidosAntes = contarSolidos(mascara);
  const origenX = 100;
  const objetivoX = 400;
  const [{ anguloGrados, potencia }] = resolverSolucionesBalisticas(origenX, 0, objetivoX, 0, 1.0);

  const resultado = resolverDisparo({
    mascara,
    gravedad: 1.0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma,
    origenX,
    anguloGrados,
    potencia,
    objetivoX,
    ancho: ANCHO,
    alto: ALTO,
  });

  assert.equal(resultado.fallo, false);
  const solidosDespues = contarSolidos(resultado.mascara);
  assert.equal(solidosDespues > solidosAntes, true, "el Vertedero Portátil debe rellenar terreno, no vaciarlo");
});

test("armas-3: la huella de la Zanjadora Manolita es al menos 3 veces más ancha que alta", () => {
  const mascaraAntes = crearMascaraPlana(ANCHO, ALTO, 400);
  const arma = buscarArma("zanjadora-manolita");
  const origenX = 100;
  const objetivoX = 400;
  const [{ anguloGrados, potencia }] = resolverSolucionesBalisticas(origenX, 0, objetivoX, 0, 1.0);

  const resultado = resolverDisparo({
    mascara: mascaraAntes,
    gravedad: 1.0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma,
    origenX,
    anguloGrados,
    potencia,
    objetivoX,
    ancho: ANCHO,
    alto: ALTO,
  });

  assert.equal(resultado.fallo, false);
  const bbox = bboxDePixelesQueCambiaron(mascaraAntes, resultado.mascara);
  assert.equal(bbox.ancho > 0 && bbox.alto > 0, true, "la huella debe haber cambiado al menos un píxel del terreno");
  assert.equal(bbox.ancho >= bbox.alto * 3, true, `la zanja mide ${bbox.ancho}x${bbox.alto}, se esperaba al menos 3 veces más ancha que alta`);
});

test("armas-3: la Pelota de Chatarra rueda al menos 40px antes de detonar, sobre una pendiente construida a mano", () => {
  // La pendiente es lo bastante suave (0.3px de caída por columna) para que
  // resolverRodadura nunca la confunda con un "hueco" (caída > pasoPx*3) y
  // ruede sin interrupción, en vez de detonar en el primer contacto.
  const mascara = crearMascaraPendiente(ANCHO, ALTO, 250, 0.3);
  const origenX = 100;
  const objetivoX = 400;
  const [{ anguloGrados, potencia }] = resolverSolucionesBalisticas(origenX, 0, objetivoX, 0, 1.0);

  const armaSimple = buscarArma("pepinazo-cortesia");
  const armaRodante = buscarArma("pelota-de-chatarra");

  const parametrosComunes = { mascara, gravedad: 1.0, deriva: 0, origenX, anguloGrados, potencia, objetivoX, ancho: ANCHO, alto: ALTO };
  const resultadoSimple = resolverDisparo({ ...parametrosComunes, aleatorio: crearEstadoAleatorio(1), arma: armaSimple });
  const resultadoRodante = resolverDisparo({ ...parametrosComunes, aleatorio: crearEstadoAleatorio(1), arma: armaRodante });

  assert.equal(resultadoSimple.fallo, false);
  assert.equal(resultadoRodante.fallo, false);

  // El primer contacto con el suelo es idéntico para las dos armas (misma
  // parábola): la diferencia con el punto donde detona la Pelota de
  // Chatarra es, por definición, lo que rodó tras tocar tierra.
  const distanciaRodada = Math.abs(resultadoRodante.puntosDeImpacto[0].x - resultadoSimple.puntosDeImpacto[0].x);
  assert.equal(distanciaRodada >= 40, true, `la Pelota de Chatarra solo rodó ${distanciaRodada.toFixed(1)}px`);
});
