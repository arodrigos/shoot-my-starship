import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { LA_CONTABLE } from "@/sim/ia/personalidades";
import { avanzar } from "@/sim/partida/avanzar";
import { crearPartidaInicial } from "@/sim/partida/motor";
import type { EstadoPartida, IdNave } from "@/sim/partida/tipos";
import { SOLIDO } from "@/sim/terreno/mascara";
import { crearMascaraPlana } from "../../utils/terrenoPlano";
import { INTEGRIDAD_MAXIMA } from "@/sim/naves/vida";

const MUNDO = { ancho: 1920, alto: 1080, gravedad: 1.0, deriva: 0, etiquetaDeriva: "nucleo-n-naves-dano-real" };
const ALTURA_SUELO = 900;

function partidaPlana(xNaves: readonly number[]): EstadoPartida {
  return crearPartidaInicial(MUNDO, crearMascaraPlana(MUNDO.ancho, MUNDO.alto, ALTURA_SUELO), xNaves, 7);
}

// Mismo disparo exacto contra la nave en `xBlanco`, repetido cambiando solo
// el objetivo DECLARADO: lo que se comprueba es que el daño no depende de él.
function dispararA(estado: EstadoPartida, xBlanco: number, objetivoId: IdNave) {
  // La última solución es la de tiro tenso (ángulo bajo): aterriza a pocos px
  // del blanco; la de tiro alto cae a ~90 px por el desvío de la dispersión.
  const soluciones = resolverSolucionesBalisticas(estado.naves[estado.turno].x, ALTURA_SUELO, xBlanco, ALTURA_SUELO, MUNDO.gravedad);
  const solucion = soluciones[soluciones.length - 1];
  assert.ok(solucion, "el escenario tiene que tener solución exacta");
  return avanzar(estado, {
    arma: "pepinazo-cortesia",
    anguloGrados: solucion.anguloGrados,
    potencia: solucion.potencia,
    objetivoId,
  });
}

test("nucleo-n-naves-2: el daño sale del punto de impacto real, no del objetivo declarado", () => {
  const estado = partidaPlana([200, 900, 1720]);
  const aNave2 = dispararA(estado, 1720, 2);
  const aNave2DeclarandoNave1 = dispararA(estado, 1720, 1);

  assert.ok(aNave2.estado.naves[2].integridad < INTEGRIDAD_MAXIMA, "acertar a la nave 2 le quita vida");
  assert.deepEqual(
    aNave2DeclarandoNave1.estado.naves.map((nave) => nave.integridad),
    aNave2.estado.naves.map((nave) => nave.integridad),
    "declarar otro objetivo no cambia quién pierde vida",
  );
  assert.equal(aNave2DeclarandoNave1.estado.naves[1].integridad, INTEGRIDAD_MAXIMA, "la nave 1, lejos del impacto, no recibe daño");
  assert.ok(aNave2DeclarandoNave1.eventos.some((e) => e.tipo === "danio-colateral" && e.nave === 2));
});

test("nucleo-n-naves-2: un disparo de área daña a las dos naves que alcanza, no solo a la declarada", () => {
  const estado = partidaPlana([200, 1700, 1740]);
  const { estado: tras } = dispararA(estado, 1720, 1);
  assert.ok(tras.naves[1].integridad < INTEGRIDAD_MAXIMA, "la declarada pierde vida");
  assert.ok(tras.naves[2].integridad < INTEGRIDAD_MAXIMA, "la de al lado, dentro del radio, también");
});

test("nucleo-n-naves-2: una tercera nave que cae en el turno cuenta para la eliminación y el último en pie", () => {
  const base = partidaPlana([200, 900, 1720]);
  const conNave2Herida: EstadoPartida = { ...base, naves: base.naves.map((n, id) => (id === 2 ? { ...n, integridad: 1 } : n)) };
  const enCurso = dispararA(conNave2Herida, 1720, 1);
  assert.equal(enCurso.estado.naves[2].integridad, 0);
  assert.equal(enCurso.estado.resultado.tipo, "en-curso", "quedan la 0 y la 1 vivas");
  assert.equal(enCurso.estado.turno, 1, "el turno salta a la siguiente viva");

  const conAmbasHeridas: EstadoPartida = { ...base, naves: base.naves.map((n, id) => (id === 0 ? n : { ...n, integridad: 1 })) };
  // Aquí el disparo se declara a la 1 pero cae en la 2: la 1 sigue entera salvo
  // que el radio la alcance, y con 820 px de separación no lo hace.
  const conUna = dispararA(conAmbasHeridas, 1720, 1);
  assert.equal(conUna.estado.naves[2].integridad, 0);
  assert.equal(conUna.estado.resultado.tipo, "en-curso");
  const finalDirecto: EstadoPartida = { ...base, naves: base.naves.map((n, id) => (id === 1 ? { ...n, integridad: 0 } : id === 2 ? { ...n, integridad: 1 } : n)) };
  const fin = dispararA(finalDirecto, 1720, 2);
  assert.deepEqual(fin.estado.resultado, { tipo: "terminada", ganador: 0 });
});

// Un muro macizo de suelo a techo tapa al rival más cercano: el más lejano,
// con línea de tiro, es el de mayor valor esperado.
function escenarioTapado(xNaves: readonly number[]): EstadoPartida {
  const mascara = crearMascaraPlana(MUNDO.ancho, MUNDO.alto, ALTURA_SUELO);
  for (let y = 0; y < ALTURA_SUELO; y++) {
    for (let x = 1100; x < 1160; x++) mascara.datos[y * MUNDO.ancho + x] = SOLIDO;
  }
  const inicial = crearPartidaInicial(MUNDO, mascara, xNaves, 11);
  return { ...inicial, turno: 1, naves: inicial.naves.map((nave) => ({ ...nave, y: ALTURA_SUELO - 20 })) };
}

test("nucleo-n-naves-5: con 3 naves la IA apunta al rival alcanzable aunque otro esté más cerca (tapado)", () => {
  const estado = escenarioTapado([400, 1000, 1200]);
  const { entrada } = crearFuenteIA(LA_CONTABLE)(estado);
  assert.equal(entrada.objetivoId, 0, "la nave 2 está a 200 px pero detrás del muro; la 0 a 600 px, despejada");
});

test("nucleo-n-naves-5: con 4 naves la IA apunta al único rival despejado", () => {
  const estado = escenarioTapado([400, 1000, 1200, 1800]);
  const { entrada } = crearFuenteIA(LA_CONTABLE)(estado);
  assert.equal(entrada.objetivoId, 0);
});

test("nucleo-n-naves-5: con 1 rival no se elige nada y el resultado es el de siempre", () => {
  const estado = escenarioTapado([400, 1000]);
  const { entrada } = crearFuenteIA(LA_CONTABLE)(estado);
  assert.equal(entrada.objetivoId, 0);
});
