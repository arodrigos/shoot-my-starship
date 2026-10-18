import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearInstantanea, leerInstantanea } from "@/juego/partidaGuardada/instantanea";
import { validarInstantanea } from "@/juego/partidaGuardada/validar";
import { MAX_CARACTERES_INSTANTANEA, type DatosPartida } from "@/juego/partidaGuardada/tipos";
import { datosDe, jugar, partidaInicial, sinClavesUndefined } from "./ayudas";

// JSON de la instantánea sin tipar: los tests lo rompen campo a campo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Crudo = Record<string, any>;

const VERSION = "v-actual";

function valida(cadena: string, version = VERSION) {
  const r = leerInstantanea(cadena, version);
  assert.equal(r.tipo, "valida", r.tipo === "descartada" ? `descartada: ${r.motivo}` : "");
  return r.tipo === "valida" ? r : (null as never);
}

describe("pgn-2: ida y vuelta de una partida real y tamaño", () => {
  const casos: readonly (readonly [string, number, number, number])[] = [
    ["1180x820, 12 turnos", 1180, 820, 12],
    ["1180x820, 21 rondas con muerte súbita", 1180, 820, 12],
    ["360x640, 12 turnos", 360, 640, 12],
  ];
  for (const [nombre, ancho, alto, turnos] of casos) {
    it(`${nombre}: cabe en 1 MB y vuelve igual en profundidad`, () => {
      const jugada = jugar(partidaInicial(ancho, alto), turnos);
      const memorias = jugada.memorias;
      // Jugar 84 turnos reales tarda minutos con el render por software; basta con
      // marcar la ronda y la fase, que es lo único que cambia en lo guardado.
      const estado = nombre.includes("muerte") ? { ...jugada.estado, ronda: 21, muerteSubita: true } : jugada.estado;
      const datos = datosDe(estado, memorias);
      const cadena = crearInstantanea(datos, { versionJuego: VERSION, ahora: 1 });
      console.log(`pgn-2: ${nombre} -> ${cadena.length} caracteres (turno ${estado.numeroTurno}, resultado ${estado.resultado.tipo})`);
      assert.ok(cadena.length <= MAX_CARACTERES_INSTANTANEA);
      const lectura = valida(cadena);
      assert.deepStrictEqual(lectura.datos, sinClavesUndefined(datos));
      assert.equal(lectura.deOtraVersion, false);
    });
  }

  it("modo presupuesto: los saldos con huecos (undefined) sobreviven al JSON", () => {
    const base = partidaInicial(820, 1180, "presupuesto");
    const estado = { ...base, saldos: [100, undefined, 40, 0] };
    const datos = datosDe(estado, [null, null, null, null]);
    assert.deepStrictEqual(valida(crearInstantanea(datos, { versionJuego: VERSION })).datos.estado.saldos, [100, undefined, 40, 0]);
  });

  it("si una IA ya usó Despedida, usosPorArma lo conserva", () => {
    const { estado, memorias } = jugar(partidaInicial(820, 1180), 4);
    const ia = memorias[2];
    assert.ok(ia);
    ia.usosPorArma = { ...ia.usosPorArma, despedida: 1 };
    const cadena = crearInstantanea(datosDe(estado, memorias), { versionJuego: VERSION });
    assert.equal(valida(cadena).datos.cascara.memoriasIA[2]?.usosPorArma.despedida, 1);
  });

  it("invariante: la cadena es JSON puro y su ida y vuelta es la identidad, para cualquier tramo de partida", () => {
    const inicial = partidaInicial(820, 1180);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 6 }), fc.constantFrom(30, 45, 60, null), (turnos, reloj) => {
        const { estado, memorias } = jugar(inicial, turnos);
        const datos = datosDe(estado, memorias, reloj);
        const cadena = crearInstantanea(datos, { versionJuego: VERSION });
        const analizada: unknown = JSON.parse(cadena);
        // Ningún Uint8Array sobrevive a JSON.parse: si se hubiera colado, sería un objeto indexado.
        assert.ok(!/"datos":\{"0":/.test(cadena));
        assert.equal(typeof analizada, "object");
        assert.deepStrictEqual(valida(cadena).datos, sinClavesUndefined(datos));
      }),
      { numRuns: 12 },
    );
  });
});

