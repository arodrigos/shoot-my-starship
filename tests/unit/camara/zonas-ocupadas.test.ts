import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  engancharToquesHud,
  exponerDepuracionZonas,
  medirZona,
  observarZona,
  obtenerNavesCss,
  obtenerZonas,
  publicarNavesCss,
  publicarZona,
  suscribirNaves,
  suscribirZonas,
  tomarMarcaToque,
} from "@/juego/camara/zonasOcupadas";

// El módulo no toca window al cargarse: basta con fijar los globales antes de
// llamar a sus funciones.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.Element = dom.window.Element;
g.MutationObserver = dom.window.MutationObserver;

// jsdom no maqueta: getBoundingClientRect siempre da ceros. Cada elemento de
// prueba lleva su rectángulo fijado a mano.
type Caja = { left: number; top: number; width: number; height: number };
function conCaja<T extends { getBoundingClientRect: () => unknown }>(el: T, c: Caja): T {
  el.getBoundingClientRect = () => ({ ...c, right: c.left + c.width, bottom: c.top + c.height, x: c.left, y: c.top });
  return el;
}

// ResizeObserver de mentira: jsdom no lo trae, y así se ve qué se observa.
class ObservadorTamanoFalso {
  static ultimo: ObservadorTamanoFalso | null = null;
  readonly observados: unknown[] = [];
  desconectado = false;
  constructor(readonly retrollamada: () => void) {
    ObservadorTamanoFalso.ultimo = this;
  }
  observe(el: unknown): void {
    this.observados.push(el);
  }
  disconnect(): void {
    this.desconectado = true;
  }
}


const esperarMutaciones = () => new Promise((resolver) => setTimeout(resolver, 0));

afterEach(() => {
  for (const id of ["consola", "ajustes", "rendimiento"] as const) publicarZona(id, null);
  delete g.ResizeObserver;
  dom.window.document.body.innerHTML = "";
});

describe("publicarZona", () => {
  it("publica, sustituye y retira zonas, y solo avisa si algo cambia", () => {
    let avisos = 0;
    const baja = suscribirZonas(() => avisos++);
    try {
      publicarZona("consola", { x: 0, y: 500, ancho: 800, alto: 100, visible: true });
      publicarZona("consola", { x: 0, y: 500, ancho: 800, alto: 100, visible: true });
      assert.equal(avisos, 1, "la misma zona otra vez no avisa");
      publicarZona("consola", { x: 0, y: 500, ancho: 800, alto: 100, visible: false });
      assert.equal(avisos, 2, "cambiar solo la visibilidad sí avisa");
      publicarZona("ajustes", { x: 760, y: 0, ancho: 40, alto: 40, visible: true });
      assert.deepEqual(obtenerZonas().map((z) => z.id), ["consola", "ajustes"]);
      assert.equal(obtenerZonas()[0].visible, false);
      publicarZona("ajustes", null);
      publicarZona("ajustes", null);
      assert.equal(avisos, 4, "retirar una zona que ya no está no avisa");
      assert.deepEqual(obtenerZonas().map((z) => z.id), ["consola"]);
    } finally {
      baja();
    }
  });

  it("la instantánea es estable entre avisos", () => {
    publicarZona("rendimiento", { x: 1, y: 2, ancho: 3, alto: 4, visible: true });
    const a = obtenerZonas();
    assert.equal(obtenerZonas(), a);
    publicarZona("rendimiento", { x: 1, y: 2, ancho: 3, alto: 4, visible: true });
    assert.equal(obtenerZonas(), a);
  });
});

describe("medirZona", () => {
  it("une el rectángulo del elemento con el de sus extras marcados", () => {
    const raiz = conCaja(dom.window.document.createElement("div"), { left: 100, top: 400, width: 300, height: 100 });
    const fila = conCaja(dom.window.document.createElement("div"), { left: 80, top: 360, width: 50, height: 40 });
    fila.setAttribute("data-zona-extra", "");
    const lejos = conCaja(dom.window.document.createElement("div"), { left: 380, top: 450, width: 60, height: 80 });
    lejos.setAttribute("data-zona-extra", "");
    const sinMarca = conCaja(dom.window.document.createElement("div"), { left: 0, top: 0, width: 999, height: 999 });
    raiz.append(fila, lejos, sinMarca);
    assert.deepEqual(medirZona(raiz), { x: 80, y: 360, ancho: 440 - 80, alto: 530 - 360 });
  });

  it("un extra vacío (ancho o alto 0) no ensancha la zona", () => {
    const raiz = conCaja(dom.window.document.createElement("div"), { left: 100, top: 400, width: 300, height: 100 });
    const vacia = conCaja(dom.window.document.createElement("div"), { left: 0, top: 380, width: 1000, height: 0 });
    vacia.setAttribute("data-zona-extra", "");
    raiz.append(vacia);
    assert.deepEqual(medirZona(raiz), { x: 100, y: 400, ancho: 300, alto: 100 });
  });
});

