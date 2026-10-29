import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  limpiarLatenciasApuntado,
  registrarLatenciaApuntado,
  registrarLatenciaCamara,
  registrarLatenciaDisparo,
  registrarLatenciaRastro,
  registrarLatenciaReencuadre,
  registrarLatenciaRelojTurno,
  ultimasLatenciasApuntado,
} from "@/juego/rendimiento/latenciasApuntado";

describe("latenciasApuntado", () => {
  beforeEach(() => limpiarLatenciasApuntado());

  it("cada registro guarda su nombre, en orden de llegada", () => {
    registrarLatenciaApuntado(1);
    registrarLatenciaRastro(2);
    registrarLatenciaRelojTurno(3);
    registrarLatenciaDisparo(4);
    registrarLatenciaCamara("gesto-camara", 5);
    registrarLatenciaCamara("ver-todo", 6);
    registrarLatenciaReencuadre(7);
    assert.deepEqual(ultimasLatenciasApuntado(), [
      { nombre: "apuntado", ms: 1 },
      { nombre: "rastro", ms: 2 },
      { nombre: "reloj-turno", ms: 3 },
      { nombre: "disparo", ms: 4 },
      { nombre: "gesto-camara", ms: 5 },
      { nombre: "ver-todo", ms: 6 },
      { nombre: "reencuadre", ms: 7 },
    ]);
  });

  it("solo conserva las 60 últimas, de cualquier tipo", () => {
    for (let i = 0; i < 50; i++) registrarLatenciaApuntado(i);
    for (let i = 50; i < 70; i++) registrarLatenciaDisparo(i);
    const medidas = ultimasLatenciasApuntado();
    assert.equal(medidas.length, 60);
    assert.deepEqual(medidas[0], { nombre: "apuntado", ms: 10 });
    assert.deepEqual(medidas[59], { nombre: "disparo", ms: 69 });
  });

  it("la capacidad se respeta en todos los registros", () => {
    const registros = [
      registrarLatenciaApuntado,
      registrarLatenciaRastro,
      registrarLatenciaRelojTurno,
      registrarLatenciaDisparo,
      (ms: number) => registrarLatenciaCamara("ver-todo", ms),
      registrarLatenciaReencuadre,
    ];
    for (const registrar of registros) {
      limpiarLatenciasApuntado();
      for (let i = 0; i < 61; i++) registrar(i);
      const medidas = ultimasLatenciasApuntado();
      assert.equal(medidas.length, 60);
      assert.equal(medidas[0].ms, 1);
    }
  });

  it("la lectura es una copia: mutarla no toca el registro", () => {
    registrarLatenciaApuntado(9);
    const copia = ultimasLatenciasApuntado() as { nombre: string; ms: number }[];
    copia.pop();
    assert.equal(ultimasLatenciasApuntado().length, 1);
  });

  it("limpiar vacía el registro", () => {
    registrarLatenciaApuntado(9);
    limpiarLatenciasApuntado();
    assert.deepEqual(ultimasLatenciasApuntado(), []);
  });
});
