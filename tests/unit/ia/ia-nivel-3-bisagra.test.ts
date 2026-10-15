import { test } from "node:test";
import { ALMIRANTE_BISAGRA } from "@/sim/ia/personalidades";
import { comprobarSeparacionNiveles } from "../../utils/comprobarSeparacionNiveles";

test("niv-3: Almirante Bisagra, fácil < normal < difícil con ≥ 8 puntos entre niveles", () => {
  comprobarSeparacionNiveles(ALMIRANTE_BISAGRA);
});
