import { test } from "node:test";
import assert from "node:assert/strict";
import type { Arma } from "@/sim/armas/tipos";
import { familiaVisualDe, hashSilueta, puntosSilueta } from "@/juego/proyectiles/geometriaProyectil";

// pyl-2: un arma inventada que no existe en el catálogo real (ids que
// familiaVisualDe/puntosSilueta nunca han visto) para demostrar que la
// familia se deriva de los ejes declarados y no de ningún id conocido --
// si esta prueba pasara por casualidad (p. ej. porque el código cayera en
// una rama por defecto que coincide con lo esperado sin mirar los ejes), el
// segundo bloque de abajo (dos armas con los mismos ejes y distinto id) lo
// delataría, porque exige resultado IDÉNTICO entre id distintos.
const EJES_BASE = {
  nombre: "Arma de prueba pyl-2",
  descripcion: "Fixture de test, no forma parte del catálogo jugable.",
  comportamiento: { tipo: "impacto-simple" as const },
  huella: { tipo: "circular" as const, radio: 30, signo: "restar" as const },
  efecto: { tipo: "danio" as const, radioEfectoPx: 40, danioMaximo: 20 },
  fiabilidad: 1,
};

function armaConAxis(id: string, ejes: Partial<Arma>): Arma {
  return { id, ...EJES_BASE, ...ejes };
}

test("pyl-2: la familia visual se deriva de los ejes de comportamiento/huella/efecto, nunca del id del arma", () => {
  const casos: Array<{ ejes: Partial<Arma>; esperada: string }> = [
    { ejes: { comportamiento: { tipo: "instantaneo" } }, esperada: "haz" },
    { ejes: { penetracionPx: 50 }, esperada: "broca" },
    { ejes: { disparosSimultaneos: { cantidad: 3, aperturaGrados: 10 } }, esperada: "flecha" },
    {
      ejes: {
        efecto: { tipo: "danio-y-autodanio", radioEfectoPx: 40, danioMaximo: 20, autoDanioMaximo: 5, radioAutoHuellaPx: 10 },
      },
      esperada: "flecha",
    },
    { ejes: { huella: { tipo: "ninguna" } }, esperada: "orbe" },
    { ejes: { comportamiento: { tipo: "submuniciones", cantidad: 3, dispersionPxS: 10 } }, esperada: "racimo" },
    { ejes: { comportamiento: { tipo: "rodante", distanciaMaximaPx: 100, pasoPx: 10 } }, esperada: "chatarra" },
    { ejes: { huella: { tipo: "capsula", medioLargoPx: 40, radio: 10, signo: "restar" } }, esperada: "capsula" },
    { ejes: {}, esperada: "bomba" },
  ];

  for (const { ejes, esperada } of casos) {
    // Cada caso se prueba con dos ids completamente distintos e inventados:
    // si la familia dependiera del id (aunque fuera por accidente, p. ej.
    // un switch que mirara arma.id además de los ejes), estos dos ids
    // distintos no coincidirían con la misma familia esperada.
    const armaUno = armaConAxis("zzz-inventada-nunca-vista-1", ejes);
    const armaDos = armaConAxis("qqq-otra-id-completamente-distinta", ejes);
    assert.equal(familiaVisualDe(armaUno), esperada, `id "${armaUno.id}": familia esperada "${esperada}"`);
    assert.equal(familiaVisualDe(armaDos), esperada, `id "${armaDos.id}": familia esperada "${esperada}"`);
  }
});

test("pyl-2: dos armas inventadas con los mismos ejes pero distinto id producen exactamente la misma silueta", () => {
  const ejes: Partial<Arma> = { penetracionPx: 33 };
  const armaUno = armaConAxis("id-inventado-alfa", ejes);
  const armaDos = armaConAxis("id-inventado-beta-totalmente-distinto", ejes);
  assert.equal(hashSilueta(puntosSilueta(armaUno)), hashSilueta(puntosSilueta(armaDos)));
});
