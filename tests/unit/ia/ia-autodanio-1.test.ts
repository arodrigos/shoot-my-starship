import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { buscarArma } from "@/sim/armas/catalogo";
import { barridoRejilla, compararCandidatos, PESO_AUTODANIO, type CandidatoDisparo } from "@/sim/balistica/rejilla";
import { buscarSolucionRival } from "@/sim/ia/busquedaMultipozo";
import { resolverDisparo } from "@/sim/armas/resolver";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";

const ANCHO = 4000;
const ALTO = 4000;

test("ia-autodanio-1: PESO_AUTODANIO pondera el autodaño con peso >= 2", () => {
  assert.ok(PESO_AUTODANIO >= 2, `PESO_AUTODANIO debe ser >= 2, es ${PESO_AUTODANIO}`);
});

function candidato(danio: number, autodanioTotal: number): CandidatoDisparo {
  return { anguloGrados: 0, potencia: 0, danio, autodanioTotal, puntuacion: danio - PESO_AUTODANIO * autodanioTotal, pasosVuelo: 0 };
}

test("ia-autodanio-1: compararCandidatos nunca prefiere un candidato con autodaño frente a uno sin autodaño, aunque el primero haga más daño al objetivo", () => {
  const seguro = candidato(14, 0);
  const conAutodanio = candidato(16, 14);
  const ordenados = [conAutodanio, seguro].sort(compararCandidatos);
  assert.equal(ordenados[0], seguro, "el candidato sin autodaño debe quedar primero aunque haga menos daño bruto");
});

test("ia-autodanio-1: dentro del mismo grupo (ambos seguros, o ambos con autodaño), compararCandidatos ordena por puntuacion descendente", () => {
  const a = candidato(10, 0);
  const b = candidato(14, 0);
  assert.ok(compararCandidatos(b, a) < 0, "b (más daño, mismo grupo seguro) debe ir antes que a");

  // puntuacion(20,5) = 10 y puntuacion(14,2) = 10 empatarían de verdad --
  // probamos con valores que desempatan sin ambigüedad.
  const e = candidato(20, 8); // puntuacion 4
  const f = candidato(14, 2); // puntuacion 10
  assert.ok(compararCandidatos(f, e) < 0, "f debe ganar a e por puntuacion aunque e tenga más daño bruto, ambos con autodaño");
});

// Escenario real (no sintético) construido sobre el resolutor real: un
// planeta colocado para que un disparo recto (78°, 55%) vuelva sobre el
// propio casco del tirador y SIGA sumando daño al objetivo (están muy cerca
// entre sí) -- ese candidato hace más daño bruto (16) que cualquier
// candidato seguro (14), así que el sort antiguo (solo por danio) lo habría
// puesto primero. Encontrado por barrido exhaustivo sobre resolverDisparo,
// documentado para que no haya que volver a buscarlo a ciegas.
function mundoConAutodanioEnRejilla() {
  const naveX = 1500;
  const naveY = 1500;
  const objetivo = { x: naveX + 30, y: naveY - 10 };
  const mascara = crearMascaraVacia(ANCHO, ALTO);
  const arma = buscarArma("pepinazo-cortesia");
  const planetas: RegistroPlanetas = [{ id: 1, cx: naveX, cy: naveY + 235, radio: 50, densidad: 1_500_000, pixelesVivos: 20 }];
  return { naveX, naveY, objetivo, mascara, arma, planetas };
}

test("ia-autodanio-1: barridoRejilla nunca pone en cabeza un candidato con autodaño cuando existe uno sin autodaño con daño real al objetivo", () => {
  const { naveX, naveY, objetivo, mascara, arma, planetas } = mundoConAutodanioEnRejilla();

  const candidatos = barridoRejilla({
    mascara,
    ancho: ANCHO,
    alto: ALTO,
    planetas,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma,
    naves: [
      { id: 0, x: naveX, y: naveY },
      { id: 1, x: objetivo.x, y: objetivo.y },
    ],
    tiradorId: 0,
    objetivoId: 1,
  });

  assert.ok(candidatos.length > 0, "el barrido debe encontrar candidatos en este mundo");
  // Confirma que el escenario SÍ contiene un candidato con autodaño que hace
  // más daño bruto que el mejor candidato seguro -- si esto deja de ser
  // cierto, el test ya no prueba nada y hay que rehacer el mundo.
  const mejorSeguro = candidatos.find((c) => c.autodanioTotal === 0);
  const algunoConAutodanio = candidatos.find((c) => c.autodanioTotal > 0);
  assert.ok(mejorSeguro, "el mundo de prueba debe tener al menos un candidato seguro");
  assert.ok(algunoConAutodanio, "el mundo de prueba debe tener al menos un candidato con autodaño");
  assert.ok(
    algunoConAutodanio!.danio > mejorSeguro!.danio,
    "precondición del mundo de prueba: el candidato con autodaño debe hacer MÁS daño bruto que el mejor seguro",
  );

  assert.equal(candidatos[0].autodanioTotal, 0, "el candidato en cabeza de la rejilla debe ser siempre uno sin autodaño cuando existe");
});

test("ia-autodanio-1: buscarSolucionRival (rejilla + refinamiento) tampoco se deja arrastrar por un autodaño al afinar el ángulo", () => {
  const { naveX, naveY, objetivo, mascara, arma, planetas } = mundoConAutodanioEnRejilla();

  const solucion = buscarSolucionRival({
    mascara,
    ancho: ANCHO,
    alto: ALTO,
    planetas,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma,
    naves: [
      { id: 0, x: naveX, y: naveY },
      { id: 1, x: objetivo.x, y: objetivo.y },
    ],
    tiradorId: 0,
    objetivoId: 1,
  });

  assert.ok(solucion.danioObjetivo > 0, "debe encontrar un disparo con daño real");

  const verificacion = resolverDisparo({
    mascara,
    gravedad: 0,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma,
    origenX: naveX,
    origenY: naveY,
    anguloGrados: solucion.anguloGrados,
    potencia: solucion.potencia,
    objetivoX: objetivo.x,
    objetivoY: objetivo.y,
    ancho: ANCHO,
    alto: ALTO,
    planetas,
    naves: [
      { id: 0, x: naveX, y: naveY },
      { id: 1, x: objetivo.x, y: objetivo.y },
    ],
    tiradorId: 0,
  });
  assert.equal(verificacion.impactoPropio, null, "la solución final del rival no puede autoimpactarse si existía una alternativa segura");
});
