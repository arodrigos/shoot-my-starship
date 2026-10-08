import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { reproducirDetonaciones, type FuenteExplosiones } from "@/juego/efectos/reproductorDetonaciones";
import type { Detonacion } from "@/sim/partida/detonaciones";
import type { DatosExplosionPorCapas } from "@/juego/efectos/ExplosionPorCapas";
import { faseDeRobots, type EstadoRobot } from "@/sim/armas/minirobot";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import { crearMascaraVacia } from "@/sim/terreno/mascara";

// Espía de ExplosionPorCapas: devuelve los datos tal como los pintaría el
// plan real, sin necesitar Phaser.
function espia(): { fuente: FuenteExplosiones; llamadas: Detonacion[] } {
  const llamadas: Detonacion[] = [];
  const fuente: FuenteExplosiones = {
    reproducir(detonacion): DatosExplosionPorCapas {
      llamadas.push(detonacion);
      return { x: detonacion.x, y: detonacion.y, danio: detonacion.danioAplicado, escala: 1, inicioMs: 0, radioOnda: detonacion.radioEfectoU, particulas: 0, sobre: detonacion.sobre };
    },
  };
  return { fuente, llamadas };
}

const detonacionArb = fc.record({
  x: fc.double({ min: 0, max: 3000, noNaN: true }),
  y: fc.double({ min: 0, max: 2000, noNaN: true }),
  // Los orígenes que declara el núcleo: vuelo, submunición, Minirobot, tormenta y corazón.
  armaId: fc.constantFrom("pepinazo-cortesia", "racimo-de-tuppers", "minirobot-saltaplanetas", "tormenta", "corazon"),
  radioEfectoU: fc.double({ min: 0, max: 400, noNaN: true }),
  danioAplicado: fc.integer({ min: 0, max: 100 }),
  sobre: fc.constantFrom("nave" as const, "planeta" as const, "vacio" as const),
});

test("mrb-2: tantas explosiones como detonaciones, cada una a ≤ 1 u, en orden y con una sola marca", () => {
  fc.assert(
    fc.property(fc.array(detonacionArb, { maxLength: 12 }), (detonaciones) => {
      const { fuente, llamadas } = espia();
      const marcas: string[] = [];
      const lanzadas = reproducirDetonaciones(detonaciones, fuente, 1, false, (n) => marcas.push(n));
      assert.equal(lanzadas.length, detonaciones.length);
      assert.deepEqual(llamadas, detonaciones);
      lanzadas.forEach((explosion, i) => {
        assert.ok(Math.hypot(explosion.x - detonaciones[i].x, explosion.y - detonaciones[i].y) <= 1);
      });
      assert.equal(marcas.length, detonaciones.length > 0 ? 1 : 0);
    }),
  );
});

// El mismo contrato con la detonación real del Minirobot: la declara
// faseDeRobots, y por ahí llega al reproductor mezclada con la del vuelo.
test("mrb-2: la detonación del Minirobot que declara el núcleo se reproduce en su sitio", () => {
  const mundo: ParametrosMundo = { ancho: 1200, alto: 800, gravedad: 1, deriva: 0, etiquetaDeriva: "" };
  const mascara = crearMascaraVacia(mundo.ancho, mundo.alto);
  fc.assert(
    fc.property(fc.integer({ min: 100, max: 1000 }), fc.integer({ min: 100, max: 700 }), (x, y) => {
      const robot: EstadoRobot = { dueno: 0, objetivoId: 1, armaId: "minirobot-saltaplanetas", planetaId: 1, x: x + 5, y, saltos: 1 };
      const fase = faseDeRobots({
        robots: [robot],
        turno: 0,
        naves: [
          { x: 50, y: 50, integridad: 100 },
          { x, y, integridad: 100 },
        ],
        mascara,
        mundo,
        planetas: undefined,
      });
      assert.equal(fase.detonaciones.length, 1);
      assert.equal(fase.detonaciones[0].armaId, "minirobot-saltaplanetas");
      const { fuente } = espia();
      const lanzadas = reproducirDetonaciones(fase.detonaciones, fuente, 1, false, () => undefined);
      assert.equal(lanzadas.length, 1);
      assert.ok(Math.hypot(lanzadas[0].x - fase.detonaciones[0].x, lanzadas[0].y - fase.detonaciones[0].y) <= 1);
    }),
  );
});
