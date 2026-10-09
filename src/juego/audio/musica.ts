// banda-sonora: música de fondo generada con Web Audio, sin ficheros (ACTIVOS.md
// prohíbe el audio en fichero). Se divide en una composición pura
// (notasDeCompas, testeable sin audio) y un programador que la vuelca sobre el
// AudioContext que ya comparte motor.ts.
//
// El azar de la música sale de su propio mulberry32 de semilla fija y nunca de
// EstadoAleatorio: la partida tiene que ser idéntica con la música puesta o
// quitada (la misma semilla reproduce la misma partida).
import { crearGeneradorAleatorio } from "@/sim/aleatorio";

export type VozMusical = "bajo" | "arpegio" | "colchon";

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
const GANANCIA_POR_VOZ: Readonly<Record<VozMusical, number>> = { bajo: 0.9, arpegio: 0.5, colchon: 0.35 };
const TIMBRE_POR_VOZ: Readonly<Record<VozMusical, OscillatorType>> = { bajo: "triangle", arpegio: "square", colchon: "sine" };

interface VozViva {
  readonly inicioS: number;
  readonly finS: number;
  readonly oscilador: OscillatorNode;
}

export interface EstadoProgramador {
  readonly notasProgramadas: number;
  readonly vocesActivas: number;
}

export interface Programador {
  iniciar(): void;
  detener(): void;
  // voz-chistes: baja o devuelve el volumen de la música (1 = el normal)
  // mientras habla un chiste, sin tocar las notas ya agendadas.
  atenuar(factor: number): void;
  activo(): boolean;
  // Una pasada del temporizador; pública para que los tests la ejecuten sin
  // reloj real.
  pasada(): void;
  estado(): EstadoProgramador;
}

export function crearProgramador(contexto: AudioContext): Programador {
  const salida = contexto.createGain();
  salida.gain.value = 0;
  salida.connect(contexto.destination);

  let temporizador: ReturnType<typeof setInterval> | null = null;
  let cola: NotaMusical[] = [];
  let voces: VozViva[] = [];
  let proximoCompas = 0;
  let inicioProximoCompasS = 0;
  let notasProgramadas = 0;

  function rellenarCola(): void {
    const absolutas = notasDeCompas(proximoCompas).map((nota) => ({ ...nota, inicioS: inicioProximoCompasS + nota.inicioS }));
    cola = [...cola, ...absolutas].sort((a, b) => a.inicioS - b.inicioS);
    proximoCompas += 1;
    inicioProximoCompasS += COMPAS_S;
  }

  function programar(nota: NotaMusical): void {
    voces = voces.filter((voz) => voz.finS > contexto.currentTime);
    // Tope duro de voces: si el compás trae demasiadas, se descarta la nota
    // antes que saturar al navegador.
    if (voces.filter((voz) => voz.finS > nota.inicioS).length >= MAX_VOCES_MUSICA) return;
    const oscilador = contexto.createOscillator();
    const ganancia = contexto.createGain();
    oscilador.type = TIMBRE_POR_VOZ[nota.voz];
    oscilador.frequency.value = nota.frecuenciaHz;
    const finS = nota.inicioS + nota.duracionS;
    ganancia.gain.setValueAtTime(0.0001, nota.inicioS);
    ganancia.gain.linearRampToValueAtTime(GANANCIA_POR_VOZ[nota.voz], nota.inicioS + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, finS);
    oscilador.connect(ganancia).connect(salida);
    oscilador.start(nota.inicioS);
    oscilador.stop(finS + 0.02);
    voces.push({ inicioS: nota.inicioS, finS, oscilador });
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
          voz.oscilador.stop();
        } catch {
          // Ya parado: nada que cortar.
        }
      }
      voces = [];
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
    }),
  };
}
