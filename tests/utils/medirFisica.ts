// gravedad-calibracion-3: el harness de medición de "tasa de perdidos" que
// usan tanto scripts/medir-fisica.ts (el informe que se publica) como el
// test de umbral -- misma convención que medirIA.ts y medirArmas.ts: una
// sola implementación, nunca dos lotes que puedan desincronizarse.
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { ANGULO_MAX_GRADOS, ANGULO_MIN_GRADOS } from "@/sim/balistica/rejilla";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO, type SistemaColocado } from "./loteMultipozo";

// El criterio pide "al menos 200 partidas sembradas": generarLoteDeSistemas
// coloca ambas naves con el mismo oráculo que usa el juego real
// (colocarNaves), así que cada semilla es un sistema que el juego podría
// producir de verdad, nunca un montaje de laboratorio.
export const NUM_PARTIDAS_MEDICION_FISICA = 200;

export const ESCENARIOS_MEDICION_FISICA: readonly SistemaColocado[] = generarLoteDeSistemas(
  NUM_PARTIDAS_MEDICION_FISICA,
  MUNDO_MULTIPOZO,
);

// Rejilla propia, más fina en potencia que la de la IA (rejilla.ts barre 5
// potencias porque busca UN buen candidato; aquí se quiere cubrir el rango
// de potencia entero, que es justo lo que gravedad-calibracion-2 recalibra)
// pero con el mismo paso de ángulo (PASO_ANGULO_GRUESO_GRADOS no se reusa a
// propósito: ese es el presupuesto de la IA buscando un tiro, no el de este
// arnés de medición, que no tiene ningún presupuesto de vuelos que
// respetar).
const PASO_ANGULO_MEDICION_GRADOS = 8;
const POTENCIAS_MEDICION = [0, 20, 40, 60, 80, 100];

export interface InformeFisica {
  readonly disparos: number;
  readonly perdidos: number;
  readonly tasaPerdidos: number;
  readonly maxPasosVuelo: number;
}

// Pura en función de los escenarios: misma entrada, mismo informe siempre,
// igual que medirPersonalidad e igual exigencia (gravedad-calibracion-3 no
// pide un test de determinismo propio, pero no cuesta nada mantener la
// misma disciplina que ia-autodanio-5 y armas-metrica-1).
export function medirFisica(escenarios: readonly SistemaColocado[] = ESCENARIOS_MEDICION_FISICA): InformeFisica {
  const arma = buscarArma("pepinazo-cortesia");
  let disparos = 0;
  let perdidos = 0;
  let maxPasosVuelo = 0;

  for (const escenario of escenarios) {
    for (let anguloGrados = ANGULO_MIN_GRADOS; anguloGrados <= ANGULO_MAX_GRADOS; anguloGrados += PASO_ANGULO_MEDICION_GRADOS) {
      for (const potencia of POTENCIAS_MEDICION) {
        const resultado = resolverDisparo({
          mascara: escenario.sistema.mascara,
          gravedad: MUNDO_MULTIPOZO.gravedad,
          deriva: MUNDO_MULTIPOZO.deriva,
          aleatorio: escenario.aleatorio,
          arma,
          origenX: escenario.naveA.x,
          origenY: escenario.naveA.y,
          anguloGrados,
          potencia,
          objetivoX: escenario.naveB.x,
          objetivoY: escenario.naveB.y,
          ancho: MUNDO_MULTIPOZO.ancho,
          alto: MUNDO_MULTIPOZO.alto,
          planetas: escenario.sistema.planetas,
        });
        disparos++;
        if (resultado.proyectilPerdido) perdidos++;
        maxPasosVuelo = Math.max(maxPasosVuelo, resultado.pasosVuelo);
      }
    }
  }

  return { disparos, perdidos, tasaPerdidos: perdidos / disparos, maxPasosVuelo };
}
