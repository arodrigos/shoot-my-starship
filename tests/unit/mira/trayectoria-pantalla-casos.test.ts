import { test } from "node:test";
import assert from "node:assert/strict";
import {
  areaPoligono,
  cortarPorLongitudPantalla,
  geometriaTrayectoria,
  longitudDeArco,
  tirasTramo2,
  tramoEntre,
  type PuntoPantalla,
} from "@/juego/mira/trayectoriaPantalla";
import { calcularAbanicoPrevisualizacion } from "@/sim/armas/previsualizacion";
import { MARGEN_SALIDA_U } from "@/sim/fisica/vuelo";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

// Casos con resultado exacto, a mano: las propiedades de trayectoria-pantalla.test.ts
// aceptan cotas holgadas y dejarían pasar un signo cambiado en la interpolación o un
// lado menor en vez del mayor.

const cerca = (a: number, b: number, tolerancia = 1e-9) => assert.ok(Math.abs(a - b) <= tolerancia, `${a} ≠ ${b}`);
const puntoCerca = (p: PuntoPantalla, x: number, y: number, tolerancia = 1e-9) => {
  cerca(p.x, x, tolerancia);
  cerca(p.y, y, tolerancia);
};

// Polilínea en L: 10 px a la derecha y 10 px hacia abajo.
const ESCUADRA: readonly PuntoPantalla[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
// Recta horizontal de 30 px con un vértice cada 10.
const RECTA: readonly PuntoPantalla[] = [0, 10, 20, 30].map((x) => ({ x, y: 0 }));

test("geometriaTrayectoria: L es el lado MAYOR tanto en vertical como en horizontal", () => {
  const vertical = geometriaTrayectoria({ anchoCss: 390, altoCss: 844, armaId: "canon" });
  assert.deepEqual([vertical.L, vertical.radioTramo1Px, vertical.radioTramo2Px], [844, 105.5, 211]);
  const horizontal = geometriaTrayectoria({ anchoCss: 1920, altoCss: 1080, armaId: "canon" });
  assert.deepEqual([horizontal.L, horizontal.radioTramo1Px, horizontal.radioTramo2Px], [1920, 240, 480]);
  const cuadrada = geometriaTrayectoria({ anchoCss: 800, altoCss: 800, armaId: "canon" });
  assert.equal(cuadrada.L, 800);
});

test("geometriaTrayectoria: solo el id exacto de la mosca dobla las semiaperturas", () => {
  const mosca = geometriaTrayectoria({ anchoCss: 800, altoCss: 600, armaId: "mosca-cojonera" });
  assert.deepEqual([mosca.semiapertura1, mosca.semiapertura2], [18, 90]);
  // Los radios son de pantalla y no dependen del arma.
  assert.deepEqual([mosca.radioTramo1Px, mosca.radioTramo2Px], [100, 200]);
  for (const armaId of ["canon", "", "mosca", "Mosca-Cojonera"]) {
    const g = geometriaTrayectoria({ anchoCss: 800, altoCss: 600, armaId });
    assert.deepEqual([g.semiapertura1, g.semiapertura2], [9, 45], armaId);
  }
});

test("longitudDeArco: suma de segmentos, 0 sin segmentos", () => {
  assert.equal(longitudDeArco([]), 0);
  assert.equal(longitudDeArco([{ x: 7, y: -3 }]), 0);
  // 3-4-5 y 5-12-13, el segundo hacia coordenadas negativas.
  assert.equal(longitudDeArco([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: -2, y: -8 }]), 18);
  assert.equal(longitudDeArco(ESCUADRA), 20);
});

test("cortarPorLongitudPantalla: sin trayectoria o sin longitud se queda en el origen", () => {
  assert.deepEqual(cortarPorLongitudPantalla([], 50), []);
  assert.deepEqual(cortarPorLongitudPantalla(ESCUADRA, 0), [{ x: 0, y: 0 }]);
  assert.deepEqual(cortarPorLongitudPantalla(ESCUADRA, -5), [{ x: 0, y: 0 }]);
  assert.deepEqual(cortarPorLongitudPantalla([{ x: 4, y: 4 }], 50), [{ x: 4, y: 4 }]);
});

