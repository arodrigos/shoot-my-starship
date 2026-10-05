import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { colocarNaves, SEPARACION_MINIMA_NAVES_PX } from "@/sim/naves/colocacion";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import { MAX_NOMBRE_JUGADOR, sanearNombre } from "@/juego/jugadores";

const MUNDO: ParametrosMundo = { ancho: 1121, alto: 1156, gravedad: 0, deriva: 0, etiquetaDeriva: "Vacío" };

describe("multi-setup-partida: colocarNaves de 2 a 4 naves", () => {
  it("con 2 naves sigue colocando exactamente 2, como antes del bloque", () => {
    const resultado = colocarNaves(20260926, MUNDO, crearEstadoAleatorio(20260926));
    assert.equal(resultado.naves.length, 2);
  });

  for (const cantidad of [3, 4]) {
    it(`coloca ${cantidad} naves vivas, separadas y dentro del mundo en 12 semillas`, () => {
      for (let semilla = 1; semilla <= 12; semilla++) {
        const { naves } = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), cantidad);
        assert.equal(naves.length, cantidad, `semilla ${semilla}`);
        for (const nave of naves) {
          assert.equal(nave.integridad, 100);
          assert.ok(nave.x >= 0 && nave.x <= MUNDO.ancho, `semilla ${semilla}: x ${nave.x} fuera del mundo`);
          assert.ok(nave.y !== undefined && nave.y >= 0 && nave.y <= MUNDO.alto);
        }
      }
    });
  }

  for (const cantidad of [3, 4]) {
    it(`con ${cantidad} naves ninguna de 20 semillas cae al corredor y todas quedan separadas y fuera de la franja de botones`, () => {
      const separacionMinima = Math.min(MUNDO.ancho, MUNDO.alto) / 16;
      for (let semilla = 1; semilla <= 20; semilla++) {
        const resultado = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), cantidad);
        assert.notEqual(resultado.escalon, "corredor", `semilla ${semilla}: cae al último recurso, con las naves en fila arriba`);
        for (const [i, a] of resultado.naves.entries()) {
          if (resultado.escalon === "sin-viabilidad") {
            assert.ok((a.y ?? 0) >= MUNDO.alto * 0.15, `semilla ${semilla}: nave ${i} bajo los botones del HUD (y ${a.y})`);
          }
          for (const b of resultado.naves.slice(i + 1)) {
            assert.ok(Math.hypot(a.x - b.x, (a.y ?? 0) - (b.y ?? 0)) >= separacionMinima, `semilla ${semilla}`);
          }
        }
      }
    });
  }

  it("con 2 naves la separación sigue siendo la dura de siempre", () => {
    for (let semilla = 1; semilla <= 8; semilla++) {
      const { naves } = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), 2);
      const [a, b] = naves;
      assert.ok(Math.hypot(a.x - b.x, (a.y ?? 0) - (b.y ?? 0)) >= SEPARACION_MINIMA_NAVES_PX, `semilla ${semilla}`);
    }
  });
});

describe("multi-setup-partida-5: el nombre de jugador", () => {
  it("una etiqueta HTML se conserva como texto literal, sin interpretarla", () => {
    assert.equal(sanearNombre("<b>x</b>", "Jugador 1"), "<b>x</b>");
  });

  it("propiedad: para cualquier entrada el nombre tiene entre 1 y 16 puntos de código y ningún carácter de control", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (texto) => {
        const nombre = sanearNombre(texto, "Jugador 1");
        const puntos = Array.from(nombre);
        assert.ok(puntos.length >= 1 && puntos.length <= MAX_NOMBRE_JUGADOR);
        assert.ok(!/[\u0000-\u001f\u007f]/.test(nombre));
        assert.equal(nombre, nombre.trim());
      }),
      { numRuns: 500 },
    );
  });

  it("propiedad: sanear es idempotente", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (texto) => {
        const una = sanearNombre(texto, "Jugador 1");
        assert.equal(sanearNombre(una, "Jugador 1"), una);
      }),
      { numRuns: 500 },
    );
  });

  it("un nombre vacío o solo de espacios cae al respaldo", () => {
    assert.equal(sanearNombre("   \n\t ", "Jugador 3"), "Jugador 3");
  });
});
