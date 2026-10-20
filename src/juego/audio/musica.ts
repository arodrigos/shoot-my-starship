// banda-sonora: música de fondo generada con Web Audio, sin ficheros (ACTIVOS.md
// prohíbe el audio en fichero). Se divide en una composición pura
// (notasDeCompas, testeable sin audio) y un programador que la vuelca sobre el
// AudioContext que ya comparte motor.ts.
//
// El azar de la música sale de su propio mulberry32 de semilla fija y nunca de
// EstadoAleatorio: la partida tiene que ser idéntica con la música puesta o
// quitada (la misma semilla reproduce la misma partida).
import { crearGeneradorAleatorio } from "@/sim/aleatorio";
import type { NivelTension } from "@/juego/audio/tension";

export type VozMusical = "bajo" | "arpegio" | "colchon" | "bombo" | "caja" | "charles" | "bajo-insistente";

export interface NotaMusical {
  readonly voz: VozMusical;
  // Segundos desde el comienzo del compás (en la composición) o desde el
  // origen del reloj del AudioContext (cuando el programador la agenda).
  readonly inicioS: number;
  readonly duracionS: number;
  readonly frecuenciaHz: number;
}

const SEMILLA_MUSICA = 0x5ba1d0;
const BPM = 90;
export const CORCHEA_S = 60 / BPM / 2;
const CORCHEAS_POR_COMPAS = 8;
export const COMPAS_S = CORCHEA_S * CORCHEAS_POR_COMPAS;
// 24 compases ≈ 64 s: el fragmento más corto que se repite exactamente tiene
// que durar más de 60 s para que la música no se haga pesada enseguida.
export const COMPASES_POR_CICLO = 24;
export const CICLO_S = COMPAS_S * COMPASES_POR_CICLO;

// Pentatónica menor de La: no tiene semitonos, así que cualquier combinación
// de notas suena consonante y el azar no puede producir una disonancia fea.
const ESCALA_SEMITONOS = [0, 3, 5, 7, 10] as const;
const RAIZ_HZ = 110;
const RAICES_POSIBLES = [0, 0, 2, 3, 4] as const;

function frecuenciaDeGrado(grado: number): number {
  const octava = Math.floor(grado / ESCALA_SEMITONOS.length);
  const semitono = ESCALA_SEMITONOS[grado - octava * ESCALA_SEMITONOS.length] + 12 * octava;
  return RAIZ_HZ * 2 ** (semitono / 12);
}

export function notasDeCompas(indiceCompas: number): readonly NotaMusical[] {
  const enCiclo = ((indiceCompas % COMPASES_POR_CICLO) + COMPASES_POR_CICLO) % COMPASES_POR_CICLO;
  const azar = crearGeneradorAleatorio(SEMILLA_MUSICA + enCiclo * 7919);
  const raiz = RAICES_POSIBLES[Math.floor(azar() * RAICES_POSIBLES.length)];
  const notas: NotaMusical[] = [];

  for (const corchea of [0, 4]) {
    notas.push({ voz: "bajo", inicioS: corchea * CORCHEA_S, duracionS: 4 * CORCHEA_S, frecuenciaHz: frecuenciaDeGrado(raiz) });
  }
  notas.push({
    voz: "colchon",
    inicioS: 0,
    // Solapa 0,4 s con el colchón del compás siguiente para que no haya corte.
    duracionS: COMPAS_S + 0.4,
    frecuenciaHz: frecuenciaDeGrado(raiz + 2 + ESCALA_SEMITONOS.length),
  });
  for (let corchea = 0; corchea < CORCHEAS_POR_COMPAS; corchea += 1) {
    const suena = azar() < 0.75;
    const grado = raiz + Math.floor(azar() * ESCALA_SEMITONOS.length) + ESCALA_SEMITONOS.length;
    if (suena) {
      notas.push({ voz: "arpegio", inicioS: corchea * CORCHEA_S, duracionS: 0.4, frecuenciaHz: frecuenciaDeGrado(grado) });
    }
  }
  return notas;
}

// musica-tension: las capas de percusión y de bajo insistente, aparte de la
// composición base para que esta siga idéntica con la tensión a 0.
export type CapaTension = "percusion" | "bajo";
const NIVEL_MINIMO_CAPA: Readonly<Record<CapaTension, NivelTension>> = { percusion: 1, bajo: 2 };