test("cortarPorLongitudPantalla: a mitad de segmento interpola el punto exacto, en la dirección del segmento", () => {
  const corte = cortarPorLongitudPantalla(ESCUADRA, 15);
  assert.equal(corte.length, 3);
  assert.deepEqual(corte.slice(0, 2), ESCUADRA.slice(0, 2));
  puntoCerca(corte[2], 10, 5);

  const primerTramo = cortarPorLongitudPantalla(ESCUADRA, 4);
  assert.equal(primerTramo.length, 2);
  puntoCerca(primerTramo[1], 4, 0);

  const diagonal = cortarPorLongitudPantalla([{ x: 0, y: 0 }, { x: -30, y: 40 }], 25);
  puntoCerca(diagonal[1], -15, 20);
});

test("cortarPorLongitudPantalla: una longitud que cae justo en un vértice termina en ese vértice, sin punto extra", () => {
  assert.deepEqual(cortarPorLongitudPantalla(ESCUADRA, 10), ESCUADRA.slice(0, 2));
  assert.deepEqual(cortarPorLongitudPantalla(ESCUADRA, 20), ESCUADRA);
  // Un segmento de longitud 0 justo en el límite (proyectil parado o recortado al
  // encuadre dos pasos seguidos) cabe todavía: se conserva, no se trata como exceso.
  const conRepetido = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
  assert.deepEqual(cortarPorLongitudPantalla(conRepetido, 10), conRepetido.slice(0, 3));
});

test("cortarPorLongitudPantalla: más corta que el límite se devuelve entera con los mismos puntos (choque antes del radio)", () => {
  const corte = cortarPorLongitudPantalla(ESCUADRA, 1000);
  assert.equal(corte.length, ESCUADRA.length);
  for (let i = 0; i < corte.length; i++) assert.equal(corte[i], ESCUADRA[i]);
});

test("cortarPorLongitudPantalla: el corte no depende de dónde esté la línea en pantalla (bordes y coordenadas negativas)", () => {
  // La misma escuadra pegada al borde izquierdo y saliéndose por arriba: el corte
  // se mide en longitud, no se recorta al rectángulo visible.
  const desplazada = ESCUADRA.map((p) => ({ x: p.x - 5, y: p.y - 8 }));
  const corte = cortarPorLongitudPantalla(desplazada, 15);
  assert.equal(corte.length, 3);
  puntoCerca(corte[2], 5, -3);
  cerca(longitudDeArco(corte), 15);
});

test("tramoEntre: empieza en el punto a distancia `desde` y acaba en el de distancia `hasta`", () => {
  const tramo = tramoEntre(RECTA, 5, 25);
  puntoCerca(tramo[0], 5, 0);
  puntoCerca(tramo[tramo.length - 1], 25, 0);
  // En una recta la longitud no depende de qué vértices intermedios se conserven.
  cerca(longitudDeArco(tramo), 20);
});

// Cuando `desde` cae a mitad de segmento, `a` lleva un punto interpolado de más:
// si los vértices de `hasta` se tomaran desde el índice a.length se perdería el
// primer vértice real tras r1, y en una curva el borde del tramo ancho cortaría
// esa esquina con una cuerda y mediría menos de r2 − r1.
test("tramoEntre: con `desde` a mitad de segmento conserva el primer vértice posterior", () => {
  const tramo = tramoEntre(ESCUADRA, 5, 15);
  assert.equal(tramo.length, 3);
  puntoCerca(tramo[0], 5, 0);
  assert.deepEqual(tramo[1], { x: 10, y: 0 });
  puntoCerca(tramo[2], 10, 5);
  cerca(longitudDeArco(tramo), 10);
  assert.deepEqual(tramoEntre(RECTA, 5, 25).slice(1, 3), [{ x: 10, y: 0 }, { x: 20, y: 0 }]);
});

