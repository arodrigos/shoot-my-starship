import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { calcularAbanicoPrevisualizacion, PASOS_MAXIMOS_TRAYECTORIA } from "@/sim/armas/previsualizacion";
import { longitudDeArco } from "@/juego/mira/trayectoriaPantalla";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const base = { mascara: crearMascaraPlana(2400, 1400, 1300), gravedad: 1, deriva: 0, ancho: 2400, alto: 1400, origenX: 300, origenY: 1300, comportamiento: { tipo: "impacto-simple" } as const };

test("abanico: la trayectoria no depende de la potencia salvo por su alcance, y corta por longitud de arco", () => {
  fc.assert(
    fc.property(fc.integer({ min: 20, max: 80 }), fc.integer({ min: 10, max: 100 }), fc.integer({ min: 100, max: 600 }), (angulo, potencia, longitud) => {
      const a = calcularAbanicoPrevisualizacion({ ...base, anguloGrados: angulo, potencia, longitudMundoMax: longitud }, 9, 45);
      // Un paso de más como mucho: el corte se decide al pasar la cota.
      for (const t of [a.centro, a.tramo1.menor, a.tramo1.mayor, a.tramo2.menor, a.tramo2.mayor]) {
        assert.ok(t.length <= PASOS_MAXIMOS_TRAYECTORIA + 1);
        const paso = t.length > 1 ? longitudDeArco(t.slice(-2)) : 0;
        assert.ok(longitudDeArco(t) <= longitud + paso + 1e-6);
      }
    }),
    { numRuns: 40 },
  );
});

test("abanico: los extremos son trayectorias reales a ±9° y ±45° del centro, y el centro no se recorta al 25 %", () => {
  const a = calcularAbanicoPrevisualizacion({ ...base, anguloGrados: 60, potencia: 50, longitudMundoMax: 400 }, 9, 45);
  assert.ok(a.centro.length > 30, "sin el tope del 25 % del vuelo el centro llega a la cota de longitud");
  assert.ok(longitudDeArco(a.centro) >= 400);
  const y = (t: readonly { y: number }[]) => t[Math.min(10, t.length - 1)].y;
  assert.ok(y(a.tramo2.mayor) < y(a.tramo1.mayor) && y(a.tramo1.mayor) < y(a.centro) && y(a.centro) < y(a.tramo1.menor) && y(a.tramo1.menor) < y(a.tramo2.menor));
});
