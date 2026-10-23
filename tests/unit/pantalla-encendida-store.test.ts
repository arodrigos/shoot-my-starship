import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  marcarPartidaEnCurso,
  obtenerPantallaEncendida,
  reiniciarPantallaEncendida,
  type CentinelaBloqueo,
  type ProveedorBloqueo,
} from "@/juego/control/pantallaEncendidaStore";

// Proveedor falso que deja decidir al test cuándo y cómo se resuelve cada
// petición, y cuenta los centinelas vivos igual que el navegador.
function crearProveedor(opciones: { releaseLanza?: boolean } = {}) {
  const pendientes: Array<{ resolver: () => void; rechazar: () => void }> = [];
  const f = { vivos: 0, llamadas: 0, tipos: [] as string[] };
  const proveedor: ProveedorBloqueo = {
    request(tipo) {
      f.llamadas++;
      f.tipos.push(tipo);
      return new Promise<CentinelaBloqueo>((resolve, reject) => {
        pendientes.push({
          rechazar: () => reject(new DOMException("no", "NotAllowedError")),
          resolver: () => {
            f.vivos++;
            let vivo = true;
            resolve({
              async release() {
                if (opciones.releaseLanza) throw new Error("fallo al soltar");
                if (vivo) f.vivos--;
                vivo = false;
              },
              addEventListener() {},
            });
          },
        });
      });
    },
  };
  return { proveedor, pendientes, f };
}
const turno = () => new Promise<void>((r) => setImmediate(r));

beforeEach(() => reiniciarPantallaEncendida(null));

test("pe-1: marcarPartidaEnCurso(true) pide el bloqueo 'screen' de forma síncrona", () => {
  const { proveedor, f } = crearProveedor();
  reiniciarPantallaEncendida(proveedor);
  assert.equal(f.llamadas, 0);
  marcarPartidaEnCurso(true);
  assert.equal(f.llamadas, 1);
  assert.deepEqual(f.tipos, ["screen"]);
});

test("pe-1: el manejador de Jugar y el de Continuar llaman a marcarPartidaEnCurso(true) antes de cambiar de fase", async () => {
  const { readFile } = await import("node:fs/promises");
  const fuente = await readFile("src/juego/Aplicacion.tsx", "utf8");
  assert.equal((fuente.match(/marcarPartidaEnCurso\(true\);\n\s+setFase\("jugando"\)/g) ?? []).length, 2);
});

test("pe-2: una petición con retraso que llega tras salir de la partida se suelta y deja 0 vivos", async () => {
  const { proveedor, pendientes, f } = crearProveedor();
  reiniciarPantallaEncendida(proveedor);
  marcarPartidaEnCurso(true);
  marcarPartidaEnCurso(false);
  pendientes[0].resolver();
  await turno();
  assert.equal(f.vivos, 0);
  assert.equal(obtenerPantallaEncendida().sentinelasVivas, 0);
  assert.equal(obtenerPantallaEncendida().estado, "inactivo");
});

test("pe-5: sin API el estado es no-soportado y nada lanza", () => {
  reiniciarPantallaEncendida(null);
  marcarPartidaEnCurso(true);
  marcarPartidaEnCurso(false);
  const s = obtenerPantallaEncendida();
  assert.equal(s.estado, "no-soportado");
  assert.equal(s.soportada, false);
  assert.equal(s.peticiones, 0);
});

test("pe-5: rechazo y release() que lanza no producen excepciones", async () => {
  const { proveedor, pendientes } = crearProveedor({ releaseLanza: true });
  reiniciarPantallaEncendida(proveedor);
  marcarPartidaEnCurso(true);
  pendientes[0].rechazar();
  await turno();
  assert.equal(obtenerPantallaEncendida().estado, "rechazado");
  marcarPartidaEnCurso(false);
  marcarPartidaEnCurso(true);
  pendientes[1].resolver();
  await turno();
  marcarPartidaEnCurso(false);
  await turno();
  assert.equal(obtenerPantallaEncendida().sentinelasVivas, 0);
});

test("pe-5: un request que lanza en seco se trata como rechazo", async () => {
  reiniciarPantallaEncendida({
    request() {
      throw new Error("sin permiso");
    },
  });
  marcarPartidaEnCurso(true);
  await turno();
  assert.equal(obtenerPantallaEncendida().estado, "rechazado");
});

test("pe-6: con resoluciones en orden arbitrario nunca hay más de un centinela vivo y, al acabar, ninguno fuera de partida", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.constantFrom("entrar", "salir", "resolver", "rechazar"), { maxLength: 30 }),
      async (pasos) => {
        const { proveedor, pendientes, f } = crearProveedor();
        reiniciarPantallaEncendida(proveedor);
        let enPartida = false;
        for (const paso of pasos) {
          if (paso === "entrar") {
            marcarPartidaEnCurso(true);
            enPartida = true;
          } else if (paso === "salir") {
            marcarPartidaEnCurso(false);
            enPartida = false;
          } else {
            const p = pendientes.shift();
            if (p) (paso === "resolver" ? p.resolver : p.rechazar)();
          }
          await turno();
          assert.ok(f.vivos <= 1);
        }
        while (pendientes.length > 0) {
          pendientes.shift()!.resolver();
          await turno();
        }
        if (!enPartida) assert.equal(f.vivos, 0);
        assert.ok(f.vivos <= 1);
      },
    ),
    { numRuns: 300 },
  );
});
