import { test } from "node:test";
import assert from "node:assert/strict";
import { escalaDeDanio, fasesActivasEn, VENTANAS_EXPLOSION } from "@/juego/efectos/ExplosionPorCapas";

// exl-1: la escala es una función del daño real, no una constante -- dos
// daños distintos tienen que dar dos escalas distintas, y la escala crece de
// forma monótona con el daño.
test("exl-1: escalaDeDanio es proporcional al daño, no fija, y monótona", () => {
  const escalaBaja = escalaDeDanio(4);
  const escalaMedia = escalaDeDanio(24);
  const escalaAlta = escalaDeDanio(60);

  assert.ok(escalaBaja < escalaMedia, `escala(4)=${escalaBaja} debería ser menor que escala(24)=${escalaMedia}`);
  assert.ok(escalaMedia < escalaAlta, `escala(24)=${escalaMedia} debería ser menor que escala(60)=${escalaAlta}`);
  assert.equal(escalaDeDanio(0), escalaDeDanio(-5), "el daño nunca puede ser negativo: se satura a 0");
  assert.equal(escalaDeDanio(60), escalaDeDanio(600), "por encima del tope de referencia la escala se satura a 1");
});

// exl-1: "se distinguen al menos tres capas activas en instantes distintos".
// Función pura y determinista (issue #151): nunca un sleep ni una ventana de
// tiempo real, siempre la pregunta "¿qué capas tocan a los X ms?".
test("exl-1: fasesActivasEn distingue destello, onda y escombros en instantes distintos de la misma explosión", () => {
  assert.deepEqual(fasesActivasEn(0).includes("destello"), true);
  assert.deepEqual(fasesActivasEn(0).includes("humo"), false, "el humo aún no ha arrancado en el instante 0");

  const en300 = fasesActivasEn(300);
  assert.equal(en300.includes("destello"), false, "a los 300ms el destello (hasta 150ms) ya ha terminado");
  assert.equal(en300.includes("onda"), true);
  assert.equal(en300.includes("escombros"), true);

  const en700 = fasesActivasEn(700);
  assert.equal(en700.includes("destello"), false);
  assert.equal(en700.includes("onda"), false, "a los 700ms la onda (hasta 500ms) ya ha terminado");
  assert.equal(en700.includes("escombros"), true);

  // Caso negativo del propio guardia: mucho después de que todo haya
  // terminado, ninguna capa debe seguir activa.
  const finMasTardio = Math.max(...Object.values(VENTANAS_EXPLOSION).map((v) => v.finMs));
  assert.deepEqual(fasesActivasEn(finMasTardio + 1000), []);
});
