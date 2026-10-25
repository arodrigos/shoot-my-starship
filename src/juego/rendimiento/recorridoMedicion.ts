// Guion de la partida de medición: se juega solo, por las mismas acciones del
// store que usan los botones («Disparar»), nunca con eventos sintéticos. Se
// carga con import() dinámico solo en esa partida, así que no pesa en el
// bundle de la partida normal.

import {
  fijarTramoMedicion,
  inpAlIniciarMedicion,
  medicionCancelada,
  obtenerMedicion,
  registrarImpactoMedicion,
  resolverCopia,
  terminarMedicion,
  type NombreTramoStore,
} from "@/juego/control/medicionStore";
import { fijarApuntadoDirecto, obtenerEstadoControl, seleccionarArma, seleccionarEquipo, solicitarDisparo } from "@/juego/control/store";
import type { MedidorFrames } from "@/juego/rendimiento/medidorFrames";
import type { MedidorRespuesta } from "@/juego/rendimiento/medidorRespuesta";
import {
  construirResumen,
  estadisticasTramo,
  formatearResumen,
  medianaDe,
  resumirNavegador,
  type EntradaResumen,
  type TramoMedido,
} from "@/juego/rendimiento/resumenMedicion";

export const CALENTAMIENTO_MS = 1000;
export const FRAMES_ENTRE_TRAMOS = 30;
export const TOPE_RECORRIDO_MS = 150_000;

// Solo para pruebas: `?tope-medicion=<segundos>` cambia el tope. El e2e de CI
// pinta el WebGL por software y no cabe en 90 s; con un tope corto se prueba
// además el corte por tiempo agotado.
function topeRecorridoMs(): number {
  const segundos = Number(new URLSearchParams(window.location.search).get("tope-medicion"));
  return Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : TOPE_RECORRIDO_MS;
}
// Hasta que la partida no pinta sus primeros frames no empieza a correr el tope:
// en una máquina lenta el arranque (shaders, texturas) no es parte del recorrido.
const ESPERA_ARRANQUE_MS = 60_000;
const FRAMES_ARRANQUE = 10;
// Un tramo con menos frames que esto no es una medida, es un dato vacío.
const FRAMES_MINIMOS_TRAMO = 5;
const DURACION_REPOSO_MS = 3000;
const VENTANA_TRAS_EXPLOSION_MS = 1000;
const ESPERA_MAX_TRAMO_MS = 25_000;

export interface ContextoRecorrido {
  readonly medidor: MedidorFrames;
  readonly respuesta: MedidorRespuesta;
  readonly solucionBalistica: () => { anguloGrados: number; potencia: number } | null;
  readonly impactoReal: () => { x: number; y: number } | null;
  // Se activa al apagarse la escena: un guion huérfano sale sin escribir nada.
  readonly senal?: AbortSignal;
}

class Huerfano extends Error {}

class Interrumpido extends Error {
  constructor(readonly motivo: "cancelada" | "tiempo-agotado" | "sin-frames") {
    super(motivo);
  }
}

const TRAMOS: readonly NombreTramoStore[] = ["reposo", "pepinazo", "racimo", "propulsores", "turno-ia"];

