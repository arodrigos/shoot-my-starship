import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { comprobarCantidadDentroDelTecho, crearEmisorRegistrado } from "@/juego/efectos/crearEmisorRegistrado";
import { REGISTRO_EFECTOS } from "@/juego/efectos/registroEfectos";

const execFileAsync = promisify(execFile);

// pre-1: el guardia mecánico (con su propio autotest negativo) es la
// comprobación de CI; aquí se prueba el comportamiento real del único punto
// por el que un efecto nuevo puede nacer -- que valide de verdad contra el
// registro, no solo que exista.
test("pre-1: comprobar-presupuesto-render.mjs pasa en verde sobre el árbol real", async () => {
  await execFileAsync("node", ["scripts/comprobar-presupuesto-render.mjs"], { cwd: process.cwd() });
});

test("pre-1: crearEmisorRegistrado rechaza un id que no está en el registro", () => {
  const escenaDeMentira = { add: { particles: () => ({}) } } as never;
  assert.throws(
    () => crearEmisorRegistrado(escenaDeMentira, "efecto-inventado" as never, 0, 0, "textura", { quantity: 0 }),
    /no está en REGISTRO_EFECTOS/,
  );
});

test("pre-1: crearEmisorRegistrado rechaza un maxParticles por encima del techo declarado", () => {
  const escenaDeMentira = { add: { particles: () => ({}) } } as never;
  const techo = REGISTRO_EFECTOS["estela-proyectil"].techoParticulas;
  assert.throws(
    () =>
      crearEmisorRegistrado(escenaDeMentira, "estela-proyectil", 0, 0, "textura", {
        quantity: 0,
        maxParticles: techo + 1,
      }),
    /por encima de su techo/,
  );
});

test("pre-1: crearEmisorRegistrado acepta una configuración dentro del techo declarado", () => {
  const particulasCreadas: unknown[] = [];
  const escenaDeMentira = {
    add: {
      particles: (...argumentos: unknown[]) => {
        particulasCreadas.push(argumentos);
        return { emisor: true };
      },
    },
  } as never;
  const techo = REGISTRO_EFECTOS["estela-proyectil"].techoParticulas;
  const emisor = crearEmisorRegistrado(escenaDeMentira, "estela-proyectil", 0, 0, "textura", {
    quantity: 0,
    maxParticles: techo,
  });
  assert.deepEqual(emisor, { emisor: true });
  assert.equal(particulasCreadas.length, 1);
});

test("pre-1: comprobarCantidadDentroDelTecho rechaza una cantidad por encima del techo del efecto", () => {
  const techo = REGISTRO_EFECTOS["explosion-con-danio"].techoParticulas;
  assert.throws(() => comprobarCantidadDentroDelTecho("explosion-con-danio", techo + 1), /por encima de su techo/);
  assert.doesNotThrow(() => comprobarCantidadDentroDelTecho("explosion-con-danio", techo));
});
