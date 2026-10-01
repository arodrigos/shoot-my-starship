import { test } from "node:test";
import assert from "node:assert/strict";
import { generarSistema } from "@/sim/sistema/generador";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";
import { AIRE, ESCOMBRO, SOLIDO, crearMascaraVacia, esSolido, type Mascara } from "@/sim/terreno/mascara";
import { ANCHO_BORDE_QUEMADO_PX, clasificarPixelVisual } from "@/juego/terreno/clasificacionVisual";

const MUNDO_ANCHO = 1920;
const MUNDO_ALTO = 1080;

// crt-2: la clasificación es SOLO lectura de la máscara, nunca un rastro
// aparte -- para cada uno de 200 puntos muestreados sobre el peor sistema
// (6 planetas, 2 anillos, 40 asteroides), si esSolido es falso la
// clasificación tiene que ser "aire" y viceversa; nunca puede haber un
// punto "aire" según la máscara que se dibuje sólido (roca/borde/escombro)
// ni al revés.
test("crt-2: la clasificación coincide con esSolido en 200 puntos muestreados del peor sistema", () => {
  const sistema = generarSistema(20260926, MUNDO_ANCHO, MUNDO_ALTO, {
    numPlanetas: 6,
    numAnillos: 2,
    numAsteroides: 40,
  });
  const mascara = sistema.mascara;

  // Rejilla de 200 puntos determinista, cubriendo el mundo entero (no una
  // esquina), sin depender de ninguna coordenada "con suerte".
  const puntos: { x: number; y: number }[] = [];
  for (let i = 0; i < 200; i++) {
    const x = Math.floor((i * 97) % mascara.ancho);
    const y = Math.floor((i * 131) % mascara.alto);
    puntos.push({ x, y });
  }
  assert.equal(puntos.length, 200);

  for (const { x, y } of puntos) {
    const solidoMascara = esSolido(mascara, x, y);
    const tipo = clasificarPixelVisual(mascara, x, y);
    if (solidoMascara) {
      assert.notEqual(tipo, "aire", `(${x},${y}) es sólido según la máscara pero se clasifica como aire`);
    } else {
      assert.equal(tipo, "aire", `(${x},${y}) es aire según la máscara pero se clasifica como ${tipo}`);
    }
  }
});

// crt-2: la clasificación se repite idéntica sobre el mismo punto -- es una
// función pura, no depende de llamadas anteriores ni de orden de lectura.
test("crt-2: clasificarPixelVisual es determinista (misma entrada, misma salida, repetido)", () => {
  const sistema = generarSistema(20260926, MUNDO_ANCHO, MUNDO_ALTO, { numPlanetas: 6, numAnillos: 2, numAsteroides: 40 });
  const puntos = [
    { x: 10, y: 10 },
    { x: 500, y: 300 },
    { x: 960, y: 540 },
  ];
  for (const { x, y } of puntos) {
    const primera = clasificarPixelVisual(sistema.mascara, x, y);
    const segunda = clasificarPixelVisual(sistema.mascara, x, y);
    assert.equal(primera, segunda);
  }
});

test("crt-1/crt-2: un bloque sólido rodeado de aire se clasifica 'roca' en el centro y 'borde-quemado' cerca del borde", () => {
  const mascara = crearMascaraVacia(60, 60);
  // Disco sólido de radio 20 centrado en (30,30): deja de sobra un centro
  // lejos de cualquier aire y un anillo justo dentro del radio de borde.
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      if ((x - 30) ** 2 + (y - 30) ** 2 <= 20 * 20) {
        mascara.datos[y * 60 + x] = SOLIDO;
      }
    }
  }

  assert.equal(clasificarPixelVisual(mascara, 30, 30), "roca");
  // A una distancia del radio menor que ANCHO_BORDE_QUEMADO_PX del borde
  // (20), este punto sigue dentro del disco (x=30+18=48 -> distancia al
  // centro 18 < 20) pero a 2px del aire, dentro de la banda declarada.
  assert.equal(clasificarPixelVisual(mascara, 48, 30, ANCHO_BORDE_QUEMADO_PX), "borde-quemado");
  // Fuera del disco por completo (distancia 60 >> 20): aire sin ambigüedad.
  assert.equal(clasificarPixelVisual(mascara, 0, 0), "aire");
});

test("crt-1: tras tres impactos deterministas, el borde del cráter se clasifica distinto del interior intacto del mismo planeta", () => {
  const mascara: Mascara = { ancho: 400, alto: 400, datos: new Uint8Array(400 * 400) };
  for (let y = 0; y < 400; y++) {
    for (let x = 0; x < 400; x++) {
      if ((x - 200) ** 2 + (y - 200) ** 2 <= 150 * 150) {
        mascara.datos[y * 400 + x] = SOLIDO;
      }
    }
  }

  // Tres impactos deterministas en el mismo flanco del planeta.
  aplicarHuellaCircular(mascara, 260, 200, 25, "restar");
  aplicarHuellaCircular(mascara, 270, 230, 20, "restar");
  aplicarHuellaCircular(mascara, 250, 170, 18, "restar");

  // Lejos de cualquier cráter: roca intacta.
  assert.equal(clasificarPixelVisual(mascara, 120, 200), "roca");
  // Justo fuera del radio del impacto en (260,200) radio 25 -- a 3px del
  // borde del cráter (distancia 28 al centro de la huella), dentro de la
  // banda declarada pero sin que la propia huella lo haya vaciado.
  assert.equal(clasificarPixelVisual(mascara, 288, 200), "borde-quemado");
  // El propio interior del cráter es aire, no un tipo "dañado" sólido.
  assert.equal(clasificarPixelVisual(mascara, 260, 200), "aire");
});

// crt-2: el escombro (material ESCOMBRO) se lee tal cual, sin pasar por la
// detección de borde -- es un material distinto, no una roca dañada.
test("crt-2: un píxel de escombro se clasifica 'escombro' aunque esté junto a aire, nunca 'borde-quemado'", () => {
  const mascara = crearMascaraVacia(20, 20);
  mascara.datos[10 * 20 + 10] = ESCOMBRO;
  // El vecino es AIRE por defecto (máscara vacía): el escombro no se
  // reclasifica como borde-quemado por tener aire al lado.
  assert.equal(clasificarPixelVisual(mascara, 10, 10), "escombro");
  assert.equal(mascara.datos[10 * 20 + 10], ESCOMBRO, "la clasificación no debe mutar la máscara");
});

test("crt-2: el aire siempre se clasifica 'aire', sea cual sea su vecindario", () => {
  const mascara = crearMascaraVacia(10, 10);
  for (let i = 0; i < mascara.datos.length; i++) mascara.datos[i] = SOLIDO;
  mascara.datos[5 * 10 + 5] = AIRE;
  assert.equal(clasificarPixelVisual(mascara, 5, 5), "aire");
});
