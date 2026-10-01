import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amplitudSacudida,
  intensidadDestelloDanio,
  DURACION_SACUDIDA_IMPACTO_MS,
  DURACION_DESTELLO_DANIO_MS,
} from "@/juego/efectos/realceImpacto";

// rlc-1: la amplitud de sacudida crece con el daño resuelto, nunca supera el
// tope declarado, y la duración es una constante finita (no un tween sin
// fin). Mismo patrón que exl-1 para escalaDeDanio: monótona, acotada, con
// casos construidos a propósito en vez de propiedades al azar.
test("rlc-1: amplitudSacudida es monótona, acotada y nunca negativa", () => {
  const baja = amplitudSacudida(4);
  const media = amplitudSacudida(24);
  const alta = amplitudSacudida(60);

  assert.ok(baja > 0, `amplitud(4)=${baja} debería ser mayor que cero`);
  assert.ok(baja < media, `amplitud(4)=${baja} debería ser menor que amplitud(24)=${media}`);
  assert.ok(media < alta, `amplitud(24)=${media} debería ser menor que amplitud(60)=${alta}`);

  assert.equal(amplitudSacudida(0), amplitudSacudida(-10), "el daño nunca puede ser negativo: se satura a 0");
  assert.equal(amplitudSacudida(60), amplitudSacudida(6000), "por encima del tope de referencia la amplitud se satura");
  assert.ok(amplitudSacudida(6000) <= amplitudSacudida(60) + Number.EPSILON, "ningún daño supera el tope duro");
});

test("rlc-1: intensidadDestelloDanio es monótona, acotada y nunca negativa", () => {
  const baja = intensidadDestelloDanio(4);
  const media = intensidadDestelloDanio(24);
  const alta = intensidadDestelloDanio(60);

  assert.ok(baja > 0, `intensidad(4)=${baja} debería ser mayor que cero`);
  assert.ok(baja < media, `intensidad(4)=${baja} debería ser menor que intensidad(24)=${media}`);
  assert.ok(media < alta, `intensidad(24)=${media} debería ser menor que intensidad(60)=${alta}`);
  assert.equal(intensidadDestelloDanio(60), intensidadDestelloDanio(600), "por encima del tope se satura");
  assert.ok(alta <= 1, "la intensidad nunca supera 1 (alfa máximo)");
});

test("rlc-1: las duraciones son finitas y fijas, no tweens sin fin", () => {
  assert.ok(Number.isFinite(DURACION_SACUDIDA_IMPACTO_MS) && DURACION_SACUDIDA_IMPACTO_MS > 0);
  assert.ok(Number.isFinite(DURACION_DESTELLO_DANIO_MS) && DURACION_DESTELLO_DANIO_MS > 0);
});
