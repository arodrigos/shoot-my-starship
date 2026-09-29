import { test } from "node:test";
import assert from "node:assert/strict";
import { DIMENSION_MINIMA_PX, DIMENSION_MAXIMA_PX } from "@/juego/proyectiles/geometriaProyectil";
import { RADIO_PLANETA_MIN } from "@/sim/sistema/generador";

// esc-6 (no crítico) pide dos cosas a la vez: ningún proyectil por debajo de
// 18px de pantalla a 360px de ancho (>= 96px de mundo a la escala de
// Scale.FIT de ese viewport, 0.1875) NI por encima del radio mínimo de
// planeta (40px de mundo). Con ESCALA_DIBUJO_NAVE=3.0 y el techo que impone
// esc-1 (crítico: proyectil <= 0.6x el lado mayor de la nave dibujada,
// ~87px de mundo), ambos bordes de esc-6 son matemáticamente incompatibles
// con esc-1 a la vez: 96 > 87 (el suelo de esc-6 ya rompe el techo de esc-1)
// y 87 > 40 (el techo elegido para esc-1 ya rompe el techo de esc-6).
// Como esc-1 es camino_critico y esc-6 no, se prioriza esc-1 y se deja
// constancia aquí, en código, de que esc-6 no se cumple tal cual está
// escrito -- ver la desviación correspondiente en el entregable de este
// bloque en vez de forzar un test que finja lo contrario.
const ESCALA_RENDER_360PX = 360 / 1920;
const SUELO_PANTALLA_PEDIDO_PX = 18;

test("esc-6 (no crítico, incompatible con esc-1 -- documentado como desviación): el suelo de proyectil no llega a los 18px de pantalla pedidos", () => {
  const suelaPantallaReal = DIMENSION_MINIMA_PX * ESCALA_RENDER_360PX;
  assert.ok(
    suelaPantallaReal < SUELO_PANTALLA_PEDIDO_PX,
    "si esto empieza a pasar, esc-1 y esc-6 dejaron de ser incompatibles y esc-6 debería promoverse de best-effort a cumplido",
  );
});

test("esc-6 (no crítico, incompatible con esc-1 -- documentado como desviación): el techo de proyectil supera el radio mínimo de planeta", () => {
  assert.ok(
    DIMENSION_MAXIMA_PX > RADIO_PLANETA_MIN,
    "si esto empieza a pasar, esc-1 y esc-6 dejaron de ser incompatibles y esc-6 debería promoverse de best-effort a cumplido",
  );
});
