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
// Con 3 o 4 naves cada intento comprueba hasta N·(N-1) alcances y corre en el
// móvil al pulsar Jugar: se acota el esfuerzo (medido: 1,2 s por colocación de
// 3 naves con los topes de 2 naves) porque el escalón siguiente, sin exigir
// alcance, ya da una partida jugable.
const MAX_INTENTOS_COLOCACION_N_NAVES = 4;
const MAX_REGENERACIONES_SISTEMA_N_NAVES = 1;
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

// multi-setup-partida: con 3 o 4 naves, una separación dura de 350 px entre
// TODAS (más tiro viable en ambos sentidos con la vecina) no la cumplía ni
// una de cada veinte semillas y la colocación caía siempre al corredor, con
// las naves en fila bajo los botones. Decisión de Adrián: la separación es
// una preferencia fuerte, no una garantía -- 1/8 del lado menor del mundo --
// y basta con que cada nave tenga algún rival alcanzable.
const FRACCION_SEPARACION_PREFERIDA_N_NAVES = 1 / 8;
// Franja superior que TODOS los escalones de 3-4 naves dejan libre: ahí viven
// los botones del HUD (Histórico, Sacudida, Sonido) y una nave bajo ellos no
// se ve ni se puede distinguir. Sale de la geometría real a 360x640 (escala de
// mundo ~3,1 px por px CSS): los botones bajan hasta ~53 px CSS = 165 de mundo,
// más el radio del casco (22) y un respiro. Una fracción del alto no servía: la
// de 0,15 (173) dejaba el casco tocando el botón y solo se aplicaba en un
// escalón, así que recolocación y regeneración podían poner una nave en y≈18.
export const MARGEN_HUD_SUPERIOR_N_NAVES_PX = 190;

export type EscalonColocacion = "recolocacion" | "regeneracion" | "sin-viabilidad" | "corredor";

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
  separacionMinima: number = SEPARACION_MINIMA_NAVES_PX,
  margenSuperior: number = MARGEN_MUNDO_NAVE_PX,
): PasoElegirPunto {
  let aleatorio = aleatorioInicial;

  for (let intento = 0; intento < MAX_INTENTOS_PUNTO; intento++) {
    const pasoX = siguienteAleatorio(aleatorio);
    aleatorio = pasoX.estado;
    const pasoY = siguienteAleatorio(aleatorio);
    aleatorio = pasoY.estado;

    const x = MARGEN_MUNDO_NAVE_PX + pasoX.valor * (ancho - 2 * MARGEN_MUNDO_NAVE_PX);
    const y = margenSuperior + pasoY.valor * (alto - margenSuperior - MARGEN_MUNDO_NAVE_PX);

    if (!libreDeSolido(mascara, x, y, HOLGURA_SOLIDO_NAVE_PX)) continue;
    if (evitar.some((otro) => Math.hypot(otro.x - x, otro.y - y) < separacionMinima)) continue;

    return { punto: { x, y }, aleatorio };
  }

  return { punto: null, aleatorio };
}

