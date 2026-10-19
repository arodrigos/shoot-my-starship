import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import {
  acumularTurno,
  estadisticasIniciales,
  giroAcumuladoGrados,
  type EstadisticasAsiento,
} from "@/juego/premios/estadisticas";
import { asignarPremios, BANCO_CONSOLACION, BANCO_MERITO } from "@/juego/premios/premios";
import type { EventoSimulacion } from "@/sim/partida/eventos";

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

function arco(grados: number, puntos = 400): { x: number; y: number }[] {
  return Array.from({ length: puntos }, (_, i) => {
    const a = (i / (puntos - 1)) * (grados * Math.PI) / 180;
    return { x: 100 * Math.cos(a), y: 100 * Math.sin(a) };
  });
}

const disparo = (nave: number): EventoSimulacion => ({ tipo: "disparo", nave, arma: "x", anguloGrados: 45, potencia: 50 });
const impacto = (objetivo: number, danio: number): EventoSimulacion => ({ tipo: "impacto", x: 0, y: 0, objetivo, danio });

// pre-2
test("giroAcumuladoGrados: recta 0, cuarto 90, semicircunferencia 180", () => {
  assert.equal(giroAcumuladoGrados([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 9, y: 0 }]), 0);
  assert.ok(Math.abs(giroAcumuladoGrados(arco(90)) - 90) <= 1);
  assert.ok(Math.abs(giroAcumuladoGrados(arco(180)) - 180) <= 1);
});

test("giroAcumuladoGrados: puntos repetidos sin NaN, 0 o 1 puntos = 0, ida y vuelta = 180", () => {
  const g = giroAcumuladoGrados([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]);
  assert.ok(Number.isFinite(g));
  assert.ok(Math.abs(g - 90) < 1e-9);
  assert.equal(giroAcumuladoGrados([]), 0);
  assert.equal(giroAcumuladoGrados([{ x: 1, y: 1 }]), 0);
  assert.ok(Math.abs(giroAcumuladoGrados([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }]) - 180) < 1e-9);
});

test("invariante: giroAcumuladoGrados >= 0 y finito para cualquier trayectoria", () => {
  fc.assert(
    fc.property(fc.array(fc.record({ x: fc.integer({ min: -50, max: 50 }), y: fc.integer({ min: -50, max: 50 }) }), { maxLength: 40 }), (pts) => {
      const g = giroAcumuladoGrados(pts);
      return Number.isFinite(g) && g >= 0;
    }),
  );
});

// Genera turnos aleatorios de 2-4 asientos y los acumula.
const turnoArb = (n: number) =>
  fc.record({
    tirador: fc.integer({ min: 0, max: n - 1 }),
    golpes: fc.array(fc.record({ objetivo: fc.integer({ min: 0, max: n - 1 }), danio: fc.integer({ min: 0, max: 60 }), colateral: fc.boolean() }), { maxLength: 4 }),
    perdido: fc.boolean(),
    auto: fc.boolean(),
  });

test("invariante: danioHecho = suma de impacto y danio-colateral ajenos del tirador", () => {
  fc.assert(
    fc.property(fc.integer({ min: 2, max: 4 }).chain((n) => fc.tuple(fc.constant(n), fc.array(turnoArb(n), { maxLength: 12 }))), ([n, turnos]) => {
      let acc = estadisticasIniciales(n);
      const esperado = new Array<number>(n).fill(0);
      for (const t of turnos) {
        const ev: EventoSimulacion[] = [disparo(t.tirador)];
        for (const g of t.golpes) {
          ev.push(g.colateral ? { tipo: "danio-colateral", nave: g.objetivo, danio: g.danio } : impacto(g.objetivo, g.danio));
          if (g.objetivo !== t.tirador) esperado[t.tirador] += g.danio;
        }
        if (t.perdido) ev.push({ tipo: "proyectil-perdido", nave: t.tirador });
        if (t.auto) ev.push({ tipo: "autoimpacto", nave: t.tirador, danio: 5 });
        acc = acumularTurno(acc, ev, null);
      }
      return acc.every((e, i) => e.danioHecho === esperado[i]);
    }),
  );
});