test("tramoEntre: con los dos radios en vértices no repite ni pierde puntos", () => {
  assert.deepEqual(tramoEntre(RECTA, 10, 20), [{ x: 10, y: 0 }, { x: 20, y: 0 }]);
  assert.deepEqual(tramoEntre(RECTA, 0, 10), [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
});

test("tramoEntre: si la trayectoria choca entre los dos radios, acaba en el choque", () => {
  const tramo = tramoEntre(RECTA, 15, 80);
  puntoCerca(tramo[0], 15, 0);
  assert.deepEqual(tramo[tramo.length - 1], { x: 30, y: 0 });
  cerca(longitudDeArco(tramo), 15);
  // Con `desde` en un vértice no hay interpolación y salen todos los vértices.
  assert.deepEqual(tramoEntre(RECTA, 10, 80), [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }]);
});

test("tramoEntre: si choca antes del primer radio, queda cerrado en el punto de choque", () => {
  assert.deepEqual(tramoEntre(RECTA, 40, 80), [{ x: 30, y: 0 }, { x: 30, y: 0 }]);
  assert.deepEqual(tramoEntre([], 40, 80), []);
});

test("areaPoligono: área absoluta, igual en los dos sentidos de recorrido", () => {
  const horario = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
  assert.equal(areaPoligono(horario), 12);
  assert.equal(areaPoligono([...horario].reverse()), 12);
  assert.equal(areaPoligono([{ x: -2, y: -2 }, { x: 2, y: -2 }, { x: -2, y: 1 }]), 6);
  assert.equal(areaPoligono([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }]), 0);
  assert.equal(areaPoligono([]), 0);
});

// Rayo recto desde el origen de pantalla, en grados con el eje y hacia abajo.
function rayo(grados: number, largo: number): PuntoPantalla[] {
  const r = (grados * Math.PI) / 180;
  return [0, largo / 2, largo].map((d) => ({ x: Math.cos(r) * d, y: -Math.sin(r) * d }));
}

test("tirasTramo2: una tira por pareja de rayos vecinos, con el área de la corona entre r1 y r2", () => {
  const tiras = tirasTramo2([rayo(0, 100), rayo(45, 100), rayo(90, 100)], 50, 100);
  assert.equal(tiras.length, 2);
  // Cuadrilátero entre dos rayos a 45°: diferencia de dos triángulos isósceles.
  const esperada = 0.5 * Math.sin(Math.PI / 4) * (100 * 100 - 50 * 50);
  for (const tira of tiras) {
    assert.equal(tira.length, 4);
    cerca(areaPoligono(tira), esperada, 1e-6);
  }
  // La primera tira es la del rayo de 0° con el de 45°, recorrida de r1 a r2 y de vuelta.
  puntoCerca(tiras[0][0], 50, 0, 1e-9);
  puntoCerca(tiras[0][1], 100, 0, 1e-9);
  puntoCerca(tiras[0][2], 100 * Math.SQRT1_2, -100 * Math.SQRT1_2, 1e-9);
  puntoCerca(tiras[0][3], 50 * Math.SQRT1_2, -50 * Math.SQRT1_2, 1e-9);
});

test("tirasTramo2: descarta las tiras sin superficie y no inventa ninguna con un solo rayo", () => {
  assert.deepEqual(tirasTramo2([rayo(30, 100), rayo(30, 100)], 50, 100), []);
  assert.deepEqual(tirasTramo2([rayo(30, 100)], 50, 100), []);
  assert.deepEqual(tirasTramo2([], 50, 100), []);
  // Los dos rayos chocan antes de r1: ambos bordes son un punto y no hay tira.
  assert.deepEqual(tirasTramo2([rayo(0, 20), rayo(90, 20)], 50, 100), []);
  // Solo uno choca pronto: la tira es un triángulo cerrado en su punto de choque.
  const tiras = tirasTramo2([rayo(0, 20), rayo(90, 100)], 50, 100);
  assert.equal(tiras.length, 1);
  cerca(areaPoligono(tiras[0]), 0.5 * Math.abs(20 * -100 - 20 * -50), 1e-6);
});

// Misma conversión mundo → pantalla CSS que hace la escena: desplazamiento de
// cámara, zoom y escala del lienzo. El recorte por radios de pantalla tiene que
// dar el mismo largo en pantalla con cualquier zoom.
function camara(zoom: number, escalaCss: number, scrollX: number, scrollY: number) {
  return {
    mundoPorPx: 1 / (zoom * escalaCss),
    aPantalla: (puntos: readonly { x: number; y: number }[]): PuntoPantalla[] =>
      puntos.map((p) => ({ x: (p.x - scrollX) * zoom * escalaCss, y: (p.y - scrollY) * zoom * escalaCss })),
  };
}