interface ResultadoIntento {
  readonly naves: readonly EstadoNave[] | null;
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
  cantidad: number,
): ResultadoIntento {
  let aleatorio = aleatorioInicial;
  const armaBase = buscarArma(ARMA_BASE_ID);
  const separacion = separacionEntreNaves(mundo, cantidad);
  const margenSuperior = margenSuperiorNaves(cantidad);

  const maxIntentos = cantidad === 2 ? MAX_INTENTOS_COLOCACION : MAX_INTENTOS_COLOCACION_N_NAVES;
  for (let intento = 1; intento <= maxIntentos; intento++) {
    // multi-setup-partida: con dos naves el consumo de azar es el de siempre
    // (un punto libre, luego otro que evita al primero), así que ninguna
    // partida de 2 ya sembrada cambia de colocación.
    const puntos: Punto[] = [];
    for (let indice = 0; indice < cantidad; indice++) {
      const paso = elegirPunto(sistema.mascara, mundo.ancho, mundo.alto, aleatorio, puntos, separacion, margenSuperior);
      aleatorio = paso.aleatorio;
      if (!paso.punto) break;
      puntos.push(paso.punto);
    }
    if (puntos.length < cantidad) continue;

    const navesCandidatas = puntos.map((punto, id) => ({ id, x: punto.x, y: punto.y }));
    const parametrosViabilidadComunes = {
      mascara: sistema.mascara,
      ancho: mundo.ancho,
      alto: mundo.alto,
      planetas: sistema.planetas,
      gravedad: mundo.gravedad,
      deriva: mundo.deriva,
      aleatorio,
      arma: armaBase,
      naves: navesCandidatas,
      presupuestoIntentos: PRESUPUESTO_INTENTOS_VIABILIDAD,
    };
    // ia-punteria-6 (hallazgo real, world espacial 1121x1156 derivado del
    // viewport 360x640, semilla 20260926): esta comprobación solo exigía el
    // tiro de la nave 0 a la nave 1, nunca el inverso -- con gravedad
    // ambiental 0 (modo espacial, la curvatura depende solo de qué pozos
    // cruza CADA trayectoria) un tiro que conecta en un sentido no implica
    // que conecte en el otro. Confirmado por fuerza bruta (5 armas x 177
    // ángulos x 101 potencias, fuera de test): nave0->nave1 conectaba con
    // daño 14 y nave1->nave0 no tenía NINGÚN candidato en todo ese espacio,
    // así que ninguna IA que dispare desde la nave 1 podía ganar nunca esa
    // partida -- no es un fallo de búsqueda de busquedaMultipozo.ts, es una
    // colocación que nunca debió aceptarse como jugable. Exigir las dos
    // direcciones descarta esa colocación en el mismo escalón de
    // recolocación/regeneración que ya existía, sin tocar ninguna otra regla.
    // Con más de dos naves exigir tiro viable entre TODOS los pares, o entre
    // vecinas del anillo en ambos sentidos, dejaba sin colocar el 100 % de las
    // semillas medidas (3 y 4 naves, mundo 1121x1156): basta con que cada nave
    // tenga al menos UN rival al que poder dañar, que es lo que hace jugable
    // la partida.
    const todosViables =
      cantidad === 2
        ? existeTiroViable({ ...parametrosViabilidadComunes, tiradorId: 0, objetivoId: 1 }) &&
          existeTiroViable({ ...parametrosViabilidadComunes, tiradorId: 1, objetivoId: 0 })
        : puntos.every((_punto, id) =>
            puntos.some((_otro, otroId) => otroId !== id && existeTiroViable({ ...parametrosViabilidadComunes, tiradorId: id, objetivoId: otroId })),
          );
    if (!todosViables) continue;

    const naves: EstadoNave[] = puntos.map((punto) => ({ x: punto.x, y: punto.y, integridad: 100 }));
    return { naves, aleatorio, intentos: intento };
  }

  return { naves: null, aleatorio, intentos: maxIntentos };
}

// Con dos naves la colocación no cambia (las partidas sembradas ya jugadas
// conservan su sitio); la franja del HUD solo se exige con 3 o 4.
function margenSuperiorNaves(cantidad: number): number {
  return cantidad === 2 ? MARGEN_MUNDO_NAVE_PX : MARGEN_HUD_SUPERIOR_N_NAVES_PX;
}

function separacionEntreNaves(mundo: ParametrosMundo, cantidad: number): number {
  return cantidad === 2 ? SEPARACION_MINIMA_NAVES_PX : Math.min(mundo.ancho, mundo.alto) * FRACCION_SEPARACION_PREFERIDA_N_NAVES;
}

// Penúltimo escalón, solo con 3 o 4 naves: puntos libres de sólido, separados
// y fuera de la franja de botones, sin exigir tiro viable. Una nave sin
// rival alcanzable es una mala partida; tres en fila bajo los botones es una
// partida que no se puede jugar. Si ni así caben con la separación
// preferida, se relaja a la mitad (preferencia, no garantía).
function colocarSinViabilidad(sistema: SistemaGenerado, mundo: ParametrosMundo, aleatorioInicial: EstadoAleatorio, cantidad: number) {
  let aleatorio = aleatorioInicial;
  const margenSuperior = margenSuperiorNaves(cantidad);
  for (const separacion of [separacionEntreNaves(mundo, cantidad), separacionEntreNaves(mundo, cantidad) / 2]) {
    for (let intento = 0; intento < MAX_INTENTOS_COLOCACION; intento++) {
      const puntos: Punto[] = [];
      for (let indice = 0; indice < cantidad; indice++) {
        const paso = elegirPunto(sistema.mascara, mundo.ancho, mundo.alto, aleatorio, puntos, separacion, margenSuperior);
        aleatorio = paso.aleatorio;
        if (!paso.punto) break;
        puntos.push(paso.punto);
      }
      if (puntos.length === cantidad) {
        const naves: EstadoNave[] = puntos.map((punto) => ({ x: punto.x, y: punto.y, integridad: 100 }));
        return { naves, aleatorio };
      }
    }
  }
  return { naves: null, aleatorio };
}