export function notasDeCapas(indiceCompas: number, capas: Readonly<Record<CapaTension, boolean>>): readonly NotaMusical[] {
  const base = notasDeCompas(indiceCompas).find((nota) => nota.voz === "bajo");
  const raizHz = base?.frecuenciaHz ?? RAIZ_HZ;
  const notas: NotaMusical[] = [];
  for (let corchea = 0; corchea < CORCHEAS_POR_COMPAS; corchea += 1) {
    if (capas.percusion) {
      if (corchea % 4 === 0) notas.push({ voz: "bombo", inicioS: corchea * CORCHEA_S, duracionS: 0.18, frecuenciaHz: 110 });
      if (corchea % 4 === 2) notas.push({ voz: "caja", inicioS: corchea * CORCHEA_S, duracionS: 0.12, frecuenciaHz: 1800 });
      if (corchea % 2 === 1) notas.push({ voz: "charles", inicioS: corchea * CORCHEA_S, duracionS: 0.05, frecuenciaHz: 6000 });
    }
    // Corcheas sobre la misma raíz que el bajo base, con la octava arriba en
    // los contratiempos: insiste sin añadir una armonía nueva.
    if (capas.bajo) {
      notas.push({ voz: "bajo-insistente", inicioS: corchea * CORCHEA_S, duracionS: CORCHEA_S * 0.8, frecuenciaHz: corchea % 2 === 1 ? raizHz * 2 : raizHz });
    }
  }
  return notas;
}

export const CLAVE_MUSICA = "banda-sonora:activada";

// Cualquier valor que no sea exactamente "0" cuenta como activada: un valor
// corrupto en localStorage no debe dejar al jugador sin música ni lanzar.
export function sanearPreferenciaMusica(bruto: unknown): boolean {
  return bruto !== "0";
}

export const MAX_VOCES_MUSICA = 8;
const INTERVALO_TEMPORIZADOR_MS = 25;
const VENTANA_LOOKAHEAD_S = 0.1;
// Por debajo de los efectos (GANANCIA_INICIAL = 0,2 en motor.ts).
const GANANCIA_MUSICA = 0.06;
// Las voces de capa son bajas a propósito: con las capas a tope el pico del
// bus no sube más de 3 dB sobre el de la música base (mus-4).
const GANANCIA_POR_VOZ: Readonly<Record<VozMusical, number>> = { bajo: 0.9, arpegio: 0.5, colchon: 0.35, bombo: 0.3, caja: 0.14, charles: 0.07, "bajo-insistente": 0.3 };
const TIMBRE_POR_VOZ: Readonly<Record<VozMusical, OscillatorType>> = { bajo: "triangle", arpegio: "square", colchon: "sine", bombo: "sine", caja: "square", charles: "square", "bajo-insistente": "sawtooth" };
export const BPM_BASE = 90;
export const BPM_TENSO = 100;
// Constante de tiempo de los fundidos de capa: ~2,3 s hasta el 99 %, menos
// que un compás.
const TAU_FUNDIDO_S = 0.5;
const GANANCIA_CAPA_ACTIVA = 1;

interface VozViva {
  readonly inicioS: number;
  readonly finS: number;
  readonly fuente: OscillatorNode | AudioBufferSourceNode;
}

export interface EstadoProgramador {
  readonly notasProgramadas: number;
  readonly vocesActivas: number;
  readonly nivelTension: NivelTension;
  // Ganancia objetivo de cada capa (0 = apagada).
  readonly capas: Readonly<Record<CapaTension, number>>;
  readonly bpm: number;
}

export interface Programador {
  iniciar(): void;
  detener(): void;
  // voz-chistes: baja o devuelve el volumen de la música (1 = el normal)
  // mientras habla un chiste, sin tocar las notas ya agendadas.
  atenuar(factor: number): void;
  // musica-tension: nivel pedido por la partida; entra en la siguiente
  // frontera de compás.
  fijarNivel(nivel: NivelTension): void;
  activo(): boolean;
  // Una pasada del temporizador; pública para que los tests la ejecuten sin
  // reloj real.
  pasada(): void;
  estado(): EstadoProgramador;
}

