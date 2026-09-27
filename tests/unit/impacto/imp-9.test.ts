import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { existeTiroViable } from "@/sim/balistica/rejilla";
import { colocacionUltimoRecurso, colocarNaves, type EscalonColocacion } from "@/sim/naves/colocacion";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";
import type { ParametrosMundo } from "@/sim/partida/tipos";

const NUM_SEMILLAS = 500;
const MUNDO: ParametrosMundo = {
  ancho: MUNDO_ANCHO,
  alto: MUNDO_ALTO,
  gravedad: 1,
  deriva: 0,
  etiquetaDeriva: "ninguna",
};

// imp-9: con casco real la viabilidad rechaza más disposiciones que antes,
// así que colocarNaves escala en tres escalones (recolocación,
// regeneración, corredor de último recurso) en vez de lanzar una excepción.
// Este test comprueba, sobre las mismas 500 semillas que nav-3, que
// colocarNaves SIEMPRE termina en alguno de los tres, sin excepción.
test("imp-9: colocarNaves siempre termina, en alguno de los tres escalones, en 500 semillas", () => {
  const conteo: Record<EscalonColocacion, number> = { recolocacion: 0, regeneracion: 0, corredor: 0 };

  for (let semilla = 0; semilla < NUM_SEMILLAS; semilla++) {
    const resultado = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla));
    conteo[resultado.escalon]++;
  }

  const total = conteo.recolocacion + conteo.regeneracion + conteo.corredor;
  assert.equal(total, NUM_SEMILLAS, "cada una de las 500 semillas debe terminar en exactamente un escalón");
});

// imp-9: el corredor de último recurso es la red de seguridad final -- debe
// ser viable POR SÍ MISMO, sin depender de haber agotado los escalones
// anteriores sobre un sistema patológico. Se fuerza directamente con la
// función exportada para comprobarlo con independencia de qué tan difícil
// sea provocar el escalón en la práctica.
test("imp-9: la colocación de último recurso (corredor) satisface por sí misma existeTiroViable", () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  const [a, b] = colocacionUltimoRecurso(MUNDO);

  // El corredor está garantizado libre de sólido por generarSistema
  // (MARGEN_CORREDOR_SUPERIOR, sis-3); una máscara vacía basta para
  // comprobar la geometría del tiro sin generar un sistema real de por
  // medio -- lo que importa aquí es la disposición, no el terreno.
  const mascaraVacia = crearMascaraVacia(MUNDO.ancho, MUNDO.alto);

  const viable = existeTiroViable({
    mascara: mascaraVacia,
    ancho: MUNDO.ancho,
    alto: MUNDO.alto,
    gravedad: MUNDO.gravedad,
    deriva: MUNDO.deriva,
    aleatorio: crearEstadoAleatorio(1),
    arma: armaBase,
    naves: [
      { id: 0, x: a.x, y: a.y as number },
      { id: 1, x: b.x, y: b.y as number },
    ],
    tiradorId: 0,
    objetivoId: 1,
  });

  assert.ok(viable, "el corredor de último recurso debe tener un tiro real y viable entre sus dos puntos");
});