const estadisticaArb = (asiento: number): fc.Arbitrary<EstadisticasAsiento> =>
  fc
    .record({
      disparos: fc.integer({ min: 0, max: 15 }),
      aciertosRel: fc.integer({ min: 0, max: 15 }),
      danioHecho: fc.integer({ min: 0, max: 300 }),
      danioRecibido: fc.integer({ min: 0, max: 300 }),
      autoimpactos: fc.integer({ min: 0, max: 3 }),
      bajas: fc.integer({ min: 0, max: 3 }),
      remateFinal: fc.boolean(),
      pixelesDestruidos: fc.integer({ min: 0, max: 3000 }),
      perdidos: fc.integer({ min: 0, max: 6 }),
      giroMaximoGrados: fc.integer({ min: 0, max: 720 }),
      vivo: fc.boolean(),
      integridadFinal: fc.integer({ min: 0, max: 100 }),
    })
    .map(({ aciertosRel, ...r }) => ({ asiento, ...r, aciertos: Math.min(aciertosRel, r.disparos) }));

const partidaArb = fc.integer({ min: 2, max: 4 }).chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => estadisticaArb(i))));

// pre-1
test("invariante: cada asiento recibe 1 o 2 premios y ningún premio se repite", () => {
  fc.assert(
    fc.property(partidaArb, (stats) => {
      const r = asignarPremios(stats);
      const ids = r.flat().map((p) => p.id);
      return r.every((l) => l.length >= 1 && l.length <= 2) && new Set(ids).size === ids.length;
    }),
  );
});

test("invariante: todo premio cumple su umbral y su cifra es la estadística", () => {
  const bancos = new Map([...BANCO_MERITO, ...BANCO_CONSOLACION].map((d) => [d.id, d]));
  fc.assert(
    fc.property(partidaArb, (stats) => {
      const r = asignarPremios(stats);
      return r.every((lista, i) =>
        lista.every((p) => {
          const def = bancos.get(p.id)!;
          const v = def.valor(stats[i]);
          return v >= def.umbral && p.cifra === v && p.texto.length > 0;
        }),
      );
    }),
  );
});

test("invariante: asignarPremios es determinista e independiente del orden de entrada", () => {
  fc.assert(
    fc.property(partidaArb, fc.integer({ min: 0, max: 1000 }), (stats, semilla) => {
      const a = asignarPremios(stats);
      assert.deepEqual(asignarPremios(stats), a);
      const orden = stats.map((_, i) => i).sort((x, y) => ((x * 7919 + semilla) % 13) - ((y * 7919 + semilla) % 13) || x - y);
      const permutadas = orden.map((i) => stats[i]);
      const b = asignarPremios(permutadas);
      return orden.every((original, pos) => JSON.stringify(b[pos]) === JSON.stringify(a[original]));
    }),
  );
});

test("un caso por premio: cumple el umbral y se queda a uno de él", () => {
  const base = (asiento: number): EstadisticasAsiento => ({ ...estadisticasIniciales(1)[0], asiento, vivo: false });
  const casos: { id: string; cumple: Partial<EstadisticasAsiento>; casi: Partial<EstadisticasAsiento> }[] = [
    { id: "punteria", cumple: { disparos: 5, aciertos: 5 }, casi: { disparos: 4, aciertos: 4 } },
    { id: "remate", cumple: { remateFinal: true }, casi: { remateFinal: false } },
    { id: "curva", cumple: { giroMaximoGrados: 60 }, casi: { giroMaximoGrados: 59 } },
    { id: "danio", cumple: { danioHecho: 30 }, casi: { danioHecho: 29 } },
    { id: "bajas", cumple: { bajas: 1 }, casi: { bajas: 0 } },
    { id: "autoimpactos", cumple: { autoimpactos: 1 }, casi: { autoimpactos: 0 } },
    { id: "pixeles", cumple: { pixelesDestruidos: 300 }, casi: { pixelesDestruidos: 299 } },
    { id: "recibido", cumple: { danioRecibido: 30 }, casi: { danioRecibido: 29 } },
    { id: "perdidos", cumple: { perdidos: 2 }, casi: { perdidos: 1 } },
    { id: "vida", cumple: { vivo: true, integridadFinal: 1 }, casi: { vivo: true, integridadFinal: 0 } },
    { id: "intacto", cumple: { vivo: true, disparos: 3 }, casi: { vivo: true, disparos: 2 } },
    { id: "gatillo", cumple: { disparos: 8, aciertos: 8 }, casi: { disparos: 7, aciertos: 7 } },
    { id: "fallos", cumple: { disparos: 4 }, casi: { disparos: 3 } },
  ];
  assert.equal(casos.length, BANCO_MERITO.length);
  for (const c of casos) {
    const def = BANCO_MERITO.find((d) => d.id === c.id)!;
    assert.ok(def.valor({ ...base(0), ...c.cumple }) >= def.umbral, `${c.id} cumple`);
    assert.ok(def.valor({ ...base(0), ...c.casi }) < def.umbral, `${c.id} a uno del umbral`);
  }
});

