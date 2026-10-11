// voz-resumenes: los resúmenes y avisos se leen en voz alta con la Web Speech API del
// navegador (vía easy-speech, que absorbe las rarezas de Chrome, Safari y
// Android). Nada sale del dispositivo: solo se usan voces LOCALES en
// castellano. Una voz remota (las «Google español» de Chrome de escritorio)
// manda el texto, que puede llevar nombres de jugador, a un servidor ajeno.
import { TIMBRE_POR_VOZ } from "@/contenido/vocesPersonajes";
import type { IdVoz } from "@/contenido/bancoBromas";
import { atenuarMusica } from "@/juego/audio/motor";

export const CLAVE_VOZ = "voz:activada";
export const FACTOR_MUSICA_HABLANDO = 0.35;
export const AVISO_SIN_VOZ = "Tu dispositivo no tiene voz en castellano: los resúmenes seguirán en texto";

export interface VozSistema {
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
}

// Android devuelve «es_ES» y el resto «es-ES»; «est-…» no es castellano.
const ES_CASTELLANO = /^es([-_]|$)/i;

// Las voces del sistema que se anuncian como mejoradas suenan bastante menos
// robóticas que las básicas.
const NOMBRE_DE_CALIDAD = /mejorad|enhanced|premium|natural/i;

function puntuarVoz(voz: VozSistema): number {
  return (NOMBRE_DE_CALIDAD.test(voz.name) ? 2 : 0) + (/^es[-_]ES$/i.test(voz.lang) ? 1 : 0);
}

// Invariante: el resultado es null o una voz es-* local. Entre las válidas gana
// la de mayor puntuación y, a igualdad, la primera, para que la elección no
// dependa del azar.
export function elegirVoz<T extends VozSistema>(voces: readonly T[]): T | null {
  const validas = voces.filter((voz) => voz.localService === true && ES_CASTELLANO.test(voz.lang));
  return validas.reduce<T | null>((mejor, voz) => (mejor === null || puntuarVoz(voz) > puntuarVoz(mejor) ? voz : mejor), null);
}

// Cualquier valor que no sea exactamente "false" cuenta como activada: un
// valor corrupto no debe dejar al jugador sin voz ni lanzar.
export function sanearPreferenciaVoz(bruto: unknown): boolean {
  return bruto !== "false";
}

export interface OpcionesHabla {
  readonly text: string;
  readonly voice: VozSistema;
  readonly lang: string;
  readonly rate: number;
  readonly pitch: number;
  readonly start: () => void;
  readonly end: () => void;
  readonly error: () => void;
}

// Frontera con easy-speech, para probar la lógica sin navegador.
export interface MotorVoz {
  iniciar(): Promise<readonly VozSistema[]>;
  hablar(opciones: OpcionesHabla): void;
  cancelar(): void;
}

export type DisponibilidadVoz = "desconocida" | "si" | "no";

export interface LlamadaVoz {
  readonly tipo: "cancel" | "speak";
  readonly texto?: string;
  readonly lang?: string;
  readonly rate?: number;
  readonly pitch?: number;
}

export interface EstadoVoz {
  readonly activada: boolean;
  readonly disponibilidad: DisponibilidadVoz;
  readonly aviso: string | null;
}

export interface Locutor {
  iniciar(): void;
  // prioritario: un anuncio de evento pasa por delante del resumen pendiente.
  hablar(personaje: IdVoz, texto: string, prioritario?: boolean): void;
  callar(): void;
  alternar(): boolean;
  estado(): EstadoVoz;
  llamadas(): readonly LlamadaVoz[];
  suscribir(escucha: () => void): () => void;
}

export interface DependenciasLocutor {
  readonly motor: MotorVoz;
  readonly atenuarMusica: (factor: number) => void;
  readonly leerPreferencia: () => unknown;
  readonly guardarPreferencia: (activada: boolean) => void;
  // Gesto real del usuario: desbloquea la síntesis en iOS y Chrome, que
  // ignoran el primer speak si no nace de un toque.
  readonly desbloquear: () => void;
}

const TOPE_LLAMADAS_REGISTRADAS = 50;

interface PendienteVoz {
  readonly personaje: IdVoz;
  readonly texto: string;
}

