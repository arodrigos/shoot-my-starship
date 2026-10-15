import { test } from "node:test";
import { LA_CONTABLE } from "@/sim/ia/personalidades";
import { comprobarSeparacionNiveles } from "../../utils/comprobarSeparacionNiveles";

test("niv-3: La Contable, fácil < normal < difícil con ≥ 8 puntos entre niveles", () => {
  comprobarSeparacionNiveles(LA_CONTABLE);
});
