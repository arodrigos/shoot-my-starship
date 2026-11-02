import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { CAPACIDAD_FOTOGRAMAS, CAPACIDAD_INTERACCIONES, MedidorRespuesta } from "@/juego/rendimiento/medidorRespuesta";
import type { FotogramaLoaf } from "@/juego/rendimiento/trabajoApp";

// PerformanceObserver de mentira: Node no conoce «event» ni
// «long-animation-frame», así que sin sustituirlo el medidor nunca entraría
// por las ramas de Chromium. Cada instancia queda registrada para poder
// entregarle entradas a mano.
type Entrada = { startTime: number; duration: number; interactionId?: number; styleAndLayoutStart?: number; scripts?: unknown[] };

class ObservadorFalso {
  static supportedEntryTypes: readonly string[] = [];
  static instancias: ObservadorFalso[] = [];
  tipo: string | null = null;
  pendientes: Entrada[] = [];
  desconectado = false;
  constructor(readonly retrollamada: (lista: { getEntries(): Entrada[] }) => void) {
    ObservadorFalso.instancias.push(this);
  }
  observe(opciones: { type: string }): void {
    this.tipo = opciones.type;
  }
  disconnect(): void {
    this.desconectado = true;
  }
  takeRecords(): Entrada[] {
    const r = this.pendientes;
    this.pendientes = [];
    return r;
  }
  entregar(entradas: Entrada[]): void {
    this.retrollamada({ getEntries: () => entradas });
  }
  static de(tipo: string): ObservadorFalso {
    const o = ObservadorFalso.instancias.find((i) => i.tipo === tipo);
    assert.ok(o, `no hay observador de ${tipo}`);
    return o;
  }
}

const ORIGINAL = globalThis.PerformanceObserver;

function instalarObservador(tipos: readonly string[]): void {
  ObservadorFalso.supportedEntryTypes = tipos;
  ObservadorFalso.instancias = [];
  (globalThis as unknown as { PerformanceObserver: unknown }).PerformanceObserver = ObservadorFalso;
}

afterEach(() => {
  globalThis.PerformanceObserver = ORIGINAL;
});

// Ventana mínima: EventTarget de Node más un rAF que se dispara a mano. El
// setTimeout es el real, así que las interacciones se registran tras un tick.
function ventanaFalsa() {
  const frames: Array<() => void> = [];
  const objetivo = new EventTarget();
  const ventana = Object.assign(objetivo, {
    requestAnimationFrame: (cb: () => void) => frames.push(cb),
    setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
  });
  return {
    ventana: ventana as unknown as Window,
    pintar: () => frames.splice(0).forEach((cb) => cb()),
  };
}

// describirObjetivo pregunta `instanceof Element`, que Node no tiene. Los
// eventos siguen siendo los de Node porque el timeStamp de jsdom es de época
// (Date.now) y no casa con performance.now(); el objetivo se sustituye con un
// getter para que sea un elemento de jsdom.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
(globalThis as unknown as { Element: unknown }).Element = dom.window.Element;

class EventoSobre extends Event {
  constructor(
    tipo: string,
    private readonly elemento: unknown,
  ) {
    super(tipo);
  }
  override get target(): EventTarget | null {
    return this.elemento as EventTarget;
  }
}

function elemento(html: string): unknown {
  const contenedor = dom.window.document.createElement("div");
  contenedor.innerHTML = html;
  return contenedor.firstElementChild;
}

const esperar = () => new Promise((resolver) => setTimeout(resolver, 5));

function fotograma(inicio: number, fin: number, scripts: FotogramaLoaf["scripts"] = [], inicioEstiloMaquetacion = 0): FotogramaLoaf {
  return { inicio, fin, scripts, inicioEstiloMaquetacion };
}

function medidorConLoaf(): MedidorRespuesta {
  instalarObservador(["long-animation-frame"]);
  const m = new MedidorRespuesta();
  m.observar(ventanaFalsa().ventana);
  return m;
}

