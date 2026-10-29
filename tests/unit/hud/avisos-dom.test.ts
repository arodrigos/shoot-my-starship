import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { mostrarApuntandoIA, ocultarApuntandoIA } from "@/juego/hud/indicadorApuntandoIA";
import { mostrarCalculandoTurno, ocultarCalculandoTurno } from "@/juego/hud/indicadorCalculandoTurno";
import { VARIABLE_TOP_AVISOS_PWA, reservarFranjaAvisos } from "@/juego/pwa/franjaAvisos";
import { obtenerRobots, publicarRobots, suscribirRobots } from "@/juego/control/robotsStore";
import { obtenerObjetos, publicarObjetos, suscribirObjetos } from "@/juego/control/objetosStore";
import { obtenerFantasmas, publicarFantasmas, suscribirFantasmas } from "@/juego/control/fantasmasStore";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
const documento = dom.window.document as Document;

describe("indicadorApuntandoIA", () => {
  afterEach(() => ocultarApuntandoIA());

  it("una sola caja de estado, con el nombre como texto y nunca como HTML", () => {
    mostrarApuntandoIA("Chispa");
    mostrarApuntandoIA("<b>Bisagra</b>");
    const cajas = documento.querySelectorAll('[data-testid="apuntando-ia"]');
    assert.equal(cajas.length, 1);
    assert.equal(cajas[0].getAttribute("role"), "status");
    assert.equal(cajas[0].textContent, "<b>Bisagra</b> está apuntando…");
    assert.equal(cajas[0].querySelector("b"), null);
  });

  it("ocultar la quita y ocultar de nuevo no lanza", () => {
    mostrarApuntandoIA("Chispa");
    ocultarApuntandoIA();
    assert.equal(documento.querySelector('[data-testid="apuntando-ia"]'), null);
    assert.doesNotThrow(() => ocultarApuntandoIA());
  });
});

describe("indicadorCalculandoTurno", () => {
  afterEach(() => {
    ocultarCalculandoTurno();
    documento.querySelector('[data-testid="consola"]')?.remove();
  });

  it("sin consola visible va abajo y al centro, y no se duplica", () => {
    mostrarCalculandoTurno();
    mostrarCalculandoTurno();
    const cajas = documento.querySelectorAll<HTMLElement>('[data-testid="calculando-turno"]');
    assert.equal(cajas.length, 1);
    assert.equal(cajas[0].textContent, "Calculando el turno…");
    assert.equal(cajas[0].style.left, "50%");
    assert.equal(cajas[0].style.bottom, "12px");
  });

  it("con consola visible se pega a su borde superior, centrada", () => {
    const consola = documento.createElement("div");
    consola.setAttribute("data-testid", "consola");
    consola.getBoundingClientRect = () => ({ left: 100, top: 600, width: 200, height: 80 }) as DOMRect;
    documento.body.appendChild(consola);
    Object.defineProperty(dom.window, "innerHeight", { value: 700, configurable: true });
    mostrarCalculandoTurno();
    const caja = documento.querySelector<HTMLElement>('[data-testid="calculando-turno"]');
    assert.equal(caja?.style.left, "200px");
    assert.equal(caja?.style.bottom, "108px");
  });

  it("la distancia al borde inferior nunca baja de 8 px", () => {
    const consola = documento.createElement("div");
    consola.setAttribute("data-testid", "consola");
    consola.getBoundingClientRect = () => ({ left: 0, top: 800, width: 100, height: 50 }) as DOMRect;
    documento.body.appendChild(consola);
    Object.defineProperty(dom.window, "innerHeight", { value: 700, configurable: true });
    mostrarCalculandoTurno();
    assert.equal(documento.querySelector<HTMLElement>('[data-testid="calculando-turno"]')?.style.bottom, "8px");
  });

  it("una consola sin tamaño cuenta como no visible", () => {
    const consola = documento.createElement("div");
    consola.setAttribute("data-testid", "consola");
    consola.getBoundingClientRect = () => ({ left: 10, top: 10, width: 0, height: 0 }) as DOMRect;
    documento.body.appendChild(consola);
    mostrarCalculandoTurno();
    assert.equal(documento.querySelector<HTMLElement>('[data-testid="calculando-turno"]')?.style.left, "50%");
  });
});

describe("franjaAvisos", () => {
  it("reserva la franja en la variable CSS y la libera al soltar", () => {
    const soltar = reservarFranjaAvisos(56);
    assert.equal(documento.documentElement.style.getPropertyValue(VARIABLE_TOP_AVISOS_PWA), "56px");
    soltar();
    assert.equal(documento.documentElement.style.getPropertyValue(VARIABLE_TOP_AVISOS_PWA), "");
  });
});

describe("stores de leyendas del lienzo", () => {
  it("robots, objetos y fantasmas publican la lista entera y avisan", () => {
    let avisos = 0;
    const bajas = [suscribirRobots(() => avisos++), suscribirObjetos(() => avisos++), suscribirFantasmas(() => avisos++)];
    const robots = [{ dueno: 0, saltos: 1, maxSaltos: 3, texto: "1/3" }];
    const objetos = [{ id: 4, tipo: "corazon" as const, texto: "Corazón" }];
    const fantasmas = [{ nave: 1, texto: "Estaba aquí" }];
    publicarRobots(robots);
    publicarObjetos(objetos);
    publicarFantasmas(fantasmas);
    assert.equal(obtenerRobots(), robots);
    assert.equal(obtenerObjetos(), objetos);
    assert.equal(obtenerFantasmas(), fantasmas);
    assert.equal(avisos, 3);
    for (const baja of bajas) baja();
    publicarRobots([]);
    assert.equal(avisos, 3);
    assert.deepEqual(obtenerRobots(), []);
  });
});
