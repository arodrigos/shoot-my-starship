import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";

// modo-3: los tres identificadores declarados en el diseño -- por id, nunca
// por posición, para que reordenar el catálogo no rompa este criterio por
// accidente. Actualizado en armas-reprecio-roles (armas-reprecio-roles-2):
// pepinazo-cortesia deja de ser a la vez gratis y la más fácil de acertar,
// como pide el propio criterio -- pelota-de-chatarra pasa a ser la tercera
// gratis en su lugar.
const IDS_GRATIS_DECLARADOS = ["pelota-de-chatarra", "petardo-de-feria", "zanjadora-manolita"];

test("modo-3: el catálogo tiene exactamente tres armas de coste 0, y son las declaradas por id", () => {
  const gratis = CATALOGO_ARMAS.filter((arma) => (arma.coste ?? 0) === 0);
  assert.equal(gratis.length, 3);
  const idsGratis = gratis.map((arma) => arma.id).sort();
  assert.deepEqual(idsGratis, [...IDS_GRATIS_DECLARADOS].sort());
});