describe("pgn-3: el validador descarta con motivo y sin lanzar", () => {
  const { estado, memorias } = jugar(partidaInicial(820, 1180), 3);
  const datos = datosDe(estado, memorias);
  const referencia = JSON.parse(crearInstantanea(datos, { versionJuego: VERSION })) as Crudo;

  function variante(cambio: (i: Crudo) => void): string {
    const copia = structuredClone(referencia);
    cambio(copia);
    return JSON.stringify(copia);
  }

  it("la de referencia es válida", () => {
    valida(JSON.stringify(referencia));
  });

  const rotas: readonly (readonly [string, string, (i: Crudo) => void])[] = [
    ["version", "esquema desconocido", (i) => (i.version = 99)],
    ["mascara", "máscara de otra longitud", (i) => (i.estado.mascara.ancho += 1)],
    ["naves", "una sola nave", (i) => (i.estado.naves = i.estado.naves.slice(0, 1))],
    ["naves", "naves distintas de los jugadores", (i) => (i.config.jugadores = i.config.jugadores.slice(0, 3))],
    ["turno", "turno de una nave muerta", (i) => (i.estado.naves[i.estado.turno].integridad = 0)],
    ["arma", "arma inexistente", (i) => (i.cascara.memoriasIA[2].usosPorArma = { "arma-fantasma": 1 })],
    ["nombre", "nombre sin sanear", (i) => (i.config.jugadores[0].nombre = "Ana\u0000 con control")],
    ["terminada", "partida terminada", (i) => (i.estado.resultado = { tipo: "terminada", ganador: 0 })],
  ];
  for (const [motivo, texto, cambio] of rotas) {
    it(`${motivo}: ${texto}`, () => {
      assert.deepEqual(validarInstantanea(variante(cambio), VERSION), { tipo: "descartada", motivo });
    });
  }

  it("JSON roto, cadena vacía y 'null' se descartan", () => {
    assert.deepEqual(validarInstantanea('{"version":1,', VERSION), { tipo: "descartada", motivo: "json" });
    assert.equal(validarInstantanea("", VERSION).tipo, "descartada");
    assert.equal(validarInstantanea("null", VERSION).tipo, "descartada");
  });

  it("5 MB de basura se rechazan en menos de 50 ms", () => {
    const basura = "x".repeat(5_000_000);
    const inicio = performance.now();
    const r = validarInstantanea(basura, VERSION);
    assert.equal(r.tipo, "descartada");
    assert.ok(performance.now() - inicio < 50);
  });

  it("invariante: nunca lanza, con cadenas arbitrarias, JSON arbitrario y la referencia mutada", () => {
    const base = JSON.stringify(referencia);
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.json(),
          fc.string().map((s) => base.slice(0, Math.max(0, base.length - 1 - (s.length % 500)))),
          fc.tuple(fc.integer({ min: 0, max: base.length - 1 }), fc.string({ maxLength: 4 })).map(([p, s]) => base.slice(0, p) + s + base.slice(p + 1)),
        ),
        (cadena) => {
          const r = validarInstantanea(cadena, VERSION);
          assert.ok(r.tipo === "valida" || r.tipo === "descartada");
          if (r.tipo === "valida") {
            const { estado: e, config } = r.datos;
            assert.equal(e.mascara.datos.length, e.mascara.ancho * e.mascara.alto);
            assert.ok(e.naves.length >= 2 && e.naves.length <= 4 && e.naves.length === config.jugadores.length);
            assert.ok(e.ordenTurno.includes(e.turno) && e.naves[e.turno].integridad > 0);
            assert.equal(e.resultado.tipo, "en-curso");
          } else {
            assert.ok(r.motivo.length > 0);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("números fuera de rango (NaN serializado como null, integridad 500) se descartan", () => {
    assert.equal(validarInstantanea(variante((i) => (i.estado.naves[0].x = null)), VERSION).tipo, "descartada");
    assert.equal(validarInstantanea(variante((i) => (i.estado.naves[0].integridad = 5000)), VERSION).tipo, "descartada");
  });
});

describe("pgn-4: política de versión del juego", () => {
  const { estado, memorias } = jugar(partidaInicial(820, 1180), 3);
  const datos: DatosPartida = datosDe(estado, memorias);

  it("otra versión con datos válidos se acepta y se marca deOtraVersion", () => {
    const cadena = crearInstantanea(datos, { versionJuego: "x" });
    const r = leerInstantanea(cadena, "y");
    assert.equal(r.tipo, "valida");
    assert.equal(r.tipo === "valida" && r.deOtraVersion, true);
  });

  it("otra versión con un arma retirada se descarta como 'version-incompatible'", () => {
    const copia = JSON.parse(crearInstantanea(datos, { versionJuego: "x" })) as Crudo;
    copia.cascara.memoriasIA[2].usosPorArma = { "arma-retirada": 2 };
    assert.deepEqual(leerInstantanea(JSON.stringify(copia), "y"), { tipo: "descartada", motivo: "version-incompatible" });
  });

  it("invariante: dos instantáneas que difieren solo en versionJuego reciben el mismo veredicto", () => {
    const base = JSON.parse(crearInstantanea(datos, { versionJuego: "x" })) as Crudo;
    const rota = structuredClone(base);
    rota.cascara.memoriasIA[2].usosPorArma = { "arma-retirada": 2 };
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), fc.string({ maxLength: 12 }), fc.boolean(), (va, vb, estropear) => {
        const origen = estropear ? rota : base;
        const aceptada = (version: string) => leerInstantanea(JSON.stringify({ ...origen, versionJuego: version }), "actual").tipo === "valida";
        assert.equal(aceptada(va), aceptada(vb));
      }),
      { numRuns: 100 },
    );
  });
});
