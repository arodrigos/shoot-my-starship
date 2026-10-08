import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { createCanvas } from "canvas";
import type Phaser from "phaser";
import { crearMascaraVacia, type Mascara } from "@/sim/terreno/mascara";
import { SuperficieEspacio, type GeometriaPlaneta } from "@/juego/terreno/SuperficieEspacio";
import { SuperficieCanvasPhaser } from "@/juego/terreno/SuperficieCanvasPhaser";
import { Terreno } from "@/juego/terreno/Terreno";

const ANCHO = 800;
const ALTO = 600;
const PLANETAS: GeometriaPlaneta[] = [
  { cx: 220, cy: 300, radio: 140 },
  { cx: 580, cy: 300, radio: 120 },
];

function crearMascara(): Mascara {
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  PLANETAS.forEach((p, i) => {
    for (let y = 0; y < ALTO; y++) {
      for (let x = 0; x < ANCHO; x++) {
        if (Math.hypot(x - p.cx, y - p.cy) <= p.radio) mascara.datos[y * ANCHO + x] = i + 1;
      }
    }
  });
  return mascara;
}

interface Espias {
  getImageData: number;
  update: number;
  refresh: number;
}

// Textura de prueba con un lienzo real del paquete canvas y contadores de las
// tres llamadas que el camino de impacto no debe hacer (o solo una vez).
function crearTextura(): { textura: Phaser.Textures.CanvasTexture; espias: Espias; lienzo: ReturnType<typeof createCanvas> } {
  const lienzo = createCanvas(ANCHO, ALTO);
  const contexto = lienzo.getContext("2d");
  const espias: Espias = { getImageData: 0, update: 0, refresh: 0 };
  const original = contexto.getImageData.bind(contexto);
  (contexto as unknown as { getImageData: typeof original }).getImageData = (...args) => {
    espias.getImageData++;
    return original(...args);
  };
  const textura = {
    context: contexto,
    width: ANCHO,
    height: ALTO,
    update: () => {
      espias.update++;
    },
    refresh: () => {
      espias.refresh++;
    },
  } as unknown as Phaser.Textures.CanvasTexture;
  return { textura, espias, lienzo };
}

function pixeles(lienzo: ReturnType<typeof createCanvas>): Uint8ClampedArray {
  return lienzo.getContext("2d").getImageData(0, 0, ANCHO, ALTO).data;
}

const geometrias = new Map(PLANETAS.map((p, i) => [i + 1, p]));

function crearSuperficies(): Array<{ nombre: string; crear: (t: Phaser.Textures.CanvasTexture) => SuperficieEspacio | SuperficieCanvasPhaser }> {
  return [
    { nombre: "espacio", crear: (t) => new SuperficieEspacio(t, geometrias) },
    { nombre: "canvas", crear: (t) => new SuperficieCanvasPhaser(t) },
  ];
}

for (const { nombre, crear } of crearSuperficies()) {
  test(`par-2 (${nombre}): cinco cráteres del Racimo en un frame dan 0 píxeles distintos, 1 refresh y ninguna lectura`, () => {
    const mascara = crearMascara();
    const { textura, espias, lienzo } = crearTextura();
    const superficie = crear(textura);
    superficie.pintarCompleta(mascara);
    espias.getImageData = 0;
    espias.update = 0;
    const terreno = new Terreno(mascara, superficie);

    const centro = { x: 300, y: 230 };
    const patron = [[0, 0], [18, 0], [-18, 0], [0, 18], [0, -18]];
    for (const [dx, dy] of patron) terreno.aplicarHuella(centro.x + dx, centro.y + dy, 30, "restar");
    assert.equal(terreno.vaciarCola(), true);
    assert.equal(terreno.vaciarCola(), false, "sin cambios nuevos no hay segundo refresh");

    // Las lecturas del propio test (pixeles) no cuentan: se congelan antes.
    assert.equal(espias.refresh, 1);
    assert.equal(espias.update, 0);
    assert.equal(espias.getImageData, 0);
    const referencia = crearTextura();
    crear(referencia.textura).pintarCompleta(mascara);
    assert.deepEqual(pixeles(lienzo), pixeles(referencia.lienzo));
  });

  test(`par-2 (${nombre}): un cráter en la esquina y uno en el aire no fallan y como mucho hacen 1 refresh`, () => {
    const mascara = crearMascara();
    const { textura, espias, lienzo } = crearTextura();
    const superficie = crear(textura);
    superficie.pintarCompleta(mascara);
    const terreno = new Terreno(mascara, superficie);

    terreno.aplicarHuella(0, 0, 40, "restar");
    terreno.aplicarHuella(400, 20, 10, "restar");
    terreno.vaciarCola();
    assert.ok(espias.refresh <= 1);

    const referencia = crearTextura();
    crear(referencia.textura).pintarCompleta(mascara);
    assert.deepEqual(pixeles(lienzo), pixeles(referencia.lienzo));
  });

  // Invariantes 1 y 2 del bloque: para cualquier secuencia de cráteres el
  // refresco incremental iguala a pintarCompleta, y por frame hay como
  // mucho un refresh y ninguna lectura.
  test(`par-2 (${nombre}): property test, incremental == pintarCompleta y a lo sumo 1 refresh por frame`, () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.array(
            fc.record({ x: fc.integer({ min: -20, max: ANCHO + 20 }), y: fc.integer({ min: -20, max: ALTO + 20 }), r: fc.integer({ min: 4, max: 45 }), signo: fc.constantFrom("restar" as const, "sumar" as const) }),
            { minLength: 1, maxLength: 5 },
          ),
          { minLength: 1, maxLength: 3 },
        ),
        (frames) => {
          const mascara = crearMascara();
          const { textura, espias, lienzo } = crearTextura();
          const superficie = crear(textura);
          superficie.pintarCompleta(mascara);
          espias.getImageData = 0;
          espias.update = 0;
          const terreno = new Terreno(mascara, superficie);
          for (const detonaciones of frames) {
            const antes = espias.refresh;
            for (const d of detonaciones) terreno.aplicarHuella(d.x, d.y, d.r, d.signo);
            terreno.vaciarCola();
            assert.ok(espias.refresh - antes <= 1);
          }
          assert.equal(espias.update, 0);
          assert.equal(espias.getImageData, 0);
          const referencia = crearTextura();
          crear(referencia.textura).pintarCompleta(mascara);
          assert.deepEqual(pixeles(lienzo), pixeles(referencia.lienzo));
        },
      ),
      { numRuns: 40 },
    );
  });
}