const mundo = { mascara: crearMascaraPlana(2400, 1400, 1300), gravedad: 1, deriva: 0, ancho: 2400, alto: 1400, comportamiento: { tipo: "impacto-simple" } as const };

test("zoom: con la cota de mundo que pide la escena, el centro recortado mide r2 en pantalla y r2/zoom en mundo", () => {
  const g = geometriaTrayectoria({ anchoCss: 1180, altoCss: 820, armaId: "canon" });
  for (const zoom of [0.5, 1, 2.5]) {
    const cam = camara(zoom, 0.8, 600, 400);
    const longitudMundoMax = Math.ceil(g.radioTramo2Px * cam.mundoPorPx * 1.05);
    const abanico = calcularAbanicoPrevisualizacion({ ...mundo, origenX: 1200, origenY: 1299, anguloGrados: 70, potencia: 60, longitudMundoMax }, g.semiapertura1, g.semiapertura2);
    const centro = cortarPorLongitudPantalla(cam.aPantalla(abanico.centro), g.radioTramo2Px);
    cerca(longitudDeArco(centro), g.radioTramo2Px, 1e-6);
    cerca(longitudDeArco(centro) * cam.mundoPorPx, g.radioTramo2Px / (zoom * 0.8), 1e-6);
    // El tramo 1 de los dos bordes llega a r1 con cualquier zoom.
    cerca(longitudDeArco(cortarPorLongitudPantalla(cam.aPantalla(abanico.tramo1.mayor), g.radioTramo1Px)), g.radioTramo1Px, 1e-6);
    cerca(longitudDeArco(cortarPorLongitudPantalla(cam.aPantalla(abanico.tramo1.menor), g.radioTramo1Px)), g.radioTramo1Px, 1e-6);
    // El tramo ancho empieza justo a r1 del cañón y acaba justo a r2, siguiendo el borde.
    const ancho = tramoEntre(cam.aPantalla(abanico.tramo2.mayor), g.radioTramo1Px, g.radioTramo2Px);
    const borde = cam.aPantalla(abanico.tramo2.mayor);
    const enR1 = cortarPorLongitudPantalla(borde, g.radioTramo1Px);
    const enR2 = cortarPorLongitudPantalla(borde, g.radioTramo2Px);
    assert.deepEqual(ancho[0], enR1[enR1.length - 1]);
    assert.deepEqual(ancho[ancho.length - 1], enR2[enR2.length - 1]);
  }
});

test("borde del mundo: el abanico que sale por el lateral se recorta al encuadre y el tramo ancho queda cerrado allí", () => {
  const g = geometriaTrayectoria({ anchoCss: 1180, altoCss: 820, armaId: "canon" });
  const cam = camara(1, 1, 0, 0);
  const abanico = calcularAbanicoPrevisualizacion(
    { ...mundo, origenX: 2370, origenY: 1299, anguloGrados: 10, potencia: 100, longitudMundoMax: Math.ceil(g.radioTramo2Px * 1.05) },
    g.semiapertura1,
    g.semiapertura2,
  );
  const fin = abanico.centro[abanico.centro.length - 1];
  assert.equal(fin.x, 2400 + MARGEN_SALIDA_U);
  for (const p of abanico.centro) assert.ok(p.x <= 2400 + MARGEN_SALIDA_U);
  // Del cañón al borde ampliado hay ~55 px, menos que r1 (147,5 px).
  const centro = cam.aPantalla(abanico.centro);
  assert.ok(longitudDeArco(centro) < g.radioTramo1Px);
  assert.deepEqual(cortarPorLongitudPantalla(centro, g.radioTramo2Px), centro);
  const ancho = tramoEntre(centro, g.radioTramo1Px, g.radioTramo2Px);
  assert.equal(ancho.length, 2);
  assert.deepEqual(ancho[0], ancho[1]);
  assert.equal(ancho[0].x, 2400 + MARGEN_SALIDA_U);
});
