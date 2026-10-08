import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { dentroDelPoligono, distanciaACasco, poligonoDeNave, varianteDeNave, direccionDeNave } from "@/sim/naves/contacto";
import { crearRastreadorImpactoNaves } from "@/sim/naves/impacto";
import { puntosCascoConDanio, nivelDanio, type PuntoCasco } from "@/sim/naves/geometriaCasco";
import type { IdNave } from "@/sim/partida/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const NAVE_X = 500;
const NAVE_Y = 500;
const ID = fc.integer({ min: 0, max: 3 }).map((n) => n as IdNave);
const INTEGRIDAD = fc.integer({ min: 0, max: 100 });
const RUNS = 1000;

// Intersección de segmentos escrita aparte del núcleo (por orientaciones):
// el oráculo del invariante 3 no puede ser la propia implementación.
function orienta(a: PuntoCasco, b: PuntoCasco, c: PuntoCasco): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function seCruzan(p: PuntoCasco, q: PuntoCasco, r: PuntoCasco, s: PuntoCasco): boolean {
  const d1 = orienta(p, q, r);
  const d2 = orienta(p, q, s);
  const d3 = orienta(r, s, p);
  const d4 = orienta(r, s, q);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Invariante 2: el núcleo y la cáscara hablan del mismo polígono -- la
// cáscara lo toma de puntosCascoConDanio con el mismo nivel de deterioro.
test("nav-2 (invariante 2): un punto está dentro del casco si y solo si cae dentro del polígono que dibuja la cáscara", () => {
  fc.assert(
    fc.property(ID, INTEGRIDAD, fc.double({ min: -80, max: 80, noNaN: true }), fc.double({ min: -80, max: 80, noNaN: true }), (id, integridad, x, y) => {
      const nave = { id, x: NAVE_X, y: NAVE_Y, integridad };
      const dibujado = puntosCascoConDanio(direccionDeNave(id), nivelDanio(integridad), varianteDeNave(id));
      const dentroDibujo = dentroDelPoligono(x, y, dibujado);
      const distancia = distanciaACasco(NAVE_X + x, NAVE_Y + y, nave);
      assert.deepEqual(poligonoDeNave(nave), dibujado);
      assert.equal(distancia === 0, dentroDibujo);
    }),
    { numRuns: RUNS },
  );
});

// Invariante 3: primer cruce, sin túnel, y null si no cruza.
test("nav-2 (invariante 3): un segmento que cruza el polígono de una nave distinta del tirador es impacto; si no lo cruza, null", () => {
  fc.assert(
    fc.property(
      ID,
      INTEGRIDAD,
      fc.double({ min: -150, max: 150, noNaN: true }),
      fc.double({ min: -150, max: 150, noNaN: true }),
      fc.double({ min: -150, max: 150, noNaN: true }),
      fc.double({ min: -150, max: 150, noNaN: true }),
      (id, integridad, ax, ay, bx, by) => {
        const nave = { id, x: NAVE_X, y: NAVE_Y, integridad };
        const poligono = poligonoDeNave(nave);
        const a = { x: ax, y: ay };
        const b = { x: bx, y: by };
        const cruza =
          dentroDelPoligono(ax, ay, poligono) ||
          dentroDelPoligono(bx, by, poligono) ||
          poligono.some((p, i) => seCruzan(a, b, p, poligono[(i + 1) % poligono.length]!));
        const tirador = ((id + 1) % 4) as IdNave;
        const impacto = crearRastreadorImpactoNaves([nave], tirador).comprobarPaso(
          { x: NAVE_X + ax, y: NAVE_Y + ay, vx: 0, vy: 0 },
          { x: NAVE_X + bx, y: NAVE_Y + by, vx: 0, vy: 0 },
        );
        if (!cruza) {
          assert.equal(impacto, null);
          return;
        }
        assert.ok(impacto, "se esperaba impacto");
        assert.equal(impacto!.nave, id);
        // El punto está sobre el segmento y sobre el borde.
        const largo = Math.hypot(bx - ax, by - ay);
        const desdeA = Math.hypot(impacto!.x - NAVE_X - ax, impacto!.y - NAVE_Y - ay);
        assert.ok(desdeA <= largo + 1e-6);
        assert.ok(distanciaACasco(impacto!.x, impacto!.y, nave) <= 1e-6);
      },
    ),
    { numRuns: RUNS },
  );
});

test("nav-2: un proyectil rápido (60 u por paso) que atraviesa el ala en un solo paso también impacta", () => {
  for (const id of [0, 1, 2, 3] as const) {
    const nave = { id, x: NAVE_X, y: NAVE_Y };
    const impacto = crearRastreadorImpactoNaves([nave], ((id + 1) % 4) as IdNave).comprobarPaso(
      { x: NAVE_X - 30, y: NAVE_Y, vx: 3600, vy: 0 },
      { x: NAVE_X + 30, y: NAVE_Y, vx: 3600, vy: 0 },
    );
    assert.equal(impacto?.nave, id, `asiento ${id}`);
  }
});

test("nav-2: 1 u dentro de la punta del ala impacta y 2 u por fuera no (asiento 0, sin deterioro)", () => {
  const nave = { id: 0 as const, x: NAVE_X, y: NAVE_Y };
  const poligono = poligonoDeNave(nave);
  const punta = poligono.reduce((mejor, p) => (p.y < mejor.y ? p : mejor));
  // Horizontal, de atrás hacia delante.
  const lanzar = (y: number) =>
    crearRastreadorImpactoNaves([nave], 1).comprobarPaso(
      { x: NAVE_X - 200, y: NAVE_Y + y, vx: 100, vy: 0 },
      { x: NAVE_X + 200, y: NAVE_Y + y, vx: 100, vy: 0 },
    );
  assert.equal(lanzar(punta.y + 1)?.nave, 0);
  assert.equal(lanzar(punta.y - 2), null);
});

test("nav-2: con el deterioro máximo, un tiro que pasa por una abolladura no impacta", () => {
  const sana = { id: 0 as const, x: NAVE_X, y: NAVE_Y, integridad: 100 };
  const rota = { ...sana, integridad: 10 };
  const sanaPoligono = poligonoDeNave(sana);
  const rotaPoligono = poligonoDeNave(rota);
  // Un punto del casco sano que queda fuera del dañado: se busca en la rejilla.
  let hueco: PuntoCasco | null = null;
  for (let x = -40; x <= 40 && !hueco; x += 0.5) {
    for (let y = -40; y <= 40 && !hueco; y += 0.5) {
      if (dentroDelPoligono(x, y, sanaPoligono) && !dentroDelPoligono(x, y, rotaPoligono)) hueco = { x, y };
    }
  }
  assert.ok(hueco, "la abolladura debe quitar algo de superficie");
  // Un segmento corto dentro de la abolladura: sana lo ve, rota no.
  const paso = (nave: typeof sana) =>
    crearRastreadorImpactoNaves([nave], 1).comprobarPaso(
      { x: NAVE_X + hueco!.x, y: NAVE_Y + hueco!.y, vx: 0, vy: 0 },
      { x: NAVE_X + hueco!.x, y: NAVE_Y + hueco!.y, vx: 0, vy: 0 },
    );
  assert.ok(paso(sana));
  assert.equal(paso(rota), null);
});

// Invariante 4: daño máximo dentro, cero a distancia ≥ radio de efecto.
const PEPINAZO = buscarArma("pepinazo-cortesia");
function detonacion(id: IdNave, objetivoX: number, objetivoY: number) {
  return resolverDisparo({
    mascara: crearMascaraPlana(2000, 1000, 700),
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: PEPINAZO,
    origenX: 1000,
    anguloGrados: 90,
    potencia: 60,
    objetivoX,
    objetivoY,
    objetivoId: id,
    ancho: 2000,
    alto: 1000,
  });
}
const PUNTO_DE_IMPACTO = detonacion(0, 0, 0).puntosDeImpacto[0]!;

test("nav-2 (invariante 4): daño máximo dentro de la silueta y 0 a distancia ≥ radio de efecto", () => {
  const efecto = PEPINAZO.efecto;
  if (efecto.tipo !== "danio") throw new Error("el Pepinazo es un arma de daño");
  fc.assert(
    fc.property(ID, fc.double({ min: -150, max: 150, noNaN: true }), fc.double({ min: -150, max: 150, noNaN: true }), (id, x, y) => {
      const distancia = distanciaACasco(x, y, { id, x: 0, y: 0 });
      const danio = detonacion(id, PUNTO_DE_IMPACTO.x - x, PUNTO_DE_IMPACTO.y - y).danioObjetivo;
      if (distancia === 0) assert.equal(danio, efecto.danioMaximo);
      if (distancia >= efecto.radioEfectoPx) assert.equal(danio, 0);
    }),
    { numRuns: RUNS },
  );
});
