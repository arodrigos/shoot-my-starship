import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { PLANTILLAS_RESUMEN } from "@/contenido/resumenesPartida";
import { LONGITUD_MAXIMA_RESUMEN, resumenPartida, type AsientoResumen } from "@/sim/partida/resumenPartida";
import { PERSONALIDADES } from "@/sim/ia/personalidades";
import { guionResumenPrueba } from "@/juego/textos/guionesResumen";
import { NOMBRES_CORTOS_RIVAL, esHumanoLocalUnico, nombreEnResumen, textoDesplazamiento } from "@/juego/textos/nombresEnTexto";
import { buscarPersonalidad } from "@/sim/ia/personalidades";
import { lineaCosteFicha } from "@/juego/hud/fichaArma";
import { TEXTO_AYUDA_APUNTADO } from "@/juego/hud/AyudaApuntadoHUD";
import type { Controlador } from "@/juego/jugadores";

const rivales = PERSONALIDADES.map((personalidad) => personalidad);
const humano: Controlador = { tipo: "humano", nombre: "Tú", personalidad: null };
const controladoresDe = (personalidadId: string): Controlador[] => [humano, { tipo: "ia", nombre: buscarPersonalidad(personalidadId).nombre, personalidad: buscarPersonalidad(personalidadId) }];

const TERCERA_PERSONA = /\bTú\s+(fue|ha|está|queda|manda|lidera|va|sigue|gana)\b/;

test("txt-1: invariante -- con el humano local único, ningún texto dice «Tú» + verbo en tercera persona", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...rivales.map((r) => r.id)),
      fc.integer({ min: 0, max: 150 }),
      fc.integer({ min: 0, max: 150 }),
      fc.integer({ min: 0, max: 12 }),
      fc.boolean(),
      fc.integer({ min: 1, max: 1_000_000 }),
      (idRival, vidaYo, vidaRival, fallos, desplazada, semilla) => {
        const controladores = controladoresDe(idRival);
        const asientos: AsientoResumen[] = controladores.map((_, id) => ({
          nombre: nombreEnResumen(controladores, id),
          esYo: esHumanoLocalUnico(controladores, id),
          desplazada: id === 0 && desplazada,
          integridad: id === 0 ? vidaYo : vidaRival,
          fallosSeguidos: id === 0 ? fallos : 0,
          viva: true,
        }));
        const resumen = resumenPartida({ asientos, ronda: 1, recientes: [] }, semilla).texto;
        const rotulo = textoDesplazamiento(nombreEnResumen(controladores, 0), true);
        assert.doesNotMatch(resumen, TERCERA_PERSONA);
        assert.doesNotMatch(rotulo, TERCERA_PERSONA);
        assert.doesNotMatch(`${resumen} ${rotulo}`, /\bTú\b/);
      },
    ),
  );
});

test("txt-1: el guion desplazado-por-bisagra habla en segunda persona y nombra a «Bisagra»", () => {
  for (const id of ["desplazado-por-bisagra", "desplazado-por-contable", "desplazado-por-chispa"]) {
    const { resumen, rotulo } = guionResumenPrueba(id);
    assert.match(resumen, /Te desplazaron/);
    assert.match(rotulo, /Te desplazaron/);
    assert.doesNotMatch(`${resumen} ${rotulo}`, /Tú fue/);
  }
  assert.match(guionResumenPrueba("desplazado-por-bisagra").resumen, /Bisagra/);
  assert.throws(() => guionResumenPrueba("inventado"));
});

test("txt-1: con varios humanos el texto sigue en tercera persona con sus nombres", () => {
  const dos: Controlador[] = [
    { tipo: "humano", nombre: "Ana", personalidad: null },
    { tipo: "humano", nombre: "Luis", personalidad: null },
  ];
  assert.equal(esHumanoLocalUnico(dos, 0), false);
  assert.equal(nombreEnResumen(dos, 0), "Ana");
  assert.equal(textoDesplazamiento("Ana", false), "Estaba aquí: Ana fue desplazada de este punto.");
});

test("txt-2: invariante -- el resumen nunca recorta con «…» el nombre de un rival", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...rivales.map((r) => r.id)),
      fc.constantFrom(...rivales.map((r) => r.id)),
      fc.integer({ min: 0, max: 150 }),
      fc.integer({ min: 0, max: 150 }),
      fc.integer({ min: 0, max: 12 }),
      fc.integer({ min: 1, max: 1_000_000 }),
      (a, b, vidaA, vidaB, fallos, semilla) => {
        const controladores: Controlador[] = [a, b].map((id) => ({ tipo: "ia", nombre: buscarPersonalidad(id).nombre, personalidad: buscarPersonalidad(id) }));
        const asientos: AsientoResumen[] = controladores.map((_, id) => ({
          nombre: nombreEnResumen(controladores, id),
          desplazada: id === 1,
          integridad: id === 0 ? vidaA : vidaB,
          fallosSeguidos: fallos,
          credito: id === 0 ? 0 : undefined,
          viva: true,
        }));
        for (const situacionForzada of [undefined, "desplazada" as const]) {
          const texto = resumenPartida({ asientos, ronda: 6, recientes: [], situacionForzada }, semilla).texto;
          assert.doesNotMatch(texto, /…/);
          assert.ok(texto.length <= LONGITUD_MAXIMA_RESUMEN, texto);
        }
      },
    ),
  );
  assert.equal(NOMBRES_CORTOS_RIVAL["almirante-bisagra"], "Bisagra");
  for (const personalidad of rivales) assert.ok(NOMBRES_CORTOS_RIVAL[personalidad.id], personalidad.id);
});

test("txt-2: todas las plantillas de «desplazada» caben en 140 con el nombre más largo", () => {
  for (const plantilla of PLANTILLAS_RESUMEN.desplazada) {
    const texto = plantilla.replace("{desplazada}", `${"N".repeat(14)} fue desplazada`).replace("{lider}", "N".repeat(14)).replace(/\{\w+\}/g, "150");
    assert.ok(texto.length <= LONGITUD_MAXIMA_RESUMEN, `${texto.length}: ${plantilla}`);
  }
});

test("txt-3: invariante -- la ficha de cualquier arma dice «Gratis» como mucho una vez", () => {
  for (const arma of CATALOGO_ARMAS) {
    const linea = lineaCosteFicha(0, arma.efecto.tipo === "danio");
    assert.ok((linea.match(/Gratis/g) ?? []).length <= 1, `${arma.id}: ${linea}`);
  }
  assert.equal(lineaCosteFicha(0, true).match(/Gratis/g)?.length, 1);
  assert.equal(lineaCosteFicha(40, true).includes("Gratis"), false);
});

test("txt-4: la ayuda de la primera partida explica el gesto del dedo", () => {
  assert.match(TEXTO_AYUDA_APUNTADO, /dedo/);
  assert.match(TEXTO_AYUDA_APUNTADO, /alrededor de tu nave/);
  assert.match(TEXTO_AYUDA_APUNTADO, /fuerza/);
});
