import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { PERSONALIDADES } from "@/sim/ia/personalidades";

// ia-autodanio-4: ninguna personalidad debe preferir un arma de daño 0 COMO
// ARMA DE DAÑO -- si está en su lista de preferencia, el catálogo tiene que
// marcarla utilitaria explícitamente (ia-autodanio-4, tipos.ts). Cruza datos
// contra datos (personalidades.ts contra catalogo.ts), no reordena ninguna
// lista de preferencia: reordenar ya rompió las bandas de ia-3 en la
// iteración anterior (ver desviaciones del entregable previo).
test("ia-autodanio-4: toda arma preferida de daño 0 está marcada utilitaria en el catálogo", () => {
  for (const personalidad of PERSONALIDADES) {
    for (const idArma of personalidad.ordenPreferenciaArmas) {
      const arma = buscarArma(idArma);
      const esDanioCero = arma.efecto.tipo === "danio" && arma.efecto.danioMaximo === 0;
      if (esDanioCero) {
        assert.ok(
          arma.utilitaria === true,
          `${personalidad.nombre} prefiere "${arma.id}" (daño 0) sin que el catálogo la marque utilitaria`,
        );
      }
    }
  }
});
