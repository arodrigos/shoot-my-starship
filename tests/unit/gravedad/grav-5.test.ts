import { test } from "node:test";
import assert from "node:assert/strict";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";
import { contarPixelesPorMaterial, recalcularRegistro, type Planeta } from "@/sim/gravedad/planetas";

// Centroide real de un material dado, por fuerza bruta: es la referencia
// "ingenua" contra la que se contrasta LA DECISIÓN DECLARADA de que el
// centro del registro NO se mueve. Si algún día alguien "arregla" esto para
// que el centro siga al centroide, este test es el que lo debe atrapar.
function centroideReal(mascara: ReturnType<typeof crearMascaraVacia>, material: number): { x: number; y: number } {
  let sumaX = 0;
  let sumaY = 0;
  let n = 0;
  for (let y = 0; y < mascara.alto; y++) {
    for (let x = 0; x < mascara.ancho; x++) {
      if (mascara.datos[y * mascara.ancho + x] === material) {
        sumaX += x;
        sumaY += y;
        n++;
      }
    }
  }
  return { x: sumaX / n, y: sumaY / n };
}

test("grav-5: destruir medio planeta no mueve su centro declarado, aunque el centroide real sí se desplace", () => {
  const mascara = crearMascaraVacia(1000, 1000);
  const cx = 500;
  const cy = 500;
  const radio = 150;
  aplicarHuellaCircular(mascara, cx, cy, radio, "sumar", 1);

  const centroideAntes = centroideReal(mascara, 1);
  // Antes de tocarlo, un planeta pintado como disco completo tiene su
  // centroide real prácticamente en su centro geométrico.
  assert.ok(Math.hypot(centroideAntes.x - cx, centroideAntes.y - cy) < 1);

  const pixelesVivosAntes = contarPixelesPorMaterial(mascara).get(1) ?? 0;
  const planetaAntes: Planeta = { id: 1, cx, cy, radio, densidad: 1, pixelesVivos: pixelesVivosAntes };

  // Destrucción asimétrica: se borra todo el semicírculo que cae a la
  // izquierda del centro, muy lejos de cualquier "cráter puntual" -- es el
  // caso que más desplazaría un centroide real. Se escribe directamente
  // sobre la máscara (no hay huella circular/cápsula que recorte media luna)
  // porque aquí solo hace falta el resultado, no ensayar la escritura.
  for (let y = Math.max(0, cy - radio); y <= Math.min(mascara.alto - 1, cy + radio); y++) {
    for (let x = Math.max(0, cx - radio); x < cx; x++) {
      mascara.datos[y * mascara.ancho + x] = 0;
    }
  }

  const centroideDespues = centroideReal(mascara, 1);
  const desplazamientoCentroideReal = Math.hypot(centroideDespues.x - cx, centroideDespues.y - cy);
  assert.ok(desplazamientoCentroideReal > 20, `el centroide real debería haberse desplazado (${desplazamientoCentroideReal}px)`);

  const [planetaDespues] = recalcularRegistro([planetaAntes], mascara);
  assert.equal(planetaDespues.cx, cx);
  assert.equal(planetaDespues.cy, cy);
  assert.ok(planetaDespues.pixelesVivos < pixelesVivosAntes, "el recuento de píxeles sí debe reflejar la destrucción");
});