// Último recurso (imp-9): el corredor superior que generarSistema garantiza
// libre de sólido (MARGEN_CORREDOR_SUPERIOR, sis-3) -- sin sorteo, sin
// comprobación de viabilidad propia, porque es la red de seguridad que
// asegura que colocarNaves SIEMPRE termina. imp-9 mide por fuera, sobre 500
// semillas, que en la práctica también resulta viable. Exportada para que
// imp-9.test.ts pueda forzar este escalón a mano en vez de depender de
// construir un sistema patológico que agote los dos anteriores.
export function colocacionUltimoRecurso(mundo: ParametrosMundo, cantidad = 2): readonly EstadoNave[] {
  const y = MARGEN_CORREDOR_SUPERIOR / 2;
  const recorrido = mundo.ancho - 2 * MARGEN_MUNDO_NAVE_PX;
  return Array.from({ length: cantidad }, (_nave, id) => ({
    x: MARGEN_MUNDO_NAVE_PX + (recorrido * id) / (cantidad - 1),
    y,
    integridad: 100,
  }));
}

export interface ResultadoColocacion {
  readonly sistema: SistemaGenerado;
  readonly naves: readonly EstadoNave[];
  readonly aleatorio: EstadoAleatorio;
  readonly intentos: number;
  readonly escalon: EscalonColocacion;
}

// "Aleatorio jugable" (colocacion-naves, revisado por impacto-naves): coloca
// de dos a cuatro naves flotando entre los planetas con las tres holguras de arriba
// Y con un tiro del arma base que cause daño real demostrado entre ellas
// (imp-8) -- nunca la antigua tolerancia de proximidad. Con el casco real la
// viabilidad rechaza más disposiciones, así que esto YA NO es "o esto o
// excepción": escala por recolocación, luego por regeneración del sistema
// con semilla derivada, y como red de seguridad final coloca ambas naves en
// el corredor que generarSistema garantiza libre (imp-9) -- colocarNaves
// SIEMPRE termina.
export function colocarNaves(
  semillaSistema: number,
  mundo: ParametrosMundo,
  aleatorioInicial: EstadoAleatorio,
  cantidad = 2,
): ResultadoColocacion {
  let sistema = generarSistema(semillaSistema, mundo.ancho, mundo.alto);
  let aleatorio = aleatorioInicial;

  let resultado = intentarColocarEnSistema(sistema, mundo, aleatorio, cantidad);
  aleatorio = resultado.aleatorio;
  if (resultado.naves) {
    return { sistema, naves: resultado.naves, aleatorio, intentos: resultado.intentos, escalon: "recolocacion" };
  }

  const maxRegeneraciones = cantidad === 2 ? MAX_REGENERACIONES_SISTEMA : MAX_REGENERACIONES_SISTEMA_N_NAVES;
  for (let regeneracion = 1; regeneracion <= maxRegeneraciones; regeneracion++) {
    const semillaDerivada = semillaSistema + regeneracion * OFFSET_SEMILLA_REGENERACION;
    sistema = generarSistema(semillaDerivada, mundo.ancho, mundo.alto);
    resultado = intentarColocarEnSistema(sistema, mundo, aleatorio, cantidad);
    aleatorio = resultado.aleatorio;
    if (resultado.naves) {
      return { sistema, naves: resultado.naves, aleatorio, intentos: resultado.intentos, escalon: "regeneracion" };
    }
  }

  if (cantidad > 2) {
    const libre = colocarSinViabilidad(sistema, mundo, aleatorio, cantidad);
    if (libre.naves) {
      return { sistema, naves: libre.naves, aleatorio: libre.aleatorio, intentos: 0, escalon: "sin-viabilidad" };
    }
    aleatorio = libre.aleatorio;
  }

  return { sistema, naves: colocacionUltimoRecurso(mundo, cantidad), aleatorio, intentos: 0, escalon: "corredor" };
}
