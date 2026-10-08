import { test } from "node:test";
import assert from "node:assert/strict";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { crearPartidaInicial } from "@/sim/partida/motor";
import { avanzar } from "@/sim/partida/avanzar";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";

const MUNDO: ParametrosMundo = { ancho: 2000, alto: 1000, gravedad: 0, deriva: 0, etiquetaDeriva: "Vacío" };

function escenario(integridadMuerta: number): EstadoPartida {
  const base = crearPartidaInicial(MUNDO, crearMascaraVacia(MUNDO.ancho, MUNDO.alto), [200, 1700, 1000], 5);
  // La tercera nave queda entre el tirador y el rival, justo en la
  // trayectoria: un tiro a 0° sale unos 38 u por encima del centro del tirador.
  const ys = [500, 462, 462];
  return { ...base, naves: base.naves.map((n, i) => ({ ...n, y: ys[i], integridad: i === 2 ? integridadMuerta : 100 })) };
}

// fan-2
test("fan-2: un tiro que cruza a una nave muerta no la golpea y llega a su destino", () => {
  const arma = CATALOGO_ARMAS.find((a) => a.efecto.tipo === "danio-y-autodanio") ?? CATALOGO_ARMAS[0];
  const entrada = { arma: arma.id, anguloGrados: 0, potencia: 100, objetivoId: 1 as const };
  const conMuerta = avanzar(escenario(0), entrada);
  const conViva = avanzar(escenario(100), entrada);

  const tocaATercera = (eventos: typeof conMuerta.eventos): boolean =>
    eventos.some((e) => ("objetivo" in e && e.objetivo === 2) || ("nave" in e && e.nave === 2));
  assert.equal(tocaATercera(conMuerta.eventos), false, "la nave muerta no recibe impacto");
  assert.equal(conMuerta.estado.naves[2].integridad, 0);
  // Control: la misma nave, viva, sí detiene el tiro; así el test prueba que
  // la muerta es transparente y no que el tiro nunca pasara por ahí.
  assert.equal(tocaATercera(conViva.eventos), true, "con la nave viva en medio, el tiro la golpea");
});
