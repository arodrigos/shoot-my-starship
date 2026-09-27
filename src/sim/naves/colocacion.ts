import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { existeTiroViable } from "@/sim/balistica/rejilla";
import { esSolido } from "@/sim/terreno/mascara";
import { generarSistema, MARGEN_CORREDOR_SUPERIOR, type SistemaGenerado } from "@/sim/sistema/generador";
import type { EstadoNave, ParametrosMundo } from "@/sim/partida/tipos";

// Las tres holguras que separan "aleatorio" de "aleatorio jugable"
// (nav-2): ninguna nave incrustada en un sólido, ninguna nave pegada a la
// otra, ninguna nave pegada al borde del mundo.
export const HOLGURA_SOLIDO_NAVE_PX = 30;
export const SEPARACION_MINIMA_NAVES_PX = 350;
export const MARGEN_MUNDO_NAVE_PX = 40;

// impacto-naves (imp-8): el arma que se usa para comprobar viabilidad es
// siempre la de serie -- la misma que usaba nav-3, ahora sobre el oráculo
// real en vez de una tolerancia de proximidad.
const ARMA_BASE_ID = "pepinazo-cortesia";

// impacto-naves (imp-9): con casco real la viabilidad es más exigente y
// rechaza más disposiciones que antes -- de ahí los tres escalones
// declarados. MAX_INTENTOS_COLOCACION ya no es "o esto o excepción": es solo
// el primer escalón.
const MAX_INTENTOS_COLOCACION = 12;
const MAX_REGENERACIONES_SISTEMA = 3;
const MAX_INTENTOS_PUNTO = 500;
// impacto-naves (imp-10): colocarNaves llama a existeTiroViable hasta
// MAX_INTENTOS_COLOCACION veces por sistema -- sin presupuesto, cada llamada
// agotaría toda la rejilla (44 ángulos x 5 potencias) buscando un "no" que
// en la mayoría de los pares de puntos SÍ es que no hay tiro. Un presupuesto
// bajo basta: cuando SÍ hay tiro, la mayoría se encuentra dentro de las
// primeras decenas de combinaciones.
const PRESUPUESTO_INTENTOS_VIABILIDAD = 40;
// Offset primo para la "semilla derivada" de cada regeneración -- cualquier
// desplazamiento fijo sirve, un primo grande evita que dos semillas de las
// 500 de imp-9 colisionen entre sí al derivarse.
const OFFSET_SEMILLA_REGENERACION = 7919;

export type EscalonColocacion = "recolocacion" | "regeneracion" | "corredor";

function libreDeSolido(mascara: SistemaGenerado["mascara"], x: number, y: number, holgura: number): boolean {
  const cx = Math.round(x);
  const cy = Math.round(y);
  const r = Math.ceil(holgura);
  const holguraCuadrado = holgura * holgura;

  for (let dy = -r; dy <= r; dy++) {
    const restante = holguraCuadrado - dy * dy;
    if (restante < 0) continue;
    const dxMax = Math.floor(Math.sqrt(restante));
    for (let dx = -dxMax; dx <= dxMax; dx++) {
      if (esSolido(mascara, cx + dx, cy + dy)) return false;
    }
  }
  return true;
}

interface Punto {
  readonly x: number;
  readonly y: number;
}

interface PasoElegirPunto {
  readonly punto: Punto | null;
  readonly aleatorio: EstadoAleatorio;
}

function elegirPunto(
  mascara: SistemaGenerado["mascara"],
  ancho: number,
  alto: number,
  aleatorioInicial: EstadoAleatorio,
  evitar: readonly Punto[],
): PasoElegirPunto {
  let aleatorio = aleatorioInicial;

  for (let intento = 0; intento < MAX_INTENTOS_PUNTO; intento++) {
    const pasoX = siguienteAleatorio(aleatorio);
    aleatorio = pasoX.estado;
    const pasoY = siguienteAleatorio(aleatorio);
    aleatorio = pasoY.estado;

    const x = MARGEN_MUNDO_NAVE_PX + pasoX.valor * (ancho - 2 * MARGEN_MUNDO_NAVE_PX);
    const y = MARGEN_MUNDO_NAVE_PX + pasoY.valor * (alto - 2 * MARGEN_MUNDO_NAVE_PX);

    if (!libreDeSolido(mascara, x, y, HOLGURA_SOLIDO_NAVE_PX)) continue;
    if (evitar.some((otro) => Math.hypot(otro.x - x, otro.y - y) < SEPARACION_MINIMA_NAVES_PX)) continue;

    return { punto: { x, y }, aleatorio };
  }

  return { punto: null, aleatorio };
}

interface ResultadoIntento {
  readonly naves: readonly [EstadoNave, EstadoNave] | null;
  readonly aleatorio: EstadoAleatorio;
  readonly intentos: number;
}