describe("observarZona", () => {
  it("publica al empezar, vuelve a medir con resize y retira la zona al darse de baja", () => {
    const raiz = conCaja(dom.window.document.createElement("div"), { left: 0, top: 500, width: 800, height: 100 });
    let visible = true;
    const baja = observarZona("consola", raiz, () => visible);
    assert.deepEqual(obtenerZonas(), [{ id: "consola", x: 0, y: 500, ancho: 800, alto: 100, visible: true }]);
    conCaja(raiz, { left: 0, top: 450, width: 800, height: 150 });
    visible = false;
    dom.window.dispatchEvent(new dom.window.Event("resize"));
    assert.deepEqual(obtenerZonas(), [{ id: "consola", x: 0, y: 450, ancho: 800, alto: 150, visible: false }]);
    conCaja(raiz, { left: 0, top: 400, width: 800, height: 200 });
    dom.window.dispatchEvent(new dom.window.Event("orientationchange"));
    assert.equal(obtenerZonas()[0].y, 400);
    baja();
    assert.deepEqual(obtenerZonas(), []);
    dom.window.dispatchEvent(new dom.window.Event("resize"));
    assert.deepEqual(obtenerZonas(), [], "tras la baja ya no escucha");
  });

  it("con ResizeObserver observa la raíz y los extras, y los extras nuevos al aparecer", async () => {
    g.ResizeObserver = ObservadorTamanoFalso;
    const raiz = conCaja(dom.window.document.createElement("div"), { left: 0, top: 500, width: 800, height: 100 });
    const extra = conCaja(dom.window.document.createElement("div"), { left: 0, top: 480, width: 100, height: 20 });
    extra.setAttribute("data-zona-extra", "");
    raiz.append(extra);
    dom.window.document.body.append(raiz);
    const baja = observarZona("consola", raiz, () => true);
    const observador = ObservadorTamanoFalso.ultimo!;
    assert.deepEqual(observador.observados, [raiz, extra]);

    const nuevo = conCaja(dom.window.document.createElement("div"), { left: 0, top: 300, width: 100, height: 20 });
    nuevo.setAttribute("data-zona-extra", "");
    raiz.append(nuevo);
    await esperarMutaciones();
    assert.deepEqual(observador.observados, [raiz, extra, nuevo], "el extra nuevo se observa una sola vez");
    assert.equal(obtenerZonas()[0].y, 300, "la mutación vuelve a medir");

    conCaja(raiz, { left: 0, top: 500, width: 900, height: 100 });
    observador.retrollamada();
    assert.equal(obtenerZonas()[0].ancho, 900);

    baja();
    assert.equal(observador.desconectado, true);
  });
});

describe("depuración y toques del HUD", () => {
  it("exponerDepuracionZonas publica copias y la baja lo retira", () => {
    const datos = { zonas: [], libre: { x: 0, y: 0, ancho: 10, alto: 10 }, objetivos: [], valido: true, zoom: 1, modo: "auto" as const, motivo: null, reencuadres: 0 };
    const baja = exponerDepuracionZonas(() => datos);
    const copia = dom.window.__debug.zonasCamara();
    assert.deepEqual(copia, datos);
    assert.notEqual(copia, datos);
    copia.libre.ancho = 99;
    assert.equal(datos.libre.ancho, 10);
    baja();
    assert.equal(dom.window.__debug.zonasCamara, undefined);
  });

  it("solo los clics dentro de [data-zona-hud] dejan marca, y la marca se consume", () => {
    engancharToquesHud();
    engancharToquesHud();
    dom.window.document.body.innerHTML = '<div data-zona-hud><button id="dentro"></button></div><button id="fuera"></button>';
    assert.equal(tomarMarcaToque(), null);
    dom.window.document.getElementById("fuera").click();
    assert.equal(tomarMarcaToque(), null);
    dom.window.document.getElementById("dentro").click();
    const marca = tomarMarcaToque();
    assert.match(marca ?? "", /^zona-toque-\d+$/);
    assert.equal(performance.getEntriesByName(marca!).length, 1, "un único oyente aunque se enganche dos veces");
    assert.equal(tomarMarcaToque(), null);
  });
});

describe("publicarNavesCss", () => {
  it("no avisa si los rectángulos coinciden al redondear y guarda una copia", () => {
    let avisos = 0;
    const baja = suscribirNaves(() => avisos++);
    try {
      const naves = [{ x: 10.2, y: 20.4, ancho: 30, alto: 40 }];
      publicarNavesCss(naves);
      assert.equal(avisos, 1);
      publicarNavesCss([{ x: 9.8, y: 20.1, ancho: 30.3, alto: 39.6 }]);
      assert.equal(avisos, 1, "medio píxel no es un cambio");
      naves[0].x = 500;
      assert.equal(obtenerNavesCss()[0].x, 10.2, "lo publicado no se puede mutar desde fuera");
      publicarNavesCss([{ x: 12, y: 20, ancho: 30, alto: 40 }]);
      assert.equal(avisos, 2);
      publicarNavesCss([{ x: 12, y: 20, ancho: 30, alto: 40 }, { x: 0, y: 0, ancho: 1, alto: 1 }]);
      assert.equal(avisos, 3, "otra cantidad de naves siempre avisa");
      publicarNavesCss([]);
      assert.deepEqual(obtenerNavesCss(), []);
    } finally {
      baja();
    }
  });
});
