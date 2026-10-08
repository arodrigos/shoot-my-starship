import { test } from "node:test";
import assert from "node:assert/strict";
import { ClienteSim, type TrabajadorLike } from "@/juego/motor/clienteSim";
import type { Peticion, Respuesta } from "@/juego/motor/protocolo";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { MedidorRespuesta } from "@/juego/rendimiento/medidorRespuesta";

const PREVIS = {
  tipo: "previsualizar",
  mascara: crearMascaraVacia(40, 40),
  gravedad: 1,
  deriva: 0,
  ancho: 40,
  alto: 40,
  tirador: 0,
  origenX: 10,
  origenY: 10,
  anguloGrados: 45,
  potencia: 50,
  armaId: "pepinazo-cortesia",
  aleatorio: crearEstadoAleatorio(1),
} as const;

// Un trabajador falso que guarda las peticiones y deja al test decidir en qué
// orden y si contesta.
function trabajadorManual() {
  const recibidas: Peticion[] = [];
  const t: TrabajadorLike & { responder(r: Respuesta): void } = {
    onmessage: null,
    onerror: null,
    postMessage: (p) => void recibidas.push(p),
    terminate: () => undefined,
    responder(r) {
      t.onmessage?.({ data: r } as MessageEvent<Respuesta>);
    },
  };
  return { t, recibidas };
}

const respuestaPrevis = (p: Peticion): Respuesta => ({
  tipo: "previsualizar",
  idPeticion: p.idPeticion,
  idPartida: p.idPartida,
  resultado: { banda: { centro: [], extremoMenor: [], extremoMayor: [], amplitudGrados: 0 }, duracionMs: 1 },
});

test("res-2: una respuesta antigua llega tarde y se descarta; la última se aplica", async () => {
  const { t, recibidas } = trabajadorManual();
  const cliente = new ClienteSim(() => t);
  assert.equal(cliente.modo, "trabajador");
  const primera = cliente.previsualizar(PREVIS);
  const segunda = cliente.previsualizar({ ...PREVIS, anguloGrados: 50 });
  t.responder(respuestaPrevis(recibidas[1]));
  t.responder(respuestaPrevis(recibidas[0]));
  assert.notEqual(await segunda, null);
  assert.equal(await primera, null);
  cliente.terminar();
});

test("res-2: una respuesta de la partida anterior se descarta", async () => {
  const { t, recibidas } = trabajadorManual();
  const cliente = new ClienteSim(() => t);
  const vieja = cliente.previsualizar(PREVIS);
  cliente.nuevaPartida();
  t.responder(respuestaPrevis(recibidas[0]));
  assert.equal(await vieja, null);
  cliente.terminar();
});

test("res-4: sin Worker, el cliente resuelve en línea con el mismo resultado", async () => {
  const cliente = new ClienteSim(null);
  assert.equal(cliente.modo, "en-linea");
  const resultado = await cliente.previsualizar(PREVIS);
  assert.ok(resultado && resultado.banda.centro.length > 0);
});

test("res-4: si crear el Worker lanza, el cliente cae a en-línea y lo registra", () => {
  const cliente = new ClienteSim(() => {
    throw new Error("sin módulos en este navegador");
  });
  assert.equal(cliente.modo, "en-linea");
  assert.match(cliente.motivoEnLinea ?? "", /sin módulos/);
});

test("res-4: si el Worker falla con una petición en vuelo, se resuelve en línea", async () => {
  const { t } = trabajadorManual();
  const cliente = new ClienteSim(() => t);
  const pendiente = cliente.previsualizar(PREVIS);
  t.onerror?.(new Event("error"));
  assert.equal(cliente.modo, "en-linea");
  const resultado = await pendiente;
  assert.ok(resultado && resultado.banda.centro.length > 0);
});

test("res-1: el medidor guarda la interacción y su peor duración es el INP", () => {
  const m = new MedidorRespuesta();
  m.registrar({ tipo: "click", objetivo: "button[a]", retrasoEntrada: 3, duracion: 40 });
  m.registrar({ tipo: "pointerdown", objetivo: "canvas", retrasoEntrada: 1, duracion: 120 });
  const i = m.instantanea();
  assert.equal(i.interacciones.length, 2);
  assert.equal(i.inp, 120);
});
