import { test } from "node:test";
import assert from "node:assert/strict";
import { FACTOR_ATENUACION_VOZ, RAMPA_ATENUACION_S, crearBusEfectos } from "@/juego/audio/busEfectos";

function contextoFalso() {
  const conexiones: string[] = [];
  const rampas: { valor: number; fin: number }[] = [];
  const nodo = (nombre: string) => ({ nombre, connect: (a: { nombre: string }) => void conexiones.push(`${nombre}→${a.nombre}`) });
  const ganancia = { ...nodo("ganancia"), gain: { value: 1, cancelScheduledValues: () => {}, setValueAtTime: () => {}, linearRampToValueAtTime: (valor: number, fin: number) => rampas.push({ valor, fin }) } };
  const contexto = {
    currentTime: 5,
    destination: { nombre: "destino" },
    createGain: () => ganancia,
    createDynamicsCompressor: () => nodo("compresor"),
  };
  return { contexto: contexto as unknown as AudioContext, conexiones, rampas };
}

test("snd3-3: el bus encadena ganancia → compresor → destino", () => {
  const { contexto, conexiones } = contextoFalso();
  crearBusEfectos(contexto);
  assert.deepEqual(conexiones, ["ganancia→compresor", "compresor→destino"]);
});

test("snd3-3: atenuar rampa a 0,35 en 100 ms o menos y vuelve a 1", () => {
  const { contexto, rampas } = contextoFalso();
  const bus = crearBusEfectos(contexto);
  bus.atenuar(FACTOR_ATENUACION_VOZ);
  bus.atenuar(1);
  assert.equal(FACTOR_ATENUACION_VOZ, 0.35);
  assert.deepEqual(rampas.map((r) => r.valor), [0.35, 1]);
  assert.ok(rampas.every((r) => r.fin - 5 <= 0.1 + 1e-9));
  assert.ok(RAMPA_ATENUACION_S <= 0.1);
});
