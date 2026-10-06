import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { decidirCompraTurno } from "@/sim/ia/compra";
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE, PERSONALIDADES } from "@/sim/ia/personalidades";
import { costeArma } from "@/sim/partida/economia";

const precioDe = (id: string): number => costeArma(buscarArma(id));

// eco-1 / invariante 6: 200 semillas × 3 perfiles
test("economia-rectificada-6 (propiedad): la compra tiene precio ≤ saldo y es determinista para la misma semilla", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1500 }), fc.integer({ min: 0, max: 30 }), fc.integer({ min: 1, max: 1_000_000 }), (saldo, turno, semilla) => {
      for (const personalidad of PERSONALIDADES) {
        const a = decidirCompraTurno(personalidad, saldo, turno, crearEstadoAleatorio(semilla));
        const b = decidirCompraTurno(personalidad, saldo, turno, crearEstadoAleatorio(semilla));
        assert.deepEqual(a, b);
        assert.ok(precioDe(a.armaId) <= saldo, `${personalidad.id}: ${a.armaId} cuesta ${precioDe(a.armaId)} con saldo ${saldo}`);
      }
    }),
    { numRuns: 200 },
  );
});

// eco-7
test("eco-7: con saldo 850 en el turno 1 cada perfil gasta como dice su carácter", () => {
  const aleatorio = crearEstadoAleatorio(5);
  const bisagra = decidirCompraTurno(ALMIRANTE_BISAGRA, 850, 1, aleatorio);
  const candidatas = ALMIRANTE_BISAGRA.ordenPreferenciaArmas.map(precioDe).filter((precio) => precio > 0 && precio <= 850);
  assert.equal(precioDe(bisagra.armaId), Math.max(...candidatas.filter((precio) => precio > 0)) , "agresivo: la de pago más cara de su orden");

  const contable = decidirCompraTurno(LA_CONTABLE, 850, 1, aleatorio);
  assert.ok(precioDe(contable.armaId) <= 850 / 11, `ahorradora: ${contable.armaId} pasa de 77 cr`);

  let deLaCartera = 0;
  for (let semilla = 1; semilla <= 200; semilla++) {
    if (precioDe(decidirCompraTurno(CHISPA, 850, 1, crearEstadoAleatorio(semilla)).armaId) > 0) deLaCartera += 1;
  }
  assert.ok(deLaCartera >= 80 && deLaCartera <= 120, `mixta: ${deLaCartera}/200 de pago, fuera del 40-60 %`);
});

// eco-1 límite: saldo menor que cualquier arma de pago con daño
test("eco-1: con 30 cr ninguna personalidad intenta pagar un arma de ataque: dispara una gratis", () => {
  for (const personalidad of PERSONALIDADES) {
    for (let semilla = 1; semilla <= 20; semilla++) {
      const { armaId } = decidirCompraTurno(personalidad, 30, 1, crearEstadoAleatorio(semilla));
      assert.equal(precioDe(armaId), 0, `${personalidad.id} pagó ${armaId} con 30 cr`);
    }
  }
});

test("eco-7: no repite un arma con usos agotados (Despedida)", () => {
  const { armaId } = decidirCompraTurno(ALMIRANTE_BISAGRA, 850, 1, crearEstadoAleatorio(1), { despedida: 1 });
  assert.notEqual(armaId, "despedida");
});