describe("MedidorRespuesta sin Long Animation Frames", () => {
  it("guarda como mucho CAPACIDAD_INTERACCIONES y el INP es el peor de las guardadas", () => {
    const m = new MedidorRespuesta();
    m.registrar({ tipo: "click", objetivo: "a", retrasoEntrada: 0, duracion: 9999 });
    for (let i = 0; i < CAPACIDAD_INTERACCIONES; i++) m.registrar({ tipo: "click", objetivo: "b", retrasoEntrada: 0, duracion: i });
    const i = m.instantanea();
    assert.equal(i.interacciones.length, CAPACIDAD_INTERACCIONES);
    assert.equal(i.interacciones[0].objetivo, "b");
    assert.equal(i.inp, CAPACIDAD_INTERACCIONES - 1);
  });

  it("el INP nativo manda si es peor que el propio, y se queda con el máximo", () => {
    const m = new MedidorRespuesta();
    m.registrar({ tipo: "click", objetivo: "a", retrasoEntrada: 0, duracion: 40 });
    m.registrarNativa(90);
    m.registrarNativa(60);
    assert.equal(m.instantanea().inp, 90);
  });

  it("sin ventana la interacción no tiene trabajoApp ni render; con ventana suma el render dentro", () => {
    const m = new MedidorRespuesta();
    m.marcarInicioRender(10);
    m.marcarFinRender(20);
    m.marcarInicioRender(30);
    m.marcarFinRender(50);
    m.registrar({ tipo: "click", objetivo: "a", retrasoEntrada: 0, duracion: 5 });
    m.registrar({ tipo: "click", objetivo: "b", retrasoEntrada: 0, duracion: 40, inicio: 15, fin: 40 });
    const [sin, con] = m.instantanea().interacciones;
    assert.equal(sin.trabajoApp, null);
    assert.equal(sin.renderLienzo, 0);
    assert.equal(con.trabajoApp, null, "sin LoAF el script es desconocido");
    assert.equal(con.renderLienzo, 5 + 10);
    assert.equal(m.hayLongAnimationFrames(), false);
  });

  it("un fin de render sin inicio se ignora y los renders se resumen en percentiles", () => {
    const m = new MedidorRespuesta();
    m.marcarFinRender(5);
    assert.deepEqual(m.instantanea().renderLienzoFrames, { p50: 0, p95: 0, max: 0 });
    for (const d of [2, 4, 6, 8, 100]) {
      m.marcarInicioRender(0);
      m.marcarFinRender(d);
    }
    const r = m.instantanea().renderLienzoFrames;
    assert.equal(r.max, 100);
    assert.ok(r.p50 >= 4 && r.p50 <= 6, `p50=${r.p50}`);
    assert.ok(r.p95 <= r.max && r.p95 >= r.p50);
  });

  it("los renders guardados no pasan de CAPACIDAD_FOTOGRAMAS", () => {
    const m = new MedidorRespuesta();
    for (let i = 0; i < CAPACIDAD_FOTOGRAMAS + 50; i++) {
      m.marcarInicioRender(i * 10);
      m.marcarFinRender(i * 10 + (i < 50 ? 9 : 1));
    }
    // Los 50 primeros (los de 9 ms) se han descartado.
    assert.equal(m.instantanea().renderLienzoFrames.max, 1);
  });

  it("trabajoEnVentana sin LoAF solo cronometra el render", () => {
    const m = new MedidorRespuesta();
    m.marcarInicioRender(0);
    m.marcarFinRender(30);
    assert.deepEqual(m.trabajoEnVentana({ inicio: 10, fin: 100 }), { scriptMs: null, renderPhaserMs: 20 });
  });

  it("hayEventTiming depende de que el navegador anuncie el tipo «event»", () => {
    instalarObservador(["mark"]);
    assert.equal(new MedidorRespuesta().hayEventTiming(), false);
    instalarObservador(["event", "mark"]);
    assert.equal(new MedidorRespuesta().hayEventTiming(), true);
  });
});

