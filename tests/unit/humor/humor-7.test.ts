import { test } from "node:test";
import assert from "node:assert/strict";
import { generarParteDeGuerra, type EstadisticasPartida } from "@/sim/partida/parteDeGuerra";

// Los tres perfiles del criterio, literalmente: destruir más mundo que daño
// hecho, ganar tras un autoimpacto, ganar sin fallar ni un tiro.
const PERFIL_GEOLOGICO: EstadisticasPartida = {
  disparos: 5,
  fallos: 1,
  autoimpactos: 0,
  danioHechoAlEnemigo: 40,
  pixelesDestruidos: 3000,
};

const PERFIL_FUEGO_AMIGO: EstadisticasPartida = {
  disparos: 6,
  fallos: 1,
  autoimpactos: 1,
  danioHechoAlEnemigo: 90,
  pixelesDestruidos: 200,
};

const PERFIL_PUNTERIA_SOSPECHOSA: EstadisticasPartida = {
  disparos: 4,
  fallos: 0,
  autoimpactos: 0,
  danioHechoAlEnemigo: 100,
  pixelesDestruidos: 50,
};

test("humor-7: tres perfiles de estadística distintos conceden tres medallas distintas, cada una con texto no vacío", () => {
  const geologico = generarParteDeGuerra(PERFIL_GEOLOGICO);
  const fuegoAmigo = generarParteDeGuerra(PERFIL_FUEGO_AMIGO);
  const punteriaSospechosa = generarParteDeGuerra(PERFIL_PUNTERIA_SOSPECHOSA);

  assert.equal(geologico.medalla, "Mérito Geológico");
  assert.equal(fuegoAmigo.medalla, "Cruz del Fuego Amigo");
  assert.equal(punteriaSospechosa.medalla, "Mención de Puntería Sospechosa");

  const medallas = new Set([geologico.medalla, fuegoAmigo.medalla, punteriaSospechosa.medalla]);
  assert.equal(medallas.size, 3, "las tres medallas deberían ser distintas entre sí");

  for (const parte of [geologico, fuegoAmigo, punteriaSospechosa]) {
    assert.equal(parte.texto.length > 0, true, `${parte.medalla}: texto vacío`);
  }
});

test("humor-7: el texto deriva de las cifras reales, no es un remate fijo disfrazado", () => {
  const parte = generarParteDeGuerra(PERFIL_GEOLOGICO);
  assert.equal(parte.texto.includes(String(PERFIL_GEOLOGICO.pixelesDestruidos)), true, "el texto no menciona los píxeles destruidos reales");
  assert.equal(parte.texto.includes(String(PERFIL_GEOLOGICO.danioHechoAlEnemigo)), true, "el texto no menciona el daño real hecho al enemigo");
});

test("humor-7: sin ninguno de los tres perfiles, cae en la medalla genérica derivando también de cifras reales", () => {
  const generico: EstadisticasPartida = { disparos: 5, fallos: 2, autoimpactos: 0, danioHechoAlEnemigo: 100, pixelesDestruidos: 10 };
  const parte = generarParteDeGuerra(generico);
  assert.equal(parte.medalla, "Medalla al Mérito de Combate");
  assert.equal(parte.texto.includes(String(generico.disparos)), true);
  assert.equal(parte.texto.includes(String(generico.danioHechoAlEnemigo)), true);
});
