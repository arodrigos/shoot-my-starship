import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { elegirEntradaDisparoAutomatico } from "@/juego/control/disparoAutomatico";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { costeArma } from "@/sim/partida/economia";

const gratuita = CATALOGO_ARMAS.find((a) => costeArma(a) === 0)!;

test("rel-9: el disparo automático es el arma elegida si el botón la permitiría y si no la gratuita; nunca equipo ni gasto sobre el saldo", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...CATALOGO_ARMAS.map((a) => a.id)),
      fc.constantFrom<string | null>(null, "escudo", "propulsores"),
      fc.integer({ min: 0, max: 2000 }),
      fc.boolean(),
      fc.integer({ min: 0, max: 180 }),
      fc.integer({ min: 0, max: 100 }),
      (armaId, equipoId, saldo, presupuesto, angulo, potencia) => {
        const disparable = (id: string): boolean => !presupuesto || costeArma(CATALOGO_ARMAS.find((a) => a.id === id)!) <= saldo;
        const entrada = elegirEntradaDisparoAutomatico(
          { armaId, equipoId, anguloGrados: angulo, potencia, armaGratuitaId: gratuita.id },
          disparable,
        );
        assert.equal(entrada.anguloGrados, angulo);
        assert.equal(entrada.potencia, potencia);
        assert.ok(CATALOGO_ARMAS.some((a) => a.id === entrada.arma));
        if (equipoId !== null) assert.equal(entrada.arma, gratuita.id);
        else if (disparable(armaId)) assert.equal(entrada.arma, armaId);
        else assert.equal(entrada.arma, gratuita.id);
        if (presupuesto) assert.ok(costeArma(CATALOGO_ARMAS.find((a) => a.id === entrada.arma)!) <= Math.max(saldo, 0));
      },
    ),
  );
});
