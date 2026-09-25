import { test } from "node:test";
import assert from "node:assert/strict";
import { generarMascara } from "@/sim/terreno/generador";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";
import { AIRE, esSolido, SOLIDO, type Mascara } from "@/sim/terreno/mascara";

// Implementación de referencia escrita a propósito DENTRO del test, con su
// propio doble bucle y su propia raíz cuadrada: no llama a
// aplicarHuellaCircular para calcular lo que espera, porque eso sería el
// mismo test circular que ya ha pasado de verdad en esta flota (un test de
// seguridad que reconstruía la cadena que decía validar).
function huellaDeReferencia(mascara: Mascara, cx: number, cy: number, radio: number): Uint8Array {
  const copia = new Uint8Array(mascara.datos);
  for (let y = 0; y < mascara.alto; y++) {
    for (let x = 0; x < mascara.ancho; x++) {
      const distancia = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (distancia <= radio) {
        copia[y * mascara.ancho + x] = AIRE;
      }
    }
  }
  return copia;
}

test("terreno-2: una explosión vacía exactamente los píxeles a distancia <= R y ninguno a distancia > R", () => {
  const original = generarMascara(424242, 200, 150);
  const cx = 90;
  const cy = 70;
  const radio = 35;

  const esperado = huellaDeReferencia(original, cx, cy, radio);

  const mascaraBajoPrueba: Mascara = {
    ancho: original.ancho,
    alto: original.alto,
    datos: new Uint8Array(original.datos),
  };
  aplicarHuellaCircular(mascaraBajoPrueba, cx, cy, radio, "restar");

  assert.deepEqual(Array.from(mascaraBajoPrueba.datos), Array.from(esperado));
});

test("terreno-2: no toca ningún píxel a distancia > R (control negativo, radio 0)", () => {
  const original = generarMascara(424242, 200, 150);
  const cx = 90;
  const cy = 70;

  const mascaraBajoPrueba: Mascara = {
    ancho: original.ancho,
    alto: original.alto,
    datos: new Uint8Array(original.datos),
  };
  aplicarHuellaCircular(mascaraBajoPrueba, cx, cy, 0, "restar");

  // Solo el propio píxel central puede haber cambiado; todo lo demás igual.
  let diferencias = 0;
  for (let i = 0; i < original.datos.length; i++) {
    if (original.datos[i] !== mascaraBajoPrueba.datos[i]) diferencias++;
  }
  assert.ok(diferencias <= 1);
  assert.equal(esSolido(mascaraBajoPrueba, cx, cy), false);
});

test("terreno-2: sumar añade material sólido en el radio, con el mismo criterio de distancia", () => {
  const mascara = crearMascaraDeAire(50, 50);
  aplicarHuellaCircular(mascara, 25, 25, 10, "sumar");

  assert.equal(esSolido(mascara, 25, 25), true);
  assert.equal(esSolido(mascara, 25, 34), true); // a 9 px, dentro del radio 10
  assert.equal(esSolido(mascara, 25, 40), false); // a 15 px, fuera del radio 10
});

function crearMascaraDeAire(ancho: number, alto: number): Mascara {
  return { ancho, alto, datos: new Uint8Array(ancho * alto).fill(0) };
}

void SOLIDO;
