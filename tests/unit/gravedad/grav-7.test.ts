import { test } from "node:test";
import assert from "node:assert/strict";
import { crearGeneradorAleatorio, type GeneradorAleatorio } from "@/sim/aleatorio";
import { crearMascaraVacia, PLANETA_MAX, PLANETA_MIN } from "@/sim/terreno/mascara";
import { aplicarHuellaCapsula, aplicarHuellaCircular, type ContadoresPlanetas } from "@/sim/terreno/huella";
import { contarPixelesPorMaterial } from "@/sim/gravedad/planetas";
import { semillasDelLote } from "../../utils/loteAleatorio";

const NUMERO_HUELLAS = 200;
const ANCHO = 600;
const ALTO = 400;

function entre(gen: GeneradorAleatorio, min: number, max: number): number {
  return min + gen() * (max - min);
}

test("grav-7: el contador incremental de píxeles por planeta nunca se desincroniza de la máscara tras 200 huellas al azar", () => {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  const contadores: ContadoresPlanetas = new Map();

  // Se reutiliza tests/utils/loteAleatorio.ts (semillasDelLote) solo para
  // derivar UNA semilla determinista con la que alimentar el generador de
  // este test -- no para lotes de partidas, que no vienen al caso aquí.
  const semilla = semillasDelLote(20260925, 1)[0];
  const gen = crearGeneradorAleatorio(semilla);

  for (let i = 0; i < NUMERO_HUELLAS; i++) {
    const material = Math.floor(entre(gen, PLANETA_MIN, PLANETA_MAX + 1));
    const signo = gen() < 0.5 ? "restar" : "sumar";
    const cx = entre(gen, 0, ANCHO);
    const cy = entre(gen, 0, ALTO);

    if (gen() < 0.5) {
      const radio = entre(gen, 1, 40);
      aplicarHuellaCircular(mascara, cx, cy, radio, signo, material, contadores);
    } else {
      const medioLargo = entre(gen, 1, 60);
      const radio = entre(gen, 1, 20);
      aplicarHuellaCapsula(mascara, cx, cy, medioLargo, radio, signo, material, contadores);
    }
  }

  const brutoAlFinal = contarPixelesPorMaterial(mascara);
  for (let id = PLANETA_MIN; id <= PLANETA_MAX; id++) {
    assert.equal(contadores.get(id) ?? 0, brutoAlFinal.get(id) ?? 0, `material ${id}: contador incremental desincronizado`);
  }
});
