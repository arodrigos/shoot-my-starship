import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";

const ANCHO = 4000;
const ALTO = 4000;

test("imp-5: un disparo normal sale de la nave sin detonar en ella (gracia del casco propio)", () => {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  const naveX = 500;
  const naveY = 500;
  const armaBase = buscarArma("pepinazo-cortesia");

  const resultado = resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: armaBase,
    origenX: naveX,
    origenY: naveY,
    anguloGrados: 20,
    potencia: 60,
    objetivoX: naveX + 3000,
    objetivoY: naveY,
    ancho: ANCHO,
    alto: ALTO,
    naves: [
      { id: 0, x: naveX, y: naveY },
      { id: 1, x: naveX + 3000, y: naveY },
    ],
    tiradorId: 0,
  });

  assert.equal(resultado.impactoPropio, null, "un disparo normal no puede detonar sobre el propio casco al salir");
  assert.notEqual(
    resultado.puntosDeImpacto[0]?.impactoNave,
    0,
    "el punto de impacto no puede identificar a la propia nave como la que ha detenido el vuelo",
  );
});

test("imp-5: un tiro casi vertical que la gravedad de un planeta devuelve sobre la propia nave SÍ detona en ella y causa autoimpacto", () => {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  const naveX = 1500;
  const naveY = 1500;
  const armaBase = buscarArma("pepinazo-cortesia");
  const efecto = armaBase.efecto;
  if (efecto.tipo !== "danio") {
    throw new Error("imp-5 espera que el arma base sea de tipo daño");
  }

  // Planeta ficticio, colocado a propósito bajo la propia nave: su masa (no
  // su radio real de mapa, que no hace falta reconstruir aquí) es lo único
  // que importa para curvar la trayectoria de vuelta. Ángulo casi vertical
  // (88°, no exactamente 90°) para que el retorno sea obra de la gravedad y
  // no de una simetría trivial de tiro puramente vertical.
  const planetas: RegistroPlanetas = [{ id: 1, cx: naveX, cy: naveY + 300, radio: 50, densidad: 1_000_000, pixelesVivos: 20 }];

  const resultado = resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: armaBase,
    origenX: naveX,
    origenY: naveY,
    anguloGrados: 88,
    potencia: 20,
    objetivoX: naveX + 3000,
    objetivoY: naveY,
    ancho: ANCHO,
    alto: ALTO,
    planetas,
    naves: [
      { id: 0, x: naveX, y: naveY },
      { id: 1, x: naveX + 3000, y: naveY },
    ],
    tiradorId: 0,
  });

  assert.equal(resultado.puntosDeImpacto[0]?.impactoNave, 0, "la gravedad debe devolver el disparo sobre el propio casco del tirador");
  assert.notEqual(resultado.impactoPropio, null, "el autoimpacto por gravedad debe quedar registrado, separado de danioPropio");
  assert.ok((resultado.impactoPropio?.danio ?? 0) > 0, "el autoimpacto por gravedad debe causar daño real");
});