test("pre-1-cuatro: partida de 4 asientos fabricada a mano", () => {
  let acc = estadisticasIniciales(4);
  // Asiento 0: 6 aciertos de 7 (daño 20 por golpe, sin llegar al umbral de daño con 1 asiento más fuerte).
  for (let i = 0; i < 7; i++) acc = acumularTurno(acc, [disparo(0), ...(i < 6 ? [impacto(3, 5)] : [])], null);
  for (let i = 0; i < 2; i++) acc = acumularTurno(acc, [disparo(1), { tipo: "autoimpacto", nave: 1, danio: 3 }], null);
  acc = acumularTurno(acc, [disparo(2)], arco(140));
  for (let i = 0; i < 3; i++) acc = acumularTurno(acc, [disparo(3), { tipo: "proyectil-perdido", nave: 3 }], null);
  const r = asignarPremios(acc);
  const idsDe = (i: number) => r[i].map((p) => p.id);
  assert.ok(idsDe(0).includes("punteria"));
  assert.equal(r[0].find((p) => p.id === "punteria")!.cifra, 86);
  assert.match(r[0].find((p) => p.id === "punteria")!.texto, /6 de 7/);
  assert.equal(r[1].find((p) => p.id === "autoimpactos")!.cifra, 2);
  assert.ok(Math.abs(r[2].find((p) => p.id === "curva")!.cifra - 140) <= 1);
  assert.ok(r.every((l) => l.length >= 1));
  assert.equal(new Set(r.flat().map((p) => p.id)).size, r.flat().length);
});

test("límites: con 2 asientos y un ganador perfecto el perdedor recibe consolación; empate de daño al asiento menor", () => {
  const e = estadisticasIniciales(2);
  const ganador = { ...e[0], disparos: 6, aciertos: 6, danioHecho: 100, vivo: true, integridadFinal: 80, remateFinal: true };
  const perdedor = { ...e[1], disparos: 2, vivo: false };
  const r = asignarPremios([ganador, perdedor]);
  assert.ok(r[1].length >= 1);
  const empate = asignarPremios([
    { ...e[0], disparos: 1, danioHecho: 50, vivo: false },
    { ...e[1], disparos: 1, danioHecho: 50, vivo: false },
  ]);
  assert.ok(empate[0].some((p) => p.id === "danio"));
  assert.ok(!empate[1].some((p) => p.id === "danio"));
});

test("acumularTurno: bajas, remate y estado final desde las integridades", () => {
  const acc = acumularTurno(estadisticasIniciales(2), [disparo(0), impacto(1, 40), { tipo: "partida-fin", ganador: 0 }], null, {
    integridades: [70, 0],
    pixelesDestruidos: 120,
  });
  assert.equal(acc[0].bajas, 1);
  assert.equal(acc[0].remateFinal, true);
  assert.equal(acc[0].pixelesDestruidos, 120);
  assert.equal(acc[1].vivo, false);
  assert.equal(acc[0].integridadFinal, 70);
});

// pre-4
test("pre-4: los nombres son propios y distintos entre sí", () => {
  const prohibidos = readFileSync("no-copiar.md", "utf8")
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => norm(l.slice(2)));
  // Premios de Versus de TowerFall que recordamos; lista de mínimos, no exhaustiva.
  const towerfall = ["assassin", "bravest", "cowardice", "heart of gold", "king of the hill", "last man standing", "pacifist", "arrow collector", "dodgy", "sharpshooter", "bullseye"].map(norm);
  const nombres = [...BANCO_MERITO, ...BANCO_CONSOLACION].map((d) => norm(d.nombre));
  assert.ok(BANCO_MERITO.length >= 12);
  assert.equal(new Set(nombres).size, nombres.length);
  for (const n of nombres) {
    assert.ok(!prohibidos.includes(n), `${n} está en no-copiar.md`);
    assert.ok(!towerfall.includes(n), `${n} coincide con TowerFall`);
  }
});
