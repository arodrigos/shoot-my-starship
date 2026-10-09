import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import type { Arma } from "@/sim/armas/tipos";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { avanzar } from "@/sim/partida/avanzar";
import { armaEfectiva, armasGratis, costeArma, danioMaximoGratis } from "@/sim/partida/economia";
import { crearPartidaInicial } from "@/sim/partida/motor";
import { serializarEstado } from "@/sim/partida/serializacion";
import type { EstadoPartida } from "@/sim/partida/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const MUNDO = { ancho: 1920, alto: 1080, gravedad: 1.0, deriva: 0, etiquetaDeriva: "economia-rectificada" };
const ALTURA_SUELO = 900;

function danioDeclarado(arma: Arma): number {
  return arma.efecto.tipo === "empuje" ? 0 : arma.efecto.danioMaximo;
}

function estadoConSaldos(saldos: readonly number[]): EstadoPartida {
  const mascara = crearMascaraPlana(MUNDO.ancho, MUNDO.alto, ALTURA_SUELO);
  const base = crearPartidaInicial(MUNDO, mascara, [200, 1700], 11);
  return { ...base, modo: "presupuesto", saldos };
}

function disparo(estado: EstadoPartida, arma: string) {
  const [solucion] = resolverSolucionesBalisticas(estado.naves[0].x, ALTURA_SUELO, estado.naves[1].x, ALTURA_SUELO, estado.mundo.gravedad);
  return avanzar(estado, { arma, anguloGrados: solucion.anguloGrados, potencia: solucion.potencia, objetivoId: 1 });
}

// Un catálogo sintético arbitrario: la invariante 1 vale para cualquier
// catálogo, no solo para el de hoy.
const armaSintetica: fc.Arbitrary<Arma> = fc
  .record({
    coste: fc.constantFrom(0, 0, 15, 40, 75, 120),
    danio: fc.integer({ min: 0, max: 60 }),
    utilitaria: fc.boolean(),
    indice: fc.integer({ min: 0, max: 1000 }),
  })
  .map(({ coste, danio, utilitaria, indice }) => ({
    ...CATALOGO_ARMAS[0],
    id: `sintetica-${indice}`,
    coste,
    utilitaria,
    efecto: { tipo: "danio" as const, radioEfectoPx: 50, danioMaximo: danio },
  }));

// eco-3 / invariante 1
test("economia-rectificada-1 (propiedad): el daño de las gratis es el 25 % del menor daño de las de pago con daño, y en barra libre no cambia", () => {
  fc.assert(
    fc.property(
      fc.array(armaSintetica, { minLength: 2, maxLength: 12 }).filter((armas) => armas.some((arma) => costeArma(arma) > 0 && !arma.utilitaria && danioDeclarado(arma) > 0)),
      (catalogo) => {
        const referencias = catalogo.filter((arma) => costeArma(arma) > 0 && !arma.utilitaria && danioDeclarado(arma) > 0).map(danioDeclarado);
        const esperado = 0.25 * Math.min(...referencias);
        assert.equal(danioMaximoGratis(catalogo), esperado);
        for (const gratis of catalogo.filter((arma) => costeArma(arma) === 0)) {
          assert.equal(danioDeclarado(armaEfectiva(gratis, true, catalogo)), esperado);
          assert.equal(danioDeclarado(armaEfectiva(gratis, false, catalogo)), danioDeclarado(gratis), "barra libre: el declarado");
        }
        for (const pagada of catalogo.filter((arma) => costeArma(arma) > 0)) {
          assert.equal(armaEfectiva(pagada, true, catalogo), pagada, "las de pago no se tocan");
        }
      },
    ),
    { numRuns: 200 },
  );
});

test("economia-rectificada-1: con el catálogo real las tres gratis hacen 4,5 de daño máximo (25 % del Pepinazo, la de pago más floja)", () => {
  assert.equal(armasGratis().length, 3);
  assert.equal(danioMaximoGratis(), 4.5);
  for (const gratis of armasGratis()) {
    assert.ok(danioDeclarado(armaEfectiva(gratis, true)) <= 4.5);
  }
});

// Invariantes 2 y 3: secuencias aleatorias de disparos con un saldo inicial arbitrario.
test("economia-rectificada-2/3 (propiedad): el saldo nunca es negativo, cada arma de pago resta exactamente su precio y las gratis no cobran", () => {
  const ids = CATALOGO_ARMAS.map((arma) => arma.id);
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 1200 }),
      fc.array(fc.constantFrom(...ids), { minLength: 1, maxLength: 8 }),
      (saldoInicial, armas) => {
        let estado = estadoConSaldos([saldoInicial, saldoInicial]);
        for (const id of armas) {
          if (estado.resultado.tipo === "terminada") break;
          const arma = CATALOGO_ARMAS.find((candidata) => candidata.id === id)!;
          const tirador = estado.turno;
          const antes = estado.saldos![tirador]!;
          const solucion = resolverSolucionesBalisticas(estado.naves[tirador].x, ALTURA_SUELO, estado.naves[1 - tirador].x, ALTURA_SUELO, estado.mundo.gravedad)[0];
          const entrada = { arma: id, anguloGrados: solucion.anguloGrados, potencia: solucion.potencia, objetivoId: 1 - tirador };
          if (costeArma(arma) > antes) {
            const serializado = serializarEstado(estado);
            assert.throws(() => avanzar(estado, entrada), /cuesta/);
            assert.equal(serializarEstado(estado), serializado, "la entrada rechazada no muta el estado");
            continue;
          }
          estado = avanzar(estado, entrada).estado;
          assert.equal(estado.saldos![tirador], antes - costeArma(arma));
          assert.ok(estado.saldos![tirador]! >= 0);
          if (costeArma(arma) === 0) assert.equal(estado.saldos![tirador], antes);
        }
      },
    ),
    { numRuns: 100 },
  );
});

test("economia-rectificada-4: Despedida con 80 cr se rechaza («cuesta 85») y el estado serializado queda idéntico", () => {
  const estado = estadoConSaldos([80, 80]);
  const antes = serializarEstado(estado);
  assert.throws(() => disparo(estado, "despedida"), /cuesta 85 cr/);
  assert.equal(serializarEstado(estado), antes);
});

test("economia-rectificada-2: Pepinazo con 100 cr deja 60 cr y la gratis siguiente no cobra", () => {
  const tras = disparo(estadoConSaldos([100, 100]), "pepinazo-cortesia").estado;
  assert.deepEqual(tras.saldos, [60, 100]);
  const trasGratis = disparo({ ...tras, turno: 0 }, "petardo-de-feria").estado;
  assert.deepEqual(trasGratis.saldos, [60, 100]);
});

test("economia-rectificada-3: en barra libre ningún disparo toca saldos y el petardo conserva su daño", () => {
  const mascara = crearMascaraPlana(MUNDO.ancho, MUNDO.alto, ALTURA_SUELO);
  const barra = crearPartidaInicial(MUNDO, mascara, [200, 1700], 11);
  const tras = disparo(barra, "despedida").estado;
  assert.equal(tras.saldos, undefined);
});
