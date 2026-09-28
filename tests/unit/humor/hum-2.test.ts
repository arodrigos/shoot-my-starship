import { test } from "node:test";
import assert from "node:assert/strict";
import { crearSelectorBromas } from "@/contenido/selectorBromas";
import { bancoDisparoDe, bancoImpactoDe } from "@/contenido/bancoBromas";

test("hum-2: en una ventana del tamaño del banco no se repite ninguna frase de disparo", () => {
  const selector = crearSelectorBromas(42);
  const tamano = bancoDisparoDe("la-contable").length;
  const dispensadas = Array.from({ length: tamano }, () => selector.elegirDisparo("la-contable"));
  assert.equal(new Set(dispensadas).size, tamano, "no debe haber repetidas dentro de una rotación completa");
});

test("hum-2: al agotar la bolsa, se rebaraja (reset) en vez de devolver un hueco vacío", () => {
  const selector = crearSelectorBromas(7);
  const tamano = bancoDisparoDe("chispa").length;
  // Dos rotaciones completas: la segunda solo es posible si la bolsa se
  // rebaraja sola al vaciarse, sin lanzar ni devolver undefined.
  const dosVueltas = Array.from({ length: tamano * 2 }, () => selector.elegirDisparo("chispa"));
  assert.equal(dosVueltas.length, tamano * 2);
  assert.ok(dosVueltas.every((frase) => typeof frase === "string" && frase.length > 0));
});

test("hum-2: en el cruce entre una rotación y la siguiente no se repite la última frase dispensada", () => {
  const selector = crearSelectorBromas(123);
  const tamano = bancoImpactoDe("almirante-bisagra", "acierto").length;
  const primeraVuelta = Array.from({ length: tamano }, () => selector.elegirImpacto("almirante-bisagra", "acierto"));
  const primeraDeLaSegunda = selector.elegirImpacto("almirante-bisagra", "acierto");
  assert.notEqual(primeraDeLaSegunda, primeraVuelta[tamano - 1], "no debe repetir justo la última frase de la rotación anterior");
});

test("hum-2: disparo e impacto son bolsas independientes -- vaciar una no afecta a la otra", () => {
  const selector = crearSelectorBromas(9);
  const tamanoDisparo = bancoDisparoDe("la-contable").length;
  for (let i = 0; i < tamanoDisparo; i++) selector.elegirDisparo("la-contable");
  // Si compartieran bolsa, esta primera llamada de impacto ya habría forzado
  // un rebarajado ajeno a su propia categoría.
  const impacto = selector.elegirImpacto("la-contable", "casi");
  assert.ok(bancoImpactoDe("la-contable", "casi").includes(impacto));
});