const CAPA_DE_VOZ: Readonly<Partial<Record<VozMusical, CapaTension>>> = {
  bombo: "percusion",
  caja: "percusion",
  charles: "percusion",
  "bajo-insistente": "bajo",
};
const VOCES_DE_RUIDO: ReadonlySet<VozMusical> = new Set(["caja", "charles"]);
const SEMILLA_RUIDO = 0x70e5;
const DURACION_RUIDO_S = 0.5;

export function crearProgramador(contexto: AudioContext): Programador {
  const salida = contexto.createGain();
  salida.gain.value = 0;
  salida.connect(contexto.destination);
  // Una ganancia por capa, hacia la MISMA salida: así atenuar() (la voz) y
  // detener() (el interruptor «Música») las cubren sin otro camino a destination.
  const gananciaCapa: Record<CapaTension, GainNode> = { percusion: contexto.createGain(), bajo: contexto.createGain() };
  for (const capa of Object.keys(gananciaCapa) as CapaTension[]) {
    gananciaCapa[capa].gain.setValueAtTime(0, 0);
    gananciaCapa[capa].connect(salida);
  }

  let temporizador: ReturnType<typeof setInterval> | null = null;
  let cola: NotaMusical[] = [];
  let voces: VozViva[] = [];
  let proximoCompas = 0;
  let inicioProximoCompasS = 0;
  let notasProgramadas = 0;
  let nivelPedido: NivelTension = 0;
  let nivelAplicado: NivelTension = 0;
  let bpm = BPM_BASE;
  const objetivoCapa: Record<CapaTension, number> = { percusion: 0, bajo: 0 };
  // Último compás con notas de la capa tras apagarla: el fundido dura menos
  // de un compás y sus notas tienen que seguir sonando mientras baja.
  const notasHastaCompas: Record<CapaTension, number> = { percusion: -1, bajo: -1 };
  let ruido: AudioBuffer | null = null;

  function bufferDeRuido(): AudioBuffer {
    if (ruido) return ruido;
    const frames = Math.floor(contexto.sampleRate * DURACION_RUIDO_S);
    ruido = contexto.createBuffer(1, frames, contexto.sampleRate);
    const datos = ruido.getChannelData(0);
    // Semilla propia, como el resto de la música: nunca el azar de la partida.
    const azar = crearGeneradorAleatorio(SEMILLA_RUIDO);
    for (let i = 0; i < frames; i += 1) datos[i] = azar() * 2 - 1;
    return ruido;
  }

  // Frontera de compás: aquí y solo aquí cambian el nivel, las capas y el tempo.
  function aplicarNivelPendiente(): void {
    if (nivelPedido === nivelAplicado) return;
    nivelAplicado = nivelPedido;
    bpm = nivelAplicado >= 3 ? BPM_TENSO : BPM_BASE;
    for (const capa of Object.keys(gananciaCapa) as CapaTension[]) {
      const objetivo = nivelAplicado >= NIVEL_MINIMO_CAPA[capa] ? GANANCIA_CAPA_ACTIVA : 0;
      if (objetivo === objetivoCapa[capa]) continue;
      if (objetivo === 0) notasHastaCompas[capa] = proximoCompas;
      objetivoCapa[capa] = objetivo;
      gananciaCapa[capa].gain.setTargetAtTime(objetivo, inicioProximoCompasS, TAU_FUNDIDO_S);
    }
  }

  function rellenarCola(): void {
    aplicarNivelPendiente();
    const escala = BPM_BASE / bpm;
    const capasConNotas: Record<CapaTension, boolean> = {
      percusion: objetivoCapa.percusion > 0 || proximoCompas <= notasHastaCompas.percusion,
      bajo: objetivoCapa.bajo > 0 || proximoCompas <= notasHastaCompas.bajo,
    };
    const notas = [...notasDeCompas(proximoCompas), ...(capasConNotas.percusion || capasConNotas.bajo ? notasDeCapas(proximoCompas, capasConNotas) : [])];
    const absolutas = notas.map((nota) => ({ ...nota, inicioS: inicioProximoCompasS + nota.inicioS * escala, duracionS: nota.duracionS * escala }));
    cola = [...cola, ...absolutas].sort((a, b) => a.inicioS - b.inicioS);
    proximoCompas += 1;
    inicioProximoCompasS += COMPAS_S * escala;
  }

  function programar(nota: NotaMusical): void {
    voces = voces.filter((voz) => voz.finS > contexto.currentTime);
    // Tope duro de voces: si el compás trae demasiadas, se descarta la nota
    // antes que saturar al navegador.
    if (voces.filter((voz) => voz.finS > nota.inicioS).length >= MAX_VOCES_MUSICA) return;
    const ganancia = contexto.createGain();
    const finS = nota.inicioS + nota.duracionS;
    ganancia.gain.setValueAtTime(0.0001, nota.inicioS);
    ganancia.gain.linearRampToValueAtTime(GANANCIA_POR_VOZ[nota.voz], nota.inicioS + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, finS);
    const capa = CAPA_DE_VOZ[nota.voz];
    const destino = capa ? gananciaCapa[capa] : salida;
    let fuente: OscillatorNode | AudioBufferSourceNode;
    if (VOCES_DE_RUIDO.has(nota.voz)) {
      fuente = contexto.createBufferSource();
      fuente.buffer = bufferDeRuido();
      if (nota.voz === "charles") {
        const filtro = contexto.createBiquadFilter();
        filtro.type = "highpass";
        filtro.frequency.value = nota.frecuenciaHz;
        fuente.connect(filtro).connect(ganancia).connect(destino);
      } else {
        fuente.connect(ganancia).connect(destino);
      }
    } else {
      const oscilador = contexto.createOscillator();
      oscilador.type = TIMBRE_POR_VOZ[nota.voz];
      oscilador.frequency.value = nota.frecuenciaHz;
      // El bombo cae de tono: es lo que lo distingue de un bajo.
      if (nota.voz === "bombo") oscilador.frequency.exponentialRampToValueAtTime(45, finS);
      oscilador.connect(ganancia).connect(destino);
      fuente = oscilador;
    }
    fuente.start(nota.inicioS);
    fuente.stop(finS + 0.02);
    voces.push({ inicioS: nota.inicioS, finS, fuente });
    notasProgramadas += 1;
  }

  function pasada(): void {
    const limite = contexto.currentTime + VENTANA_LOOKAHEAD_S;
    for (;;) {
      if (cola.length === 0) rellenarCola();
      if (cola[0].inicioS >= limite) return;
      programar(cola[0]);
      cola = cola.slice(1);
    }
  }

  return {
    iniciar() {
      if (temporizador !== null) return;
      cola = [];
      proximoCompas = 0;
      inicioProximoCompasS = contexto.currentTime + 0.05;
      salida.gain.cancelScheduledValues(contexto.currentTime);
      salida.gain.value = GANANCIA_MUSICA;
      temporizador = setInterval(pasada, INTERVALO_TEMPORIZADOR_MS);
    },
    detener() {
      if (temporizador === null) return;
      clearInterval(temporizador);
      temporizador = null;
      salida.gain.value = 0;
      // Las notas ya agendadas (hasta 2,7 s por delante) se cortan: si no,
      // sonarían al reactivar la música.
      for (const voz of voces) {
        try {
          voz.fuente.stop();
        } catch {
          // Ya parado: nada que cortar.
        }
      }
      voces = [];
      // El nivel vuelve a 0: al reactivar, el pedido se aplica de nuevo en la
      // primera frontera de compás.
      nivelAplicado = 0;
      bpm = BPM_BASE;
      for (const capa of Object.keys(gananciaCapa) as CapaTension[]) {
        objetivoCapa[capa] = 0;
        notasHastaCompas[capa] = -1;
        gananciaCapa[capa].gain.cancelScheduledValues(contexto.currentTime);
        gananciaCapa[capa].gain.setValueAtTime(0, contexto.currentTime);
      }
    },
    fijarNivel(nivel) {
      nivelPedido = nivel;
    },
    atenuar(factor) {
      // Constante de 50 ms: llega al 99 % en ~250 ms, dentro de los 300 ms
      // que exige voz-4, y sin el chasquido de un salto de ganancia.
      salida.gain.cancelScheduledValues(contexto.currentTime);
      salida.gain.setTargetAtTime(temporizador === null ? 0 : GANANCIA_MUSICA * factor, contexto.currentTime, 0.05);
    },
    activo: () => temporizador !== null,
    pasada,
    estado: () => ({
      notasProgramadas,
      vocesActivas: voces.filter((voz) => voz.inicioS <= contexto.currentTime && voz.finS > contexto.currentTime).length,
      nivelTension: nivelAplicado,
      capas: { ...objetivoCapa },
      bpm,
    }),
  };
}
