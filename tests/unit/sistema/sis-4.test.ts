import { test } from "node:test";
import assert from "node:assert/strict";
import { generarSistema } from "@/sim/sistema/generador";
import { calcularAceleracionGravitatoria } from "@/sim/gravedad/nCuerpos";
import { ESCOMBRO, esSolido, obtenerMaterial } from "@/sim/terreno/mascara";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";

test("sis-4: anillos y asteroides son sólidos en la máscara", () => {
  const { mascara, anillos, asteroides } = generarSistema(20260401, MUNDO_ANCHO, MUNDO_ALTO, {
    numPlanetas: 4,
    numAnillos: 2,
    numAsteroides: 20,
  });

  assert.ok(anillos.length > 0 && asteroides.length > 0, "el sistema de prueba debe tener anillo y cinturón");

  for (const asteroide of asteroides) {
    const cx = Math.round(asteroide.cx);
    const cy = Math.round(asteroide.cy);
    assert.equal(obtenerMaterial(mascara, cx, cy), ESCOMBRO);
    assert.ok(esSolido(mascara, cx, cy));
  }
});

test("sis-4: la gravedad no distingue un sistema con cinturón de uno sin él (mismos planetas)", () => {
  const semilla = 424242;
  const forzarBase = { numPlanetas: 5, numAnillos: 1 };
  const conCinturon = generarSistema(semilla, MUNDO_ANCHO, MUNDO_ALTO, { ...forzarBase, numAsteroides: 30 });
  const sinCinturon = generarSistema(semilla, MUNDO_ANCHO, MUNDO_ALTO, { ...forzarBase, numAsteroides: 0 });

  assert.equal(conCinturon.asteroides.length, 30);
  assert.equal(sinCinturon.asteroides.length, 0);
  // La generación de planetas se agota antes de tocar el cinturón, así que
  // forzar solo numAsteroides no debería mover ni un solo sorteo de planeta.
  assert.deepEqual(conCinturon.planetas, sinCinturon.planetas);

  for (let i = 0; i < 50; i++) {
    const x = (i * 37) % MUNDO_ANCHO;
    const y = (i * 53) % MUNDO_ALTO;

    const aceleracionCon = calcularAceleracionGravitatoria(conCinturon.planetas, x, y);
    const aceleracionSin = calcularAceleracionGravitatoria(sinCinturon.planetas, x, y);

    assert.equal(aceleracionCon.x, aceleracionSin.x, `x=${x},y=${y}: componente x difiere con/sin cinturón`);
    assert.equal(aceleracionCon.y, aceleracionSin.y, `x=${x},y=${y}: componente y difiere con/sin cinturón`);
  }
});