export async function ejecutarRecorrido(ctx: ContextoRecorrido): Promise<void> {
  let inicio = performance.now();
  const tope = topeRecorridoMs();
  const limiteArranque = performance.now() + ESPERA_ARRANQUE_MS;
  window.__debug = window.__debug ?? {};
  window.__debug.medicion = () => structuredClone(obtenerMedicion());
  let paginaOculta = document.visibilityState === "hidden";
  const alCambiarVisibilidad = (): void => {
    if (document.visibilityState === "hidden") paginaOculta = true;
  };
  document.addEventListener("visibilitychange", alCambiarVisibilidad);

  let arrancado = false;
  const comprobar = (): void => {
    if (ctx.senal?.aborted) throw new Huerfano();
    if (medicionCancelada()) throw new Interrumpido("cancelada");
    if (!arrancado && performance.now() > limiteArranque) throw new Interrumpido("sin-frames");
    if (arrancado && performance.now() - inicio > tope) throw new Interrumpido("tiempo-agotado");
  };
  // Polling sobre el estado real, no esperas fijas cruzando los dedos.
  const esperar = async (condicion: () => boolean, maxMs = ESPERA_MAX_TRAMO_MS): Promise<boolean> => {
    const limite = performance.now() + maxMs;
    while (!condicion()) {
      comprobar();
      if (performance.now() > limite) return false;
      await new Promise<void>((r) => setTimeout(r, 40));
    }
    return true;
  };
  // Esperar al turno del humano sin cortar en silencio: si el rival tarda más
  // de lo previsto (render por software), seguir con el tramo siguiente sin su
  // turno lo dejaba sin frames y la causa real quedaba escondida.
  const esperarTurnoHumano = async (): Promise<void> => {
    if (!(await esperar(turnoHumano, 120_000))) throw new Interrumpido("tiempo-agotado");
  };
  const pausa = async (ms: number): Promise<void> => {
    const fin = performance.now() + ms;
    await esperar(() => performance.now() >= fin, ms + 1000);
  };

  const turnoHumano = (): boolean => obtenerEstadoControl().puedeDisparar;
  const tramos: TramoMedido[] = [];
  let medianaReposo: number | null = null;
  let huecoMax = 0;
  let interrupcion: EntradaResumen["interrupcion"] = null;

  // Una medida limpia: calentamiento, y al menos 30 frames desde el tramo anterior.
  const preparar = async (nombre: NombreTramoStore): Promise<void> => {
    fijarTramoMedicion(TRAMOS.indexOf(nombre) + 1, nombre);
    await pausa(CALENTAMIENTO_MS);
    const frames0 = ctx.medidor.instantanea().frames;
    await esperar(() => ctx.medidor.instantanea().frames - frames0 >= FRAMES_ENTRE_TRAMOS);
  };

  const medir = async (nombre: NombreTramoStore, cuerpo: (t0: number) => Promise<void>, conArma = false, calentar = true): Promise<void> => {
    // El turno de la IA arranca en cuanto acaba el tramo anterior: calentar antes
    // dejaba pasar ese turno entero y el tramo salía sin frames.
    if (calentar) await preparar(nombre);
    else fijarTramoMedicion(TRAMOS.indexOf(nombre) + 1, nombre);
    const deltas: { t: number; d: number }[] = [];
    const baja = ctx.medidor.suscribirFrames((d, t) => deltas.push({ t, d }));
    const t0 = performance.now();
    let tImpacto: number | null = null;
    let tExplosion: number | null = null;
    const mirar = (): void => {
      const marcas = ctx.medidor.instantanea().marcas.filter((m) => m.t >= t0);
      tImpacto = marcas.find((m) => m.nombre === "impacto")?.t ?? null;
      tExplosion = marcas.find((m) => m.nombre === "explosion")?.t ?? null;
    };
    try {
      await cuerpo(t0);
    } finally {
      baja();
    }
    const t1 = performance.now();
    mirar();
    const todos = deltas.map((x) => x.d);
    huecoMax = Math.max(huecoMax, ...todos, 0);
    const trabajo = ctx.respuesta.trabajoEnVentana({ inicio: t0, fin: t1 });
    let extra: Partial<TramoMedido> = {};
    if (conArma) {
      const enVuelo = deltas.filter((x) => tImpacto === null || x.t < tImpacto).map((x) => x.d);
      const entre = tImpacto !== null && tExplosion !== null ? deltas.filter((x) => x.t >= tImpacto! && x.t <= tExplosion! + VENTANA_TRAS_EXPLOSION_MS).map((x) => x.d) : [];
      extra = {
        p95Vuelo: enVuelo.length ? estadisticasTramo(enVuelo).p95 : undefined,
        maxImpactoExplosion: entre.length ? estadisticasTramo(entre).max : undefined,
      };
    }
    // Sin frames no hay medida: se deja fuera en vez de publicar un 0,0 ms que
    // parece un reposo perfecto.
    if (todos.length < FRAMES_MINIMOS_TRAMO) throw new Interrumpido("sin-frames");
    if (nombre === "reposo") medianaReposo = medianaDe(todos);
    tramos.push({
      nombre,
      ...estadisticasTramo(todos),
      duracionMs: t1 - t0,
      ...extra,
      ...(trabajo.scriptMs !== null ? { scriptMs: trabajo.scriptMs } : {}),
      renderPhaserMs: trabajo.renderPhaserMs,
    });
  };

  const disparoDeArma = (armaId: string, nombre: "pepinazo" | "racimo") => async (t0: number): Promise<void> => {
    seleccionarArma(armaId);
    // Potencia al 60 % de la que daría al rival: cae corto, sobre el terreno o
    // un planeta, y no acaba la partida a mitad de recorrido.
    const solucion = ctx.solucionBalistica();
    fijarApuntadoDirecto(solucion?.anguloGrados ?? 45, Math.max(10, (solucion?.potencia ?? 60) * 0.6));
    await pausa(100);
    solicitarDisparo();
    // «salida» cubre el tiro que se pierde fuera del mundo: sin explosión no hay
    // nada más que esperar.
    await esperar(() => ctx.medidor.instantanea().marcas.some((m) => (m.nombre === "explosion" || m.nombre === "salida") && m.t >= t0));
    await pausa(VENTANA_TRAS_EXPLOSION_MS);
    const impacto = ctx.impactoReal();
    if (impacto) registrarImpactoMedicion(nombre, impacto);
  };

  try {
    const frames0 = ctx.medidor.instantanea().frames;
    if (!(await esperar(() => ctx.medidor.instantanea().frames - frames0 >= FRAMES_ARRANQUE, ESPERA_ARRANQUE_MS))) throw new Interrumpido("sin-frames");
    if (!(await esperar(turnoHumano, 30_000))) throw new Interrumpido("tiempo-agotado");
    arrancado = true;
    inicio = performance.now();
    await medir("reposo", () => pausa(DURACION_REPOSO_MS));

    await medir("pepinazo", disparoDeArma("pepinazo-cortesia", "pepinazo"), true);
    await esperarTurnoHumano();

    await medir("racimo", disparoDeArma("racimo-de-tuppers", "racimo"), true);
    await esperarTurnoHumano();

    await medir("propulsores", async () => {
      seleccionarEquipo("propulsores");
      // Primer ángulo cuyo vuelo no choque contra la superficie.
      for (const angulo of [90, 60, 120, 45, 135, 75, 105]) {
        fijarApuntadoDirecto(angulo, 50);
        await pausa(150);
        if (!obtenerEstadoControl().propulsoresBloqueados) break;
      }
      // Primero a que el vuelo arranque (el turno sigue siendo del humano justo
      // al pedir el disparo) y solo entonces a que el turno pase al rival: si no,
      // el tramo acababa en el mismo instante y quedaba sin frames. Con la máquina
      // cargada la petición puede perderse: se repite hasta que el vuelo arranca.
      for (let intento = 0; intento < 6 && turnoHumano(); intento++) {
        solicitarDisparo();
        await esperar(() => !turnoHumano(), 5000);
      }
      await esperar(() => (window.__debug?.turno ?? 0) === 1, 60_000);
      // Un vuelo que se resuelve en pocos frames sigue midiéndose hasta tener muestra.
      const framesTras = ctx.medidor.instantanea().frames;
      await esperar(() => ctx.medidor.instantanea().frames - framesTras >= FRAMES_MINIMOS_TRAMO, 10_000);
    });

    await medir(
      "turno-ia",
      async () => {
        await esperar(() => (window.__debug?.turno ?? 1) === 1 || turnoHumano(), 5000);
        await esperarTurnoHumano();
        // Si el turno de la IA se resuelve en pocos frames, se sigue midiendo la
        // vuelta al humano hasta tener una muestra con la que calcular algo.
        await pausa(VENTANA_TRAS_EXPLOSION_MS * 2);
      },
      false,
      false,
    );
  } catch (e) {
    if (e instanceof Huerfano) return;
    if (e instanceof Interrumpido) interrupcion = e.motivo;
    else throw e;
  } finally {
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
  }
  if (ctx.senal?.aborted) return;

  const resumen = construirResumen({
    tramos,
    entorno: {
      navegador: resumirNavegador(navigator.userAgent),
      ancho: window.innerWidth,
      alto: window.innerHeight,
      dpr: window.devicePixelRatio,
      version: process.env.NEXT_PUBLIC_VERSION_APP ?? "desconocida",
    },
    apis: { loaf: ctx.respuesta.hayLongAnimationFrames(), eventTiming: ctx.respuesta.hayEventTiming() },
    inpToques: inpAlIniciarMedicion(),
    paginaOculta: paginaOculta || document.visibilityState === "hidden",
    huecoMaxRafMs: huecoMax,
    medianaReposoMs: medianaReposo,
    interrupcion,
  });
  const texto = formatearResumen(resumen);
  terminarMedicion({
    estado: interrupcion === "cancelada" ? "cancelada" : interrupcion !== null ? "incompleta" : "terminada",
    texto,
    valida: resumen.validez.valida,
  });
  resolverCopia(texto);
}
