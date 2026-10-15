import { test } from "node:test";
import { CHISPA } from "@/sim/ia/personalidades";
import { comprobarSeparacionNiveles } from "../../utils/comprobarSeparacionNiveles";

test("niv-3: Chispa, fácil < normal < difícil con ≥ 8 puntos entre niveles", () => {
  comprobarSeparacionNiveles(CHISPA);
});
