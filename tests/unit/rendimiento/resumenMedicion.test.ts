import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  construirResumen,
  estadisticasTramo,
  formatearResumen,
  NOMBRES_TRAMO,
  resumirNavegador,
  type EntradaResumen,
  type NombreTramo,
  type TramoMedido,
} from "@/juego/rendimiento/resumenMedicion";

const NOMBRES: readonly NombreTramo[] = ["reposo", "pepinazo", "racimo", "propulsores", "turno-ia"];
const ENTORNO = { navegador: "Safari 26.2 / iPadOS", ancho: 360, alto: 640, dpr: 2, version: "1.2.3" };

const cifraRara = fc.oneof(fc.double({ min: 0, max: 5000, noNaN: true }), fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY));

const tramoArb = (nombre: NombreTramo): fc.Arbitrary<TramoMedido> =>
  fc.record({
    nombre: fc.constant(nombre),
    frames: fc.nat(2000),
    p95: cifraRara,
    max: cifraRara,
    framesLargos: fc.nat(500),
    duracionMs: cifraRara,
    p95Vuelo: fc.option(cifraRara, { nil: undefined }),
    maxImpactoExplosion: fc.option(cifraRara, { nil: undefined }),
    scriptMs: fc.option(cifraRara, { nil: undefined }),
    renderPhaserMs: fc.option(cifraRara, { nil: undefined }),
  });

const tramosArb = fc.subarray([...NOMBRES]).chain((nombres) => fc.tuple(...nombres.map(tramoArb)));

const entradaArb: fc.Arbitrary<EntradaResumen> = fc.record({
  tramos: tramosArb,
  entorno: fc.record({
    navegador: fc.string().map((ua) => resumirNavegador(ua)),
    ancho: cifraRara,
    alto: cifraRara,
    dpr: cifraRara,
    version: fc.stringMatching(/^[0-9]{1,3}(\.[0-9]{1,3}){0,2}$/),
  }),
  apis: fc.record({ loaf: fc.boolean(), eventTiming: fc.boolean() }),
  inpToques: fc.option(cifraRara, { nil: null }),
  paginaOculta: fc.boolean(),
  huecoMaxRafMs: cifraRara,
  medianaReposoMs: fc.option(cifraRara, { nil: null }),
  interrupcion: fc.constantFrom(null, "cancelada" as const, "tiempo-agotado" as const),
});

const base: EntradaResumen = {
  tramos: NOMBRES.map((nombre) => ({ nombre, frames: 100, p95: 20, max: 40, framesLargos: 0, duracionMs: 3000, renderPhaserMs: 5 })),
  entorno: ENTORNO,
  apis: { loaf: true, eventTiming: true },
  inpToques: 80,
  paginaOculta: false,
  huecoMaxRafMs: 40,
  medianaReposoMs: 16.7,
  interrupcion: null,
};

test("md-5: 0 ≤ p95 ≤ max y framesLargos cuenta exactamente los deltas > 50 ms", () => {
  fc.assert(
    fc.property(fc.array(fc.double({ min: 0, max: 3000, noNaN: true }), { minLength: 1, maxLength: 400 }), (deltas) => {
      const e = estadisticasTramo(deltas);
      assert.ok(e.p95 >= 0 && e.p95 <= e.max);
      assert.equal(e.framesLargos, deltas.filter((d) => d > 50).length);
      assert.equal(e.frames, deltas.length);
    }),
  );
});

test("md-5: el texto nunca lleva NaN, undefined ni Infinity, con cualquier entrada", () => {
  fc.assert(
    fc.property(entradaArb, (entrada) => {
      const texto = formatearResumen(construirResumen(entrada));
      for (const prohibido of ["NaN", "undefined", "Infinity", "null"]) assert.ok(!texto.includes(prohibido), `${prohibido} en:\n${texto}`);
    }),
  );
});

test("md-5: pestaña oculta o hueco de rAF > 1 s → NO VÁLIDA y cada fila lleva «(no válida)»", () => {
  fc.assert(
    fc.property(entradaArb, fc.constantFrom("oculta", "hueco"), (entrada, causa) => {
      const forzada: EntradaResumen = { ...entrada, paginaOculta: causa === "oculta" ? true : entrada.paginaOculta, huecoMaxRafMs: causa === "hueco" ? 1000.5 + Math.abs(entrada.huecoMaxRafMs || 0) % 5000 : entrada.huecoMaxRafMs };
      const resumen = construirResumen(forzada);
      const texto = formatearResumen(resumen);
      assert.equal(resumen.validez.valida, false);
      assert.ok(texto.startsWith("NO VÁLIDA"));
      const filas = texto.split("\n").filter((l) => l.startsWith("| "));
      for (const fila of filas) assert.ok(fila.includes("(no válida)"), fila);
    }),
  );
});

