import { test } from "node:test";
import assert from "node:assert/strict";
import { fijarPotenciaDesdeFraccion, obtenerEstadoControl, reiniciarControl } from "@/juego/control/store";

// #753: el aviso de precisión habla de «tanta potencia»; al bajarla ya no aplica.
test("el aviso de dispersión aparece al cruzar el umbral y se retira al bajar de él", () => {
  reiniciarControl();
  fijarPotenciaDesdeFraccion(0.2);
  assert.equal(obtenerEstadoControl().ayudaDispersionVisible, false);
  fijarPotenciaDesdeFraccion(0.99);
  assert.equal(obtenerEstadoControl().ayudaDispersionVisible, true);
  fijarPotenciaDesdeFraccion(0.9);
  assert.equal(obtenerEstadoControl().ayudaDispersionVisible, true, "sigue siendo potencia alta");
  fijarPotenciaDesdeFraccion(0.3);
  assert.equal(obtenerEstadoControl().ayudaDispersionVisible, false);
  fijarPotenciaDesdeFraccion(0.99);
  assert.equal(obtenerEstadoControl().ayudaDispersionVisible, false, "una vez por partida");
});
