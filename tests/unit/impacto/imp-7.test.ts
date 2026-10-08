import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";

const TOPE_GENERAL_PX = 70;
// rayo-laser (armas-reprecio-roles): las bandas de 20px por debajo de 80 ya
// tienen sus 4 armas (armas-reprecio-roles-4) -- 80 es el único valor que
// cumple esa regla, igual que Despedida ya tenía su propio tope por ser el
// arma de autodaño.
const TOPE_RAYO_LASER_PX = 80;
const TOPE_DESPEDIDA_PX = 160;

test("imp-7: los radios de daño están acotados en datos (ninguno > 70px salvo rayo-laser a 80px y Despedida a 160px)", () => {
  for (const arma of CATALOGO_ARMAS) {
    if (arma.efecto.tipo !== "danio" && arma.efecto.tipo !== "danio-y-autodanio") {
      continue; // El Gravitón (empuje) no declara radio de daño.
    }
    const tope =
      arma.id === "despedida"
        ? TOPE_DESPEDIDA_PX
        : arma.id === "rayo-laser"
          ? TOPE_RAYO_LASER_PX
          : TOPE_GENERAL_PX;
    assert.ok(
      arma.efecto.radioEfectoPx <= tope,
      `${arma.id}: radioEfectoPx=${arma.efecto.radioEfectoPx}px supera el tope de ${tope}px`,
    );
  }
});
