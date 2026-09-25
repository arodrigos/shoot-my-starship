import { test } from "node:test";
import assert from "node:assert/strict";
import { crearPartidaInicial, jugarPartida } from "@/sim/partida/motor";
import type { EntradaDeTurno, FuenteDeTurno } from "@/sim/partida/tipos";

const MUNDO = { ancho: 1920, alto: 1080, gravedad: 1.0, deriva: 0, etiquetaDeriva: "prueba" };
const LIMITE_TURNOS = 300;

// "Humano": en el juego real esta función espera un evento de UI; aquí
// simula la misma forma de interfaz con una cola fija de entradas. A
// jugarPartida no le importa de dónde viene la entrada, solo que la función
// tenga la forma FuenteDeTurno -- eso es justo lo que nucleo-6 comprueba.
function fuenteHumanoSimulado(cola: readonly EntradaDeTurno[]): FuenteDeTurno {
  let indice = 0;
  return (estado) => {
    const entrada = cola[indice % cola.length];
    indice++;
    return { entrada, estado };
  };
}

// "Máquina": decide en el momento a partir del estado en vez de leer una
// cola, como hará ia-personalidades más adelante. Ángulo y potencia caen a
// ~15px de la nave contraria dada la distancia entre 300 y 1620.
const fuenteMaquina: FuenteDeTurno = (estado) => ({
  entrada: { arma: "referencia", anguloGrados: estado.turno === 0 ? 45 : 135, potencia: 60 },
  estado,
});

function fuenteScriptada(guion: readonly EntradaDeTurno[]): FuenteDeTurno {
  let indice = 0;
  return (estado) => {
    const entrada = guion[indice % guion.length];
    indice++;
    return { entrada, estado };
  };
}

test("nucleo-6: FuenteDeTurno soporta humano-vs-máquina, máquina-vs-máquina y dos scriptadas sin tocar el núcleo", () => {
  // Ángulos que caen dentro del radio de impacto desde x=300 hacia x=1620.
  const colaHumano: EntradaDeTurno[] = [
    { arma: "referencia", anguloGrados: 50, potencia: 65 },
    { arma: "referencia", anguloGrados: 55, potencia: 60 },
  ];
  // Espejo de colaHumano (180 - ángulo) para disparar desde x=1620 hacia
  // x=300: el mismo guion no sirve para las dos naves porque no apuntan al
  // mismo sitio, no porque FuenteDeTurno lo exija.
  const colaHumanoEspejo: EntradaDeTurno[] = colaHumano.map((entrada) => ({
    ...entrada,
    anguloGrados: 180 - entrada.anguloGrados,
  }));

  const combinaciones: [string, [FuenteDeTurno, FuenteDeTurno]][] = [
    ["humano-vs-máquina", [fuenteHumanoSimulado(colaHumano), fuenteMaquina]],
    ["máquina-vs-máquina", [fuenteMaquina, fuenteMaquina]],
    ["dos scriptadas", [fuenteScriptada(colaHumano), fuenteScriptada(colaHumanoEspejo)]],
  ];

  for (const [nombre, fuentes] of combinaciones) {
    const inicial = crearPartidaInicial(MUNDO, 300, 1620, 4242);
    const { estado, agotada } = jugarPartida(inicial, fuentes, LIMITE_TURNOS);
    assert.equal(agotada, false, `${nombre}: la partida no convergió en ${LIMITE_TURNOS} turnos`);
    assert.equal(estado.resultado.tipo, "terminada", `${nombre}: no terminó con un ganador`);
  }
});
