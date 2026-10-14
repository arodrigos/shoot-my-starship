import test from "node:test";
import fc from "fast-check";
import { respuestaPrecacheable } from "@/juego/pwa/filtroPrecache";

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
