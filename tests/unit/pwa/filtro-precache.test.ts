import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { entradaPrecacheable, respuestaPrecacheable } from "@/juego/pwa/filtroPrecache";

const ORIGEN = "https://juego.example.app";
const respuesta = fc.record({
  redirected: fc.boolean(),
  url: fc.oneof(
    fc.constantFrom(`${ORIGEN}/`, `${ORIGEN}/_next/static/a.js`, "https://vercel.com/login?next=%2F", "", "no es una url"),
    fc.webUrl(),
  ),
  status: fc.constantFrom(200, 204, 301, 401, 404, 500),
});

test("pwa-4: acepta solo status 200 del mismo origen y sin redirección", () => {
  fc.assert(fc.property(respuesta, (r) => {
    let mismoOrigen = false;
    try {
      mismoOrigen = new URL(r.url).origin === ORIGEN;
    } catch {
      mismoOrigen = false;
    }
    return respuestaPrecacheable(r, ORIGEN) === (!r.redirected && r.status === 200 && mismoOrigen);
  }));
});

test("bug10: el chunk de arranque del trabajador no se precachea, venga como cadena o como entrada", () => {
  assert.equal(entradaPrecacheable("/_next/static/chunks/turbopack-worker-abc123.js"), false);
  assert.equal(entradaPrecacheable({ url: "/_next/static/chunks/turbopack-worker-abc123.js" }), false);
  assert.equal(entradaPrecacheable("/_next/static/chunks/app-page-abc.js"), true);
  assert.equal(entradaPrecacheable({ url: "/icon-192.png" }), true);
});