// Hasta MAX_INTENTOS_COLOCACION pares de puntos sobre UN sistema, aceptando
// el primero cuyo disparo del arma base cause daño real (imp-8) -- nunca la
// antigua condición de proximidad. Devuelve el aleatorio avanzado incluso si
// falla, para que el escalón siguiente no repita exactamente los mismos
// puntos descartados.
function intentarColocarEnSistema(
  sistema: SistemaGenerado,
  mundo: ParametrosMundo,
  aleatorioInicial: EstadoAleatorio,
): ResultadoIntento {
  let aleatorio = aleatorioInicial;
  const armaBase = buscarArma(ARMA_BASE_ID);

  for (let intento = 1; intento <= MAX_INTENTOS_COLOCACION; intento++) {
    const pasoA = elegirPunto(sistema.mascara, mundo.ancho, mundo.alto, aleatorio, []);
    aleatorio = pasoA.aleatorio;
    if (!pasoA.punto) continue;

    const pasoB = elegirPunto(sistema.mascara, mundo.ancho, mundo.alto, aleatorio, [pasoA.punto]);
    aleatorio = pasoB.aleatorio;
    if (!pasoB.punto) continue;

    const viable = existeTiroViable({
      mascara: sistema.mascara,
      ancho: mundo.ancho,
      alto: mundo.alto,
      planetas: sistema.planetas,
      gravedad: mundo.gravedad,
      deriva: mundo.deriva,
      aleatorio,
      arma: armaBase,
      naves: [
        { id: 0, x: pasoA.punto.x, y: pasoA.punto.y },
        { id: 1, x: pasoB.punto.x, y: pasoB.punto.y },
      ],
      tiradorId: 0,
      objetivoId: 1,
      presupuestoIntentos: PRESUPUESTO_INTENTOS_VIABILIDAD,
    });
    if (!viable) continue;

    const naves: [EstadoNave, EstadoNave] = [
      { x: pasoA.punto.x, y: pasoA.punto.y, integridad: 100 },
      { x: pasoB.punto.x, y: pasoB.punto.y, integridad: 100 },
    ];
    return { naves, aleatorio, intentos: intento };
  }

  return { naves: null, aleatorio, intentos: MAX_INTENTOS_COLOCACION };
}

// Último recurso (imp-9): el corredor superior que generarSistema garantiza
// libre de sólido (MARGEN_CORREDOR_SUPERIOR, sis-3) -- sin sorteo, sin
// comprobación de viabilidad propia, porque es la red de seguridad que
// asegura que colocarNaves SIEMPRE termina. imp-9 mide por fuera, sobre 500
// semillas, que en la práctica también resulta viable. Exportada para que
// imp-9.test.ts pueda forzar este escalón a mano en vez de depender de
// construir un sistema patológico que agote los dos anteriores.
export function colocacionUltimoRecurso(mundo: ParametrosMundo): readonly [EstadoNave, EstadoNave] {
  const y = MARGEN_CORREDOR_SUPERIOR / 2;
  return [
    { x: MARGEN_MUNDO_NAVE_PX, y, integridad: 100 },
    { x: mundo.ancho - MARGEN_MUNDO_NAVE_PX, y, integridad: 100 },
  ];
}

export interface ResultadoColocacion {
  readonly sistema: SistemaGenerado;
  readonly naves: readonly [EstadoNave, EstadoNave];
  readonly aleatorio: EstadoAleatorio;
  readonly intentos: number;
  readonly escalon: EscalonColocacion;
}

// "Aleatorio jugable" (colocacion-naves, revisado por impacto-naves): coloca
// las dos naves flotando entre los planetas con las tres holguras de arriba
// Y con un tiro del arma base que cause daño real demostrado entre ellas
// (imp-8) -- nunca la antigua tolerancia de proximidad. Con el casco real la
// viabilidad rechaza más disposiciones, así que esto YA NO es "o esto o
// excepción": escala por recolocación, luego por regeneración del sistema
// con semilla derivada, y como red de seguridad final coloca ambas naves en
// el corredor que generarSistema garantiza libre (imp-9) -- colocarNaves
// SIEMPRE termina.
export function colocarNaves(semillaSistema: number, mundo: ParametrosMundo, aleatorioInicial: EstadoAleatorio): ResultadoColocacion {
  let sistema = generarSistema(semillaSistema, mundo.ancho, mundo.alto);
  let aleatorio = aleatorioInicial;

  let resultado = intentarColocarEnSistema(sistema, mundo, aleatorio);
  aleatorio = resultado.aleatorio;
  if (resultado.naves) {
    return { sistema, naves: resultado.naves, aleatorio, intentos: resultado.intentos, escalon: "recolocacion" };
  }

  for (let regeneracion = 1; regeneracion <= MAX_REGENERACIONES_SISTEMA; regeneracion++) {
    const semillaDerivada = semillaSistema + regeneracion * OFFSET_SEMILLA_REGENERACION;
    sistema = generarSistema(semillaDerivada, mundo.ancho, mundo.alto);
    resultado = intentarColocarEnSistema(sistema, mundo, aleatorio);
    aleatorio = resultado.aleatorio;
    if (resultado.naves) {
      return { sistema, naves: resultado.naves, aleatorio, intentos: resultado.intentos, escalon: "regeneracion" };
    }
  }

  return { sistema, naves: colocacionUltimoRecurso(mundo), aleatorio, intentos: 0, escalon: "corredor" };
}
