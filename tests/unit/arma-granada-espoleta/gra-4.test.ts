import "../../entorno-phaser.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import type Phaser from "phaser";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { crearDetenerseConMecha, detenerseEnSuelo, ALTURA_CANON_PX } from "@/sim/armas/resolver";
import { pasosDeMecha } from "@/sim/fisica/comportamientoExtendido";
import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { buscarArma } from "@/sim/armas/catalogo";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

// Mismo doble de escena que proy-2.test.ts: AnimadorProyectil solo necesita
// que this.add.graphics() devuelva algo encadenable con los métodos que de
// verdad llama.
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

const ANCHO = 1920;
const ALTO = 1080;
const ALTURA_SUELO = 900;
const GRAVEDAD = 1;
const GRANADA = buscarArma("granada-de-espoleta");
const PASOS_HASTA_DETONAR = GRANADA.comportamiento.tipo === "mecha" ? pasosDeMecha(GRANADA.comportamiento.segundosHastaDetonar) : 0;

function inicialLofted(): EstadoProyectil {
  const [solucion] = resolverSolucionesBalisticas(300, ALTURA_SUELO, 900, ALTURA_SUELO, GRAVEDAD);
  const rad = (solucion.anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(solucion.potencia);
  return crearProyectil(300, ALTURA_SUELO - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
}

// Corre el animador hasta que detona (o agota un tope generoso de
// fotogramas), avanzando `deltaMs` por llamada -- deltaMs distinto simula
// una animación más rápida o más lenta/entrecortada sin tocar el núcleo.
function animarHastaDetonar(deltaMs: number): EstadoProyectil {
  const inicial = inicialLofted();
  const detenerse = detenerseEnSuelo(crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO), ANCHO, ALTO);
  const animador = new AnimadorProyectil(crearEscenaDeMentira());
  let final: EstadoProyectil | null = null;
  animador.iniciar(inicial, GRAVEDAD, 0, detenerse, (f) => (final = f), undefined, undefined, undefined, undefined, PASOS_HASTA_DETONAR);
  for (let i = 0; i < 200_000 && animador.enVuelo(); i++) {
    animador.actualizar(deltaMs);
  }
  assert.ok(final !== null, `la animación con deltaMs=${deltaMs} no terminó`);
  return final!;
}

// gra-4: el tiempo de la espoleta es del núcleo -- resolviendo el mismo
// disparo SIN ninguna animación (simularVuelo + crearDetenerseConMecha
// directamente) tiene que dar el mismo punto final que la animación del
// cliente, a cualquier velocidad de fotograma.
test("gra-4: el punto de detonación animado coincide con el resuelto por el núcleo sin animación", () => {
  const inicial = inicialLofted();
  const detenerseBase = detenerseEnSuelo(crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO), ANCHO, ALTO);
  const detenerseConMecha = crearDetenerseConMecha(detenerseBase, PASOS_HASTA_DETONAR);
  const resuelto = simularVuelo(inicial, GRAVEDAD, 0, detenerseConMecha);

  const animado60fps = animarHastaDetonar(1000 / 60);
  assert.equal(animado60fps.x, resuelto.proyectil.x);
  assert.equal(animado60fps.y, resuelto.proyectil.y);
});

// gra-4: cambiar la velocidad de animación (fotogramas grandes que agrupan
// muchos pasos fijos por llamada, o pequeños que dan uno cada vez) no puede
// cambiar el instante de detonación en pasos -- si cambiara, el reloj
// dependería del framerate, justo lo que este criterio prohíbe.
test("gra-4: acelerar o pausar la animación (deltaMs distinto) no cambia el punto de detonación", () => {
  const rapida = animarHastaDetonar(1000 / 6); // ~10 pasos fijos agrupados por llamada
  const lenta = animarHastaDetonar(1000 / 240); // menos de un paso fijo por llamada
  const normal = animarHastaDetonar(1000 / 60); // un paso fijo por llamada

  assert.equal(rapida.x, normal.x);
  assert.equal(rapida.y, normal.y);
  assert.equal(lenta.x, normal.x);
  assert.equal(lenta.y, normal.y);
});
