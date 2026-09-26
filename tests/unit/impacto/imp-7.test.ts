import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";

const TOPE_GENERAL_PX = 70;
const TOPE_DESPEDIDA_PX = 160;

test("imp-7: los radios de daño están acotados en datos (ninguno > 70px salvo Despedida, que no pasa de 160px), y el casco es 22px", () => {
  assert.equal(RADIO_CASCO_NAVE_PX, 22, "el radio de casco declarado debe ser exactamente 22px");

  for (const arma of CATALOGO_ARMAS) {
    if (arma.efecto.tipo !== "danio" && arma.efecto.tipo !== "danio-y-autodanio") {
      continue; // El Gravitón (empuje) no declara radio de daño.
    }
    const tope = arma.id === "despedida" ? TOPE_DESPEDIDA_PX : TOPE_GENERAL_PX;
    assert.ok(
      arma.efecto.radioEfectoPx <= tope,
      `${arma.id}: radioEfectoPx=${arma.efecto.radioEfectoPx}px supera el tope de ${tope}px`,
    );
  }
});
