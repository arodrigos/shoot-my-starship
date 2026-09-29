import { test } from "node:test";
import assert from "node:assert/strict";
import { opacidadEnPunto, OPACIDAD_NUCLEO, TECHO_OPACIDAD_FUERA_NUCLEO } from "@/juego/naves/opacidadCasco";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";

// esc-5: en las ocho direcciones de apuntado (muestreadas como ocho ángulos
// alrededor del centro), ningún píxel a más de RADIO_CASCO_NAVE_PX del
// centro puede alcanzar la opacidad del núcleo, y los píxeles dentro del
// radio sí la alcanzan -- así el jugador no puede leer como blindaje sólido
// nada que esté fuera de lo que de verdad colisiona.
test("esc-5: dentro del radio de colisión la nave es opaca; fuera, nunca supera el techo declarado", () => {
  for (const dir of [1, -1] as const) {
    for (let k = 0; k < 8; k++) {
      const angulo = (k / 8) * 2 * Math.PI;

      const radioDentro = RADIO_CASCO_NAVE_PX - 1;
      const xDentro = Math.cos(angulo) * radioDentro;
      const yDentro = Math.sin(angulo) * radioDentro;
      assert.equal(
        opacidadEnPunto(xDentro, yDentro, dir),
        OPACIDAD_NUCLEO,
        `dir=${dir} ángulo=${angulo.toFixed(2)}: punto dentro del casco de colisión no es opaco`,
      );

      // +5px de mundo por fuera del radio: comprobado por separado (ver
      // guion de este bloque) que sigue dentro de la silueta dibujada en
      // las ocho direcciones y en ambos sentidos.
      const radioFuera = RADIO_CASCO_NAVE_PX + 5;
      const xFuera = Math.cos(angulo) * radioFuera;
      const yFuera = Math.sin(angulo) * radioFuera;
      const opacidadFuera = opacidadEnPunto(xFuera, yFuera, dir);
      assert.ok(
        opacidadFuera <= TECHO_OPACIDAD_FUERA_NUCLEO,
        `dir=${dir} ángulo=${angulo.toFixed(2)}: punto fuera del núcleo supera el techo de opacidad (${opacidadFuera} > ${TECHO_OPACIDAD_FUERA_NUCLEO})`,
      );
    }
  }
});

test("esc-5: el techo de opacidad fuera del núcleo es estrictamente menor que la opacidad del núcleo", () => {
  assert.ok(TECHO_OPACIDAD_FUERA_NUCLEO < OPACIDAD_NUCLEO);
});
