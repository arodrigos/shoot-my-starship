import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { parse, wcagContrast, formatHex } from "culori";
import { PARES_CONTRASTE_HUD, tamTexto, TAMANO_TEXTO_MINIMO_PX } from "@/juego/hud/legibilidad";

// ct-3: el texto con alfa se mezcla sobre su fondo opaco antes de medir, igual
// que hace el navegador al pintar.
function contraste(texto: string, fondo: string): number {
  const f = parse(fondo);
  const t = parse(texto);
  assert.ok(f && t, `color no reconocido: ${texto} / ${fondo}`);
  const alfa = t.alpha ?? 1;
  const mezclado = {
    mode: "rgb" as const,
    r: (t as { r: number }).r * alfa + (f as { r: number }).r * (1 - alfa),
    g: (t as { g: number }).g * alfa + (f as { g: number }).g * (1 - alfa),
    b: (t as { b: number }).b * alfa + (f as { b: number }).b * (1 - alfa),
  };
  return wcagContrast(formatHex(mezclado), fondo);
}

for (const par of PARES_CONTRASTE_HUD) {
  test(`ct-3: par «${par.id}» (${par.esquema}) llega a 4,5:1`, () => {
    const ratio = contraste(par.texto, par.fondo);
    assert.ok(ratio >= 4.5, `el par ${par.id} da ${ratio.toFixed(2)}:1`);
  });
}

test("ct-3: «Otra partida» da unos 6,5:1 (texto oscuro sobre el coral)", () => {
  assert.ok(contraste("#12141a", "#ff6b4a") >= 6);
});

test("ct-3: la tabla cubre los dos esquemas y los componentes pedidos", () => {
  const esquemas = new Set(PARES_CONTRASTE_HUD.map((p) => p.esquema));
  assert.ok(esquemas.has("oscuro") && esquemas.has("claro"));
  const ids = PARES_CONTRASTE_HUD.map((p) => p.id).join(" ");
  for (const parte of ["parte-", "menu-", "relevo-", "reloj-", "aviso-"]) assert.ok(ids.includes(parte), parte);
  assert.equal(new Set(PARES_CONTRASTE_HUD.map((p) => p.id)).size, PARES_CONTRASTE_HUD.length);
});

test("ct-3: invariante, todo par de la tabla cumple 4,5:1 en su esquema", () => {
  fc.assert(
    fc.property(fc.constantFrom(...PARES_CONTRASTE_HUD), (par) => contraste(par.texto, par.fondo) >= 4.5),
    { numRuns: 100 },
  );
});

test("ct-5: invariante, tamTexto(px >= 14) devuelve exactamente calc(px * escala)", () => {
  fc.assert(
    fc.property(fc.integer({ min: TAMANO_TEXTO_MINIMO_PX, max: 96 }), (px) => tamTexto(px) === `calc(${px}px * var(--escala-texto, 1))`),
    { numRuns: 200 },
  );
});
