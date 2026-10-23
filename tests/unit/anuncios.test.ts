import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  MAXIMO_ANUNCIOS,
  anunciar,
  obtenerAnuncio,
  obtenerHistorialAnuncios,
  reiniciarAnuncios,
  suscribirAnuncios,
  textoAnuncioTurno,
} from "@/juego/control/anunciosStore";

beforeEach(() => reiniciarAnuncios());

describe("anuncios-accesibles", () => {
  test("an-3: 50 llamadas dejan 20 entradas y reiniciar las vacía", () => {
    for (let i = 0; i < 50; i++) anunciar(`texto ${i}`);
    assert.equal(obtenerHistorialAnuncios().length, MAXIMO_ANUNCIOS);
    assert.equal(obtenerHistorialAnuncios().at(-1)?.texto, "texto 49");
    reiniciarAnuncios();
    assert.equal(obtenerHistorialAnuncios().length, 0);
    assert.equal(obtenerAnuncio().texto, "");
  });

  test("un texto igual al anterior cambia la secuencia y avisa a las escuchas", () => {
    let avisos = 0;
    const baja = suscribirAnuncios(() => avisos++);
    anunciar("Tu turno");
    const primera = obtenerAnuncio().secuencia;
    anunciar("Tu turno");
    baja();
    assert.equal(avisos, 2);
    assert.ok(obtenerAnuncio().secuencia > primera);
  });

  test("anunciar una cadena vacía no hace nada", () => {
    anunciar("");
    assert.equal(obtenerHistorialAnuncios().length, 0);
  });

  test("invariante: el historial nunca pasa de 20 entradas", () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 200 }), (textos) => {
        reiniciarAnuncios();
        for (const t of textos) anunciar(t);
        return obtenerHistorialAnuncios().length <= MAXIMO_ANUNCIOS;
      }),
      { numRuns: 300 },
    );
  });

  test("an-1: «Tu turno» con un humano y «Turno de <rival>» con la IA", () => {
    const base = { participantes: null, rivalesIA: [null, { nombreCorto: "Contable", nivel: "normal", etiquetaNivel: "Normal" }] as const, humanos: 1, nombreRival: "La Contable" };
    assert.equal(textoAnuncioTurno(0, base), "Tu turno");
    assert.equal(textoAnuncioTurno(1, base), "Turno de Contable");
  });

  test("an-1: con varios humanos se nombra siempre a quien le toca", () => {
    const participantes = [
      { nombre: "Ana", esHumano: true },
      { nombre: "Luis", esHumano: true },
    ];
    const datos = { participantes, rivalesIA: [null, null], humanos: 2, nombreRival: "" };
    assert.equal(textoAnuncioTurno(0, datos), "Turno de Ana");
    assert.equal(textoAnuncioTurno(1, datos), "Turno de Luis");
  });

  test("invariante: textoAnuncioTurno nunca es vacío y empieza por «Turno de» o es «Tu turno»", () => {
    const participante = fc.record({ nombre: fc.oneof(fc.constant(""), fc.string({ maxLength: 300 })), esHumano: fc.boolean() });
    const rival = fc.option(
      fc.record({ nombreCorto: fc.string({ maxLength: 50 }), nivel: fc.constant("facil" as const), etiquetaNivel: fc.constant("Fácil") }),
      { nil: null },
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.option(fc.array(participante, { minLength: 2, maxLength: 4 }), { nil: null }),
        fc.array(rival, { maxLength: 4 }),
        fc.integer({ min: 1, max: 4 }),
        fc.string({ maxLength: 40 }),
        (turno, participantes, rivalesIA, humanos, nombreRival) => {
          const texto = textoAnuncioTurno(turno, { participantes, rivalesIA, humanos, nombreRival });
          return texto.length > 0 && (texto === "Tu turno" || texto.startsWith("Turno de "));
        },
      ),
      { numRuns: 500 },
    );
  });
});