describe("MedidorRespuesta con Long Animation Frames", () => {
  it("una ventana sin ningún LoAF vale lo que midió el manejador", () => {
    const m = medidorConLoaf();
    assert.equal(m.hayLongAnimationFrames(), true);
    m.registrar({ tipo: "click", objetivo: "a", retrasoEntrada: 0, duracion: 30, inicio: 100, fin: 130, manejador: 12 });
    m.registrar({ tipo: "click", objetivo: "b", retrasoEntrada: 0, duracion: 30, inicio: 200, fin: 230 });
    const [a, b] = m.instantanea().interacciones;
    assert.equal(a.trabajoApp, 12);
    assert.equal(b.trabajoApp, 0);
    assert.equal(a.culpables, undefined);
  });

  it("con LoAF en la ventana descuenta el render y nombra los tres scripts más largos si pasa de 100 ms", () => {
    const m = medidorConLoaf();
    m.registrarFotogramaLoaf(
      fotograma(0, 400, [
        { inicio: 0, duracion: 50, origen: "a" },
        { inicio: 60, duracion: 120, origen: "b" },
        { inicio: 200, duracion: 80, origen: "c" },
        { inicio: 300, duracion: 10 },
      ]),
    );
    m.marcarInicioRender(60);
    m.marcarFinRender(80);
    m.registrar({ tipo: "click", objetivo: "x", retrasoEntrada: 0, duracion: 400, inicio: 0, fin: 400 });
    const [i] = m.instantanea().interacciones;
    assert.equal(i.renderLienzo, 20);
    assert.equal(i.trabajoApp, 50 + 120 + 80 + 10 - 20);
    assert.deepEqual(i.culpables, ["120ms b", "80ms c", "50ms a"]);
  });

  it("un trabajo de 100 ms o menos no lleva culpables", () => {
    const m = medidorConLoaf();
    m.registrarFotogramaLoaf(fotograma(0, 200, [{ inicio: 0, duracion: 100, origen: "a" }]));
    m.registrar({ tipo: "click", objetivo: "x", retrasoEntrada: 0, duracion: 200, inicio: 0, fin: 200 });
    const [i] = m.instantanea().interacciones;
    assert.equal(i.trabajoApp, 100);
    assert.equal(i.culpables, undefined);
  });

  it("los fotogramas guardados no pasan de CAPACIDAD_FOTOGRAMAS", () => {
    const m = medidorConLoaf();
    m.registrarFotogramaLoaf(fotograma(0, 10, [{ inicio: 0, duracion: 10, origen: "viejo" }]));
    for (let k = 0; k < CAPACIDAD_FOTOGRAMAS; k++) m.registrarFotogramaLoaf(fotograma(1000 + k, 1001 + k));
    m.registrar({ tipo: "click", objetivo: "x", retrasoEntrada: 0, duracion: 10, inicio: 0, fin: 10, manejador: 3 });
    // El fotograma viejo se descartó: la ventana ya no tiene LoAF.
    assert.equal(m.instantanea().interacciones[0].trabajoApp, 3);
  });

  it("trabajoEnVentana con LoAF da el script de la app sin el render", () => {
    const m = medidorConLoaf();
    m.registrarFotogramaLoaf(fotograma(0, 100, [{ inicio: 0, duracion: 60 }]));
    m.marcarInicioRender(0);
    m.marcarFinRender(20);
    assert.deepEqual(m.trabajoEnVentana({ inicio: 0, fin: 100 }), { scriptMs: 40, renderPhaserMs: 20 });
  });

  it("las entradas LoAF del observador se traducen a fotogramas con origen legible", () => {
    const m = medidorConLoaf();
    const loaf = ObservadorFalso.de("long-animation-frame");
    loaf.entregar([
      {
        startTime: 0,
        duration: 300,
        scripts: [{ startTime: 10, duration: 150, sourceFunctionName: "pulsar", sourceURL: "https://x/_next/static/chunks/app.js" }],
      },
    ]);
    // Las que siguen pendientes en el observador se absorben al pedir la instantánea.
    loaf.pendientes = [{ startTime: 0, duration: 300, scripts: [{ startTime: 200, duration: 110, invoker: "BUTTON.onclick" }] }];
    m.registrar({ tipo: "click", objetivo: "x", retrasoEntrada: 0, duracion: 300, inicio: 0, fin: 300 });
    const [i] = m.instantanea().interacciones;
    // El segundo script se recorta al final del fotograma (300): cuenta 100 ms
    // en el trabajo, pero el culpable se nombra con su duración entera.
    assert.equal(i.trabajoApp, 150 + 100);
    assert.deepEqual(i.culpables, ["150ms pulsar@app.js", "110ms BUTTON.onclick@"]);
  });

  it("una entrada LoAF sin scripts ni campos opcionales no rompe nada", () => {
    const m = medidorConLoaf();
    ObservadorFalso.de("long-animation-frame").entregar([{ startTime: 0, duration: 50, scripts: [{ startTime: 0, duration: 120 }] }, { startTime: 60, duration: 10 }]);
    m.registrar({ tipo: "click", objetivo: "x", retrasoEntrada: 0, duracion: 200, inicio: 0, fin: 200 });
    const [i] = m.instantanea().interacciones;
    assert.equal(i.trabajoApp, 120);
    assert.deepEqual(i.culpables, ["120ms ?@"]);
  });
});

