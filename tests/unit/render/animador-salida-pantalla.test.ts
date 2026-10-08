import "../../entorno-phaser.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import type Phaser from "phaser";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import type { EstadoProyectil } from "@/sim/fisica/proyectil";

function crearEscenaDeMentira(): Phaser.Scene {
  const grafico = {
    clear: () => grafico,
    fillStyle: () => grafico,
    fillPoints: () => grafico,
    setVisible: () => grafico,
    setDepth: () => grafico,
    setPosition: () => grafico,
    setRotation: () => grafico,
  };
  return { add: { graphics: () => grafico } } as unknown as Phaser.Scene;
}

const ENCUADRE = { ancho: 800, alto: 450 };
const INICIO: EstadoProyectil = { x: 700, y: 300, vx: 400, vy: -50 };

test("la animación termina en el mismo punto en que el núcleo declara perdido el tiro que sale del encuadre", () => {
  const nuncaSeDetiene = () => false;
  const referencia = simularVuelo(INICIO, 0, 0, nuncaSeDetiene, { encuadre: ENCUADRE });
  assert.equal(referencia.perdido, true);

  const animador = new AnimadorProyectil(crearEscenaDeMentira());
  animador.fijarEncuadre(ENCUADRE);
  let final: EstadoProyectil | null = null;
  animador.iniciar(INICIO, 0, 0, nuncaSeDetiene, (f) => (final = f));
  // Un solo fotograma de 20 s: si la vista ignorase el encuadre, seguiría
  // volando fuera de pantalla hasta el presupuesto en vez de cortar aquí.
  animador.actualizar(20_000);

  assert.equal(animador.enVuelo(), false);
  assert.notEqual(final, null);
  assert.ok(final!.x > ENCUADRE.ancho, "el corte está más allá del borde derecho");
  assert.ok(final!.x < ENCUADRE.ancho + 24 + 400 * 0.05, "y no mucho más allá del margen");
});
