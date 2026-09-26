import { test } from "node:test";
import assert from "node:assert/strict";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { detenerseEnSuelo } from "@/sim/armas/resolver";
import { crearRastreadorImpactoNaves, RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";

const ANCHO = 2000;
const ALTO = 1000;
// Espacio abierto detrás de la nave objetivo (máscara vacía, sin sólido
// alguno hasta el borde del mundo): la única forma de que "sin nave" y "con
// nave" terminen en sitios muy distintos es que el vacío se extienda de
// verdad más allá de donde estaba la nave.
const mascara = crearMascaraVacia(ANCHO, ALTO);
const detenerse = detenerseEnSuelo(mascara, ANCHO, ALTO);

test("imp-1: una nave viva detiene el proyectil en su casco e identifica quién lo detuvo; sin ella, sigue de largo", () => {
  const origen = { x: 200, y: 500 };
  const objetivo = { id: 1 as const, x: 1200, y: 500 };
  // Recta pura (sin gravedad ni deriva) para que el punto de corte con el
  // casco sea previsible: pasa exactamente por el centro del círculo.
  const inicial = crearProyectil(origen.x, origen.y, 3000, 0);

  const rastreadorConNave = crearRastreadorImpactoNaves([{ id: 0, ...origen }, objetivo], 0);
  const conNave = simularVuelo(inicial, 0, 0, detenerse, { rastreadorNaves: rastreadorConNave });

  assert.notEqual(conNave.impactoNave, null, "el trazado debe terminar en la nave, no seguir de largo");
  assert.equal(conNave.impactoNave?.nave, 1, "el impacto debe identificar a la nave que lo ha detenido");
  assert.ok(
    Math.hypot(conNave.proyectil.x - objetivo.x, conNave.proyectil.y - objetivo.y) <= RADIO_CASCO_NAVE_PX + 1e-6,
    "el punto de detonación debe caer sobre el casco, no más allá",
  );

  // Mismo disparo, misma máscara, con la nave retirada del sistema.
  const rastreadorSinNave = crearRastreadorImpactoNaves([{ id: 0, ...origen }], 0);
  const sinNave = simularVuelo(inicial, 0, 0, detenerse, { rastreadorNaves: rastreadorSinNave });

  assert.equal(sinNave.impactoNave, null, "sin la nave, nada debe detener el vuelo antes del borde del mundo");
  assert.ok(
    Math.hypot(sinNave.proyectil.x - conNave.proyectil.x, sinNave.proyectil.y - conNave.proyectil.y) > 100,
    "el punto de parada sin la nave debe quedar a más de 100px del impacto original",
  );
});
