import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fijarCopiaMedicion,
  fijarTramoMedicion,
  iniciarPartidaMedicion,
  registrarImpactoMedicion,
  suscribirInicioMedicion,
  terminarMedicion,
} from "../../../src/juego/control/medicionStore";

// Cada remonte del lienzo destruye la escena en la que corre el guion: el
// puente solo puede avisar una vez por medición.
test("el recorrido completo provoca exactamente un remonte", () => {
  let remontes = 0;
  const baja = suscribirInicioMedicion(() => remontes++);
  iniciarPartidaMedicion(null);
  for (let i = 1; i <= 5; i++) fijarTramoMedicion(i, "reposo");
  registrarImpactoMedicion("pepinazo", { x: 1, y: 2 });
  fijarCopiaMedicion("copiada");
  assert.equal(remontes, 1);
  terminarMedicion({ estado: "terminada", texto: "x", valida: true });
  fijarCopiaMedicion("fallida");
  assert.equal(remontes, 1);
  baja();
});

test("una segunda medición tras terminar vuelve a remontar una vez", () => {
  let remontes = 0;
  const baja = suscribirInicioMedicion(() => remontes++);
  iniciarPartidaMedicion(null);
  assert.equal(remontes, 1);
  baja();
});