export function crearLocutor(deps: DependenciasLocutor): Locutor {
  let activada = sanearPreferenciaVoz(deps.leerPreferencia());
  let disponibilidad: DisponibilidadVoz = "desconocida";
  let aviso: string | null = null;
  let voz: VozSistema | null = null;
  let iniciando = false;
  let desbloqueado = false;
  let enviadas: LlamadaVoz[] = [];
  // Identifica el chiste vigente: los end/error de uno cancelado llegan
  // tarde y no deben subir la música ni bajar la del chiste siguiente.
  let vigente = 0;
  let hablando = false;
  // Cola sin cortes: lo que suena termina y como mucho hay un texto esperando
  // por clase (anuncio de evento y resumen); el más nuevo sustituye al pendiente
  // de su clase y los anuncios se hablan antes que los resúmenes.
  let sonando = false;
  let pendientePrioritario: PendienteVoz | null = null;
  let pendienteNormal: PendienteVoz | null = null;
  const escuchas = new Set<() => void>();

  function avisar(): void {
    for (const escucha of escuchas) escucha();
  }

  function registrar(llamada: LlamadaVoz): void {
    enviadas = [...enviadas, llamada].slice(-TOPE_LLAMADAS_REGISTRADAS);
  }

  function cancelar(): void {
    registrar({ tipo: "cancel" });
    deps.motor.cancelar();
  }

  function restaurarMusica(): void {
    if (!hablando) return;
    hablando = false;
    deps.atenuarMusica(1);
  }

  function callar(): void {
    const habiaVoz = sonando;
    vigente += 1;
    sonando = false;
    pendientePrioritario = null;
    pendienteNormal = null;
    if (disponibilidad !== "si") return;
    // Sin nada sonando no hay qué cortar: un cancel espurio (p. ej. al montar
    // la escena) rompe la regla de no cancelar salvo al silenciar de verdad.
    if (!habiaVoz) return;
    cancelar();
    restaurarMusica();
  }

  async function arrancar(): Promise<void> {
    if (iniciando || disponibilidad !== "desconocida") return;
    iniciando = true;
    try {
      voz = elegirVoz(await deps.motor.iniciar());
    } catch {
      voz = null;
    }
    iniciando = false;
    disponibilidad = voz ? "si" : "no";
    // Un único aviso por sesión: la disponibilidad solo se resuelve una vez.
    if (!voz) aviso = AVISO_SIN_VOZ;
    avisar();
  }

  function iniciar(): void {
    if (!activada) return;
    // Una sola vez: cada toque de la partida pasa por aquí como red de
    // seguridad y no debe encolar un utterance mudo por cada uno.
    if (!desbloqueado) {
      desbloqueado = true;
      try {
        deps.desbloquear();
      } catch {
        // Sin síntesis el juego sigue en texto.
      }
    }
    void arrancar();
  }

  function decir(personaje: IdVoz, texto: string): void {
    if (!voz) return;
    const timbre = TIMBRE_POR_VOZ[personaje];
    const elegida = voz;
    vigente += 1;
    const mio = vigente;
    sonando = true;
    registrar({ tipo: "speak", texto, lang: elegida.lang, rate: timbre.rate, pitch: timbre.pitch });
    const terminar = (): void => {
      if (mio !== vigente) return;
      sonando = false;
      restaurarMusica();
      const siguiente = pendientePrioritario ?? pendienteNormal;
      if (pendientePrioritario) pendientePrioritario = null;
      else pendienteNormal = null;
      if (siguiente) decir(siguiente.personaje, siguiente.texto);
    };
    deps.motor.hablar({
      text: texto,
      voice: elegida,
      lang: elegida.lang,
      rate: timbre.rate,
      pitch: timbre.pitch,
      start: () => {
        if (mio !== vigente) return;
        hablando = true;
        deps.atenuarMusica(FACTOR_MUSICA_HABLANDO);
      },
      end: terminar,
      error: terminar,
    });
  }

  return {
    iniciar,
    hablar(personaje, texto, prioritario = false) {
      if (!activada || disponibilidad !== "si" || !voz || texto.trim() === "") return;
      if (sonando) {
        if (prioritario) pendientePrioritario = { personaje, texto };
        else pendienteNormal = { personaje, texto };
        return;
      }
      decir(personaje, texto);
    },
    callar,
    alternar() {
      activada = !activada;
      deps.guardarPreferencia(activada);
      if (activada) {
        // Pulsar el interruptor es el gesto que exige el navegador.
        iniciar();
      } else {
        callar();
      }
      avisar();
      return activada;
    },
    estado: () => ({ activada, disponibilidad, aviso }),
    llamadas: () => enviadas,
    suscribir(escucha) {
      escuchas.add(escucha);
      return () => escuchas.delete(escucha);
    },
  };
}

// easy-speech se importa al iniciar: queda fuera del bundle de arranque y de
// la pre-renderización en servidor.
function crearMotorEasySpeech(): MotorVoz {
  let modulo: typeof import("easy-speech").default | null = null;
  return {
    async iniciar() {
      modulo = (await import("easy-speech")).default;
      const listo = await modulo.init({ maxTimeout: 3000, interval: 250, quiet: true });
      return listo ? modulo.voices() : [];
    },
    hablar(opciones) {
      if (!modulo) return;
      const { voice, ...resto } = opciones;
      // noStop: easy-speech cancela por su cuenta antes de cada speak y la cola
      // ya garantiza que nada suena a la vez.
      // Las definiciones de tipos de easy-speech 2.4.0 no declaran noStop.
      const sinCortar = { ...resto, voice: voice as SpeechSynthesisVoice, noStop: true };
      modulo
        .speak(sinCortar)
        // easy-speech rechaza la promesa en error o al cancelar; el
        // manejador error ya lo recoge, aquí solo se evita el aviso.
        .catch(() => undefined);
    },
    cancelar() {
      modulo?.cancel();
    },
  };
}

function desbloquearSintesis(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const silencio = new SpeechSynthesisUtterance("");
  silencio.volume = 0;
  window.speechSynthesis.speak(silencio);
}

function leerPreferencia(): unknown {
  try {
    return window.localStorage.getItem(CLAVE_VOZ);
  } catch {
    return null;
  }
}

function guardarPreferencia(activada: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_VOZ, activada ? "true" : "false");
  } catch {
    // Almacenamiento no disponible: la preferencia no persiste.
  }
}

let locutor: Locutor | null = null;

// Perezoso para que importar el módulo (SSR, tests) no toque window.
export function obtenerLocutor(): Locutor {
  if (!locutor) {
    locutor = crearLocutor({
      motor: crearMotorEasySpeech(),
      atenuarMusica,
      leerPreferencia,
      guardarPreferencia,
      desbloquear: desbloquearSintesis,
    });
    if (typeof document !== "undefined") {
      // Una pestaña oculta no debe seguir hablando.
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) locutor?.callar();
      });
    }
  }
  return locutor;
}
