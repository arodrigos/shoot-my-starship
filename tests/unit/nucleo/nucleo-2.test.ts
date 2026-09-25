import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { crearPartidaInicial, jugarTurno } from "@/sim/partida/motor";
import type { EntradaDeTurno, EstadoPartida, FuenteDeTurno } from "@/sim/partida/tipos";

const MUNDO = { ancho: 1920, alto: 1080, gravedad: 1.0, deriva: -60, etiquetaDeriva: "prueba" };

// 20 entradas fijas, sin azar: es lo único que hace falta para comprobar
// que reanudar desde JSON produce el mismo estado que no interrumpir nunca.
// No importa si la partida termina antes del turno 20 -- las dos ramas
// terminan igual, porque son la misma secuencia de decisiones.
const GUION: EntradaDeTurno[] = Array.from({ length: 20 }, (_, i) => ({
  arma: "referencia",
  anguloGrados: 30 + (i % 7) * 9,
  potencia: 40 + (i % 5) * 12,
}));

function fuenteScriptada(indiceInicial: number): { fuente: FuenteDeTurno; indice: { actual: number } } {
  const indice = { actual: indiceInicial };
  const fuente: FuenteDeTurno = (estado) => {
    const entrada = GUION[indice.actual % GUION.length];
    indice.actual++;
    return { entrada, estado };
  };
  return { fuente, indice };
}

function jugarHastaNTurnos(estado: EstadoPartida, fuentes: readonly [FuenteDeTurno, FuenteDeTurno], n: number): EstadoPartida {
  let actual = estado;
  for (let i = 0; i < n; i++) {
    if (actual.resultado.tipo !== "en-curso") {
      break;
    }
    actual = jugarTurno(actual, fuentes).estado;
  }
  return actual;
}

function hashDeEstado(estado: EstadoPartida): string {
  return createHash("sha256").update(JSON.stringify(estado)).digest("hex");
}

test("nucleo-2: serializar a mitad de partida y reanudar en un objeto nuevo da el mismo estado final que no interrumpir", () => {
  const { fuente: fuenteA0 } = fuenteScriptada(0);
  const { fuente: fuenteA1 } = fuenteScriptada(0);
  const inicialA = crearPartidaInicial(MUNDO, 200, 1720, 13579);
  const finalIninterrumpido = jugarHastaNTurnos(inicialA, [fuenteA0, fuenteA1], 20);

  const { fuente: fuenteB0, indice: indiceB0 } = fuenteScriptada(0);
  const { fuente: fuenteB1, indice: indiceB1 } = fuenteScriptada(0);
  const inicialB = crearPartidaInicial(MUNDO, 200, 1720, 13579);
  const trasDiezTurnos = jugarHastaNTurnos(inicialB, [fuenteB0, fuenteB1], 10);

  // JSON.stringify + JSON.parse simula guardar y cargar en un proceso
  // nuevo: ningún puntero a objeto de render, ninguna función, ninguna
  // referencia viva sobrevive a esto -- si algo de eso hubiera en el
  // estado, esta línea o bien fallaría o perdería datos en silencio.
  const serializado = JSON.stringify(trasDiezTurnos);
  const reanudado = JSON.parse(serializado) as EstadoPartida;

  // Cada fuente lleva su propio contador de turnos JUGADOS POR ELLA (no de
  // turnos totales: las dos naves se alternan, así que tras 10 turnos
  // totales cada una ha jugado solo la mitad). Se retoma cada una en el
  // punto exacto del guion en el que se había quedado.
  const { fuente: fuenteC0 } = fuenteScriptada(indiceB0.actual);
  const { fuente: fuenteC1 } = fuenteScriptada(indiceB1.actual);
  const finalReanudado = jugarHastaNTurnos(reanudado, [fuenteC0, fuenteC1], 10);

  assert.equal(hashDeEstado(finalReanudado), hashDeEstado(finalIninterrumpido));
});