test("md-5: aviso de 30 fps solo con mediana de reposo entre 30 y 36 ms, nunca por encima de 40", () => {
  const aviso = "rAF limitado a 30 fps (¿modo de bajo consumo?)";
  fc.assert(
    fc.property(fc.double({ min: 30, max: 36, noNaN: true }), (m) => {
      assert.ok(formatearResumen(construirResumen({ ...base, medianaReposoMs: m })).includes(aviso));
    }),
  );
  fc.assert(
    fc.property(fc.double({ min: 40.01, max: 5000, noNaN: true }), (m) => {
      assert.ok(!formatearResumen(construirResumen({ ...base, medianaReposoMs: m })).includes(aviso));
    }),
  );
  assert.ok(formatearResumen(construirResumen({ ...base, medianaReposoMs: 33.3 })).includes(aviso));
});

test("md-5: sin LoAF no hay cifra de script; sin Event Timing el INP no está disponible; el INP se rotula siempre", () => {
  fc.assert(
    fc.property(entradaArb, (entrada) => {
      const sinLoaf = formatearResumen(construirResumen({ ...entrada, apis: { ...entrada.apis, loaf: false } }));
      assert.ok(sinLoaf.includes("LoAF: no (sin separación script/render)"));
      assert.ok(!/script \d/.test(sinLoaf));
      const sinEt = formatearResumen(construirResumen({ ...entrada, apis: { ...entrada.apis, eventTiming: false } }));
      assert.ok(sinEt.includes("INP: no disponible"));
      assert.ok(sinEt.includes("INP de tus toques (no del recorrido)"));
      assert.ok(formatearResumen(construirResumen(entrada)).includes("INP de tus toques (no del recorrido)"));
    }),
  );
});

test("md-5-texto-limpio: ni URL, ni ruta, ni trozo largo del userAgent", () => {
  fc.assert(
    fc.property(entradaArb, fc.string({ minLength: 25, maxLength: 120 }), (entrada, relleno) => {
      const ua = `Mozilla/5.0 (iPad; CPU OS 18_2) ${relleno} https://ejemplo.test/x /home/usuario Version/26.2 Safari/605.1.15`;
      const resumen = construirResumen({ ...entrada, entorno: { ...entrada.entorno, navegador: resumirNavegador(ua) } });
      const texto = formatearResumen(resumen);
      assert.ok(!texto.includes("http") && !texto.includes("/home"));
      for (let i = 0; i + 20 <= ua.length; i += 7) assert.ok(!texto.includes(ua.slice(i, i + 21)), ua.slice(i, i + 21));
    }),
  );
  assert.equal(resumirNavegador("Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 Version/26.2 Safari/605.1.15"), "Safari 26.2 / iPadOS");
  assert.equal(resumirNavegador("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/141.0.0.0 Mobile Safari/537.36"), "Chrome 141 / Android");
});

test("md-5: sin tramos → «sin datos» y NO VÁLIDA", () => {
  const texto = formatearResumen(construirResumen({ ...base, tramos: [] }));
  assert.ok(texto.startsWith("NO VÁLIDA"));
  assert.ok(texto.includes("sin datos"));
});

test("md-3: un resumen válido trae una línea por tramo y las filas para docs/rendimiento.md", () => {
  const resumen = construirResumen({
    ...base,
    tramos: NOMBRES.map((nombre) => ({
      nombre,
      frames: 100,
      p95: 20,
      max: 40,
      framesLargos: 1,
      duracionMs: 3000,
      ...(nombre === "pepinazo" || nombre === "racimo" ? { p95Vuelo: 18, maxImpactoExplosion: 45, scriptMs: 3, renderPhaserMs: 9 } : {}),
    })),
  });
  const texto = formatearResumen(resumen);
  assert.ok(resumen.validez.valida);
  assert.ok(texto.startsWith("Medición de rendimiento"));
  for (const n of NOMBRES) assert.ok(texto.includes(`${NOMBRES_TRAMO[n]}:`), n);
  assert.ok(texto.includes("LoAF: sí") && texto.includes("Event Timing: sí"));
  assert.ok(texto.split("\n").some((l) => l.startsWith("| Pepinazo ")));
  assert.ok(texto.split("\n").some((l) => l.startsWith("| Propulsores ")));
});
