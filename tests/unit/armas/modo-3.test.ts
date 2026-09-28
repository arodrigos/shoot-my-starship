import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";

// modo-3: los tres identificadores declarados en el diseño (puntos_hitl,
// bloque modos-y-presupuesto) -- por id, nunca por posición, para que
// reordenar el catálogo no rompa este criterio por accidente.
const IDS_GRATIS_DECLARADOS = ["pepinazo-cortesia", "petardo-de-feria", "zanjadora-manolita"];

test("modo-3: el catálogo tiene exactamente tres armas de coste 0, y son las declaradas por id", () => {
  const gratis = CATALOGO_ARMAS.filter((arma) => (arma.coste ?? 0) === 0);
  assert.equal(gratis.length, 3);
  const idsGratis = gratis.map((arma) => arma.id).sort();
  assert.deepEqual(idsGratis, [...IDS_GRATIS_DECLARADOS].sort());
});