describe("MedidorRespuesta.observar", () => {
  it("registra pointerdown, click y keydown tras el siguiente frame pintado, y la baja deja de escuchar", async () => {
    instalarObservador([]);
    const m = new MedidorRespuesta();
    const { ventana, pintar } = ventanaFalsa();
    const baja = m.observar(ventana);
    for (const tipo of ["pointerdown", "click", "keydown", "mousemove"]) ventana.dispatchEvent(new Event(tipo));
    assert.equal(m.instantanea().interacciones.length, 0, "nada hasta pintar el frame");
    pintar();
    await esperar();
    const lista = m.instantanea().interacciones;
    assert.deepEqual(lista.map((i) => i.tipo), ["pointerdown", "click", "keydown"]);
    for (const i of lista) {
      assert.equal(i.objetivo, "desconocido", "el objetivo no es un Element");
      assert.ok(i.retrasoEntrada >= 0 && i.duracion >= 0);
      assert.ok(i.inicio !== undefined && i.fin !== undefined && i.fin >= i.inicio);
    }
    baja();
    ventana.dispatchEvent(new Event("click"));
    pintar();
    await esperar();
    assert.equal(m.instantanea().interacciones.length, 3);
  });

  it("describe el objetivo por data-testid, aria-label o id, y si no por la etiqueta", async () => {
    instalarObservador([]);
    const m = new MedidorRespuesta();
    const { ventana, pintar } = ventanaFalsa();
    m.observar(ventana);
    for (const html of ['<button data-testid="disparar" aria-label="x" id="y"></button>', '<button aria-label="Ajustes" id="y"></button>', '<div id="consola"></div>', "<canvas></canvas>"]) {
      ventana.dispatchEvent(new EventoSobre("click", elemento(html)));
    }
    pintar();
    await esperar();
    assert.deepEqual(
      m.instantanea().interacciones.map((i) => i.objetivo),
      ["button[disparar]", "button[Ajustes]", "div[consola]", "canvas"],
    );
  });

  it("bloquearHilo retrasa solo el siguiente toque", async () => {
    instalarObservador([]);
    const m = new MedidorRespuesta();
    const { ventana, pintar } = ventanaFalsa();
    m.observar(ventana);
    m.bloquearHilo(30);
    ventana.dispatchEvent(new Event("click"));
    pintar();
    await esperar();
    ventana.dispatchEvent(new Event("click"));
    pintar();
    await esperar();
    const [primero] = m.instantanea().interacciones;
    assert.ok(primero.duracion >= 30, `duración ${primero.duracion}`);
    // El segundo no esperó: su ventana empieza después de que acabara la del primero.
    const segundo = m.instantanea().interacciones[1];
    assert.ok(segundo.inicio! >= primero.inicio! + 30);
  });

  it("con Event Timing solo cuenta las entradas que pertenecen a una interacción", () => {
    instalarObservador(["event"]);
    const m = new MedidorRespuesta();
    const baja = m.observar(ventanaFalsa().ventana);
    const evento = ObservadorFalso.de("event");
    evento.entregar([
      { startTime: 0, duration: 500 },
      { startTime: 0, duration: 80, interactionId: 7 },
      { startTime: 0, duration: 300, interactionId: 0 },
    ]);
    assert.equal(m.instantanea().inp, 80);
    assert.equal(m.hayLongAnimationFrames(), false);
    baja();
    assert.equal(evento.desconectado, true);
  });

  it("la baja desconecta también el observador de LoAF", () => {
    instalarObservador(["event", "long-animation-frame"]);
    const m = new MedidorRespuesta();
    const baja = m.observar(ventanaFalsa().ventana);
    baja();
    assert.equal(ObservadorFalso.de("long-animation-frame").desconectado, true);
  });
});
