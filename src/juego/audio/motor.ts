// humor-sistemico: síntesis puramente procedural (osciladores de Web Audio,
// nunca un fichero de sonido) -- coherente con la política de "todo
// vectorial o generado" del producto, la misma razón por la que el terreno
// es una máscara y no una textura pintada a mano.
//
// Ningún golpe cómico depende de que esto funcione (humor-2): cada función
// pública está envuelta en try/catch y no lanza nunca, así que un navegador
// sin Web Audio, con --mute-audio o con la política de autoplay bloqueando
// el contexto deja el juego mudo pero nunca roto.
import { CLAVE_MUSICA, BPM_BASE, crearProgramador, sanearPreferenciaMusica, type CapaTension, type Programador } from "@/juego/audio/musica";
import { FACTOR_ATENUACION_VOZ, crearBusEfectos, type BusEfectos } from "@/juego/audio/busEfectos";
import { SONIDO_DISPARO_POR_ARMA, SONIDO_IMPACTO_POR_SUPERFICIE, precalcularMuestras, type SuperficieImpacto } from "@/juego/audio/sonidosArmas";
import { FRECUENCIA_MUESTREO_ZZFX } from "@/juego/audio/zzfx";
import { escribirAlmacen, leerAlmacen } from "@/juego/almacenLocal";
import { HISTERESIS_INICIAL, nivelTension, siguienteHisteresis, type EstadoHisteresis, type NivelTension, type SenalesTension } from "@/juego/audio/tension";

export type EstadoAudio = "sin-inicializar" | "suspendido" | "en-marcha";

let contexto: AudioContext | null = null;

export function estadoAudioActual(): EstadoAudio {
  if (!contexto) {
    return "sin-inicializar";
  }
  return contexto.state === "running" ? "en-marcha" : "suspendido";
}

// sonido-procedimental (snd-1): "el sonido nunca se impone" -- silenciado por
// defecto (bruto === null, primera visita) y persistido, igual que
// CLAVE_SACUDIDA_ACTIVA en store.ts pero con el valor opuesto por defecto:
// ese ajuste parte de activado (no estorba), este parte de silenciado
// (no se impone) hasta que el jugador pida sonido con un gesto explícito.
const CLAVE_SILENCIADO = "sonido-procedimental:silenciado";

function leerSilenciadoGuardado(): boolean {
  return leerAlmacen(() => {
    const bruto = window.localStorage.getItem(CLAVE_SILENCIADO);
    return bruto === null ? true : bruto !== "0";
  }, true);
}

function guardarSilenciado(valor: boolean): void {
  escribirAlmacen(() => window.localStorage.setItem(CLAVE_SILENCIADO, valor ? "1" : "0"));
}

let silenciado = leerSilenciadoGuardado();

// banda-sonora: la música tiene su propio interruptor, independiente del de
// efectos. Viene activada por defecto, pero igual que los efectos no crea el
// AudioContext hasta un gesto del usuario.
function leerMusicaGuardada(): boolean {
  return leerAlmacen(() => sanearPreferenciaMusica(window.localStorage.getItem(CLAVE_MUSICA)), true);
}

let musicaActiva = leerMusicaGuardada();
let programador: Programador | null = null;
let audioNoDisponible = false;

export function musicaActivada(): boolean {
  return musicaActiva;
}

// musica-tension: el nivel se calcula aunque no haya audio (sin Web Audio o
// con la música apagada), para que el estado siga siendo coherente al
// reactivarla.
let histeresis: EstadoHisteresis = HISTERESIS_INICIAL;

export function reiniciarTension(): void {
  histeresis = HISTERESIS_INICIAL;
  programador?.fijarNivel(0);
}

// Un cierre de turno (o un cambio brusco de la partida): recalcula el nivel y
// se lo pasa al programador, que lo aplica en la siguiente frontera de compás.
export function actualizarTension(senales: SenalesTension): void {
  histeresis = siguienteHisteresis(histeresis, nivelTension(senales));
  programador?.fijarNivel(histeresis.aplicado);
}

export type EstadoMusicaDebug = "esperando-gesto" | "sonando" | "parada" | "sin-audio";

export function estadoMusica(): {
  readonly estado: EstadoMusicaDebug;
  readonly notasProgramadas: number;
  readonly vocesActivas: number;
  readonly nivelTension: NivelTension;
  readonly capas: Readonly<Record<CapaTension, number>>;
  readonly bpm: number;
} {
  const contadores = programador?.estado() ?? { notasProgramadas: 0, vocesActivas: 0, nivelTension: 0 as NivelTension, capas: { percusion: 0, bajo: 0 }, bpm: BPM_BASE };
  const estado: EstadoMusicaDebug = !musicaActiva
    ? "parada"
    : audioNoDisponible
      ? "sin-audio"
      : programador?.activo()
        ? "sonando"
        : "esperando-gesto";
  // Con el programador parado el nivel que cuenta es el de la partida, no el
  // que sonó la última vez.
  return { estado, ...contadores, nivelTension: programador?.activo() ? contadores.nivelTension : histeresis.aplicado };
}

function arrancarMusica(): void {
  if (!contexto || !musicaActiva) return;
  try {
    programador = programador ?? crearProgramador(contexto);
    programador.iniciar();
  } catch {
    audioNoDisponible = true;
  }
}

// voz-chistes: la música baja mientras habla un chiste. No hace nada si la
// música no está sonando.
export function atenuarMusica(factor: number): void {
  try {
    programador?.atenuar(factor);
  } catch {
    // ver desbloquearAudio.
  }
}

export function sonidoSilenciado(): boolean {
  return silenciado;
}

// Debe llamarse SOLO desde un gesto real del usuario: el clic en "Jugar" de
// PantallaInicio (partida-completa, normalmente el primero de la sesión) o,
// como red de seguridad para gestos posteriores, el pointerdown de la propia
// escena (Partida.ts). Crear o reanudar un AudioContext fuera de un gesto es
// lo que dispara el aviso de autoplay del navegador (humor-4), incluso si
// luego no llega a sonar nada.
//
// snd-1: con el sonido silenciado (el estado por defecto) esta función no
// crea nada -- ni el clic en "Jugar" ni el pointerdown de seguridad deben
// hacer aparecer un AudioContext mientras el jugador no haya pedido sonido
// explícitamente con el silenciador (ver alternarSonido).
export function desbloquearAudio(): void {
  if (silenciado && !musicaActiva) return;
  try {
    if (!contexto) {
      contexto = new AudioContext();
    }
    if (contexto.state === "suspended") {
      void contexto.resume();
    }
  } catch {
    // Sin Web Audio el juego sigue siendo jugable en silencio.
    audioNoDisponible = true;
    return;
  }
  // Un fallo al preparar los efectos deja los efectos mudos, no la música.
  try {
    prepararEfectos(contexto);
  } catch {
    // ver arriba.
  }
  arrancarMusica();
}

// snd-1: único punto que activa o desactiva el sonido -- lo llama el
// silenciador del HUD (gesto explícito del jugador), nunca el arranque de
// partida. Activar ES el gesto que desbloquearAudio exige, así que aquí se
// llama sin pasar por el gate de `silenciado` (que ya se acaba de bajar).
export function alternarSonido(): boolean {
  silenciado = !silenciado;
  guardarSilenciado(silenciado);
  if (!silenciado) {
    desbloquearAudio();
  } else if (!musicaActiva) {
    // Con la música sonando el contexto no se suspende: silenciar los
    // efectos no puede cortar la música.
    pausarAudio();
  }
  return silenciado;
}

// banda-sonora: único punto que activa o desactiva la música. Como
// alternarSonido, pulsarlo es el gesto que desbloquea el AudioContext.
export function alternarMusica(): boolean {
  musicaActiva = !musicaActiva;
  escribirAlmacen(() => window.localStorage.setItem(CLAVE_MUSICA, musicaActiva ? "1" : "0"));
  if (musicaActiva) {
    desbloquearAudio();
  } else {
    programador?.detener();
    if (silenciado) pausarAudio();
  }
  return musicaActiva;
}

// Enganchado al evento PAUSE de Phaser (humor-5): la pestaña en segundo
// plano no debe seguir generando tonos que nadie oye ni consumiendo el
// AudioContext.
export function pausarAudio(): void {
  try {
    void contexto?.suspend();
  } catch {
    // ver desbloquearAudio.
  }
}

// Enganchado al evento RESUME de Phaser: solo reanuda si YA se había
// desbloqueado con el gesto -- nunca crea el contexto por su cuenta, para no
// saltarse la política de autoplay que desbloquearAudio respeta a propósito.
export function reanudarAudio(): void {
  try {
    if (contexto && contexto.state === "suspended") {
      void contexto.resume();
    }
  } catch {
    // ver desbloquearAudio.
  }
}

export type TonoReaccion =
  | "autoimpacto"
  | "deriva-traiciona"
  | "derrumbe-bajo-el-lider"
  | "arma-falla"
  | "enterrado"
  | "caida-al-vacio"
  | "tiro-imposible-acertado"
  | "impacto";

interface PerfilTono {
  readonly frecuenciaHz: number;
  readonly duracionS: number;
  readonly tipo: OscillatorType;
}

// Un timbre por evento, no una única "explosión" genérica: es lo que le da
// lectura propia a cada golpe cómico incluso para quien juega con el sonido
// puesto pero sin mirar el texto de reacción.
const PERFIL_POR_TONO: Readonly<Record<TonoReaccion, PerfilTono>> = {
  impacto: { frecuenciaHz: 150, duracionS: 0.2, tipo: "square" },
  autoimpacto: { frecuenciaHz: 110, duracionS: 0.35, tipo: "sawtooth" },
  "deriva-traiciona": { frecuenciaHz: 660, duracionS: 0.25, tipo: "sine" },
  "derrumbe-bajo-el-lider": { frecuenciaHz: 90, duracionS: 0.4, tipo: "triangle" },
  "arma-falla": { frecuenciaHz: 200, duracionS: 0.15, tipo: "square" },
  enterrado: { frecuenciaHz: 70, duracionS: 0.5, tipo: "sine" },
  "caida-al-vacio": { frecuenciaHz: 50, duracionS: 0.6, tipo: "sawtooth" },
  "tiro-imposible-acertado": { frecuenciaHz: 880, duracionS: 0.2, tipo: "square" },
};

const GANANCIA_INICIAL = 0.2;
const GANANCIA_MINIMA = 0.001;

export function reproducirTono(tipo: TonoReaccion): void {
  if (silenciado || !contexto || contexto.state !== "running") {
    return;
  }
  try {
    const perfil = PERFIL_POR_TONO[tipo];
    const oscilador = contexto.createOscillator();
    const ganancia = contexto.createGain();
    oscilador.type = perfil.tipo;
    oscilador.frequency.value = perfil.frecuenciaHz;
    ganancia.gain.setValueAtTime(GANANCIA_INICIAL, contexto.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(GANANCIA_MINIMA, contexto.currentTime + perfil.duracionS);
    oscilador.connect(ganancia).connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + perfil.duracionS);
  } catch {
    // ver desbloquearAudio.
  }
}

// sonido-zzfx: los efectos de combate son buffers de ZzFX (datos en
// sonidosArmas.ts) precalculados una sola vez al desbloquear el audio y
// reproducidos por el bus de efectos. Los ids se conservan: snd-2 los lee del
// historial. Lo que el historial añade es la variante (id de arma, o la
// superficie del impacto).
export type IdEfectoSonoro = "disparo" | "impacto" | "tictac-mecha" | "tictac-mina";
export type { SuperficieImpacto };
export { FACTOR_ATENUACION_VOZ };

// snd-2 se verifica leyendo este historial desde window.__debug, no
// escuchando audio real: así el test es determinista y no depende de que el
// Chromium headless del CI reproduzca sonido de verdad (mismo principio que
// humor-6 -- "un audio bloqueado por el navegador no puede impedir que [el
// efecto] aparezca"). Por eso el registro ocurre SIEMPRE, incluso silenciado
// o sin contexto, y solo la reproducción real queda condicionada a él.
const TOPE_HISTORIAL_EFECTOS = 20;
export interface EntradaHistorialEfecto {
  readonly id: IdEfectoSonoro;
  readonly variante?: string;
  readonly enMs: number;
}
let historialEfectos: EntradaHistorialEfecto[] = [];

export function obtenerHistorialEfectos(): readonly EntradaHistorialEfecto[] {
  return historialEfectos;
}

let bus: BusEfectos | null = null;
let buffersEfectos: Map<string, AudioBuffer> | null = null;
let precalculos = 0;
let factorEfectos = 1;

export function contadorPrecalculos(): number {
  return precalculos;
}

// Dentro del gesto (desbloquearAudio) y una sola vez por sesión.
function prepararEfectos(ctx: AudioContext): void {
  if (bus) return;
  bus = crearBusEfectos(ctx);
  if (factorEfectos !== 1) bus.atenuar(factorEfectos);
  const buffers = new Map<string, AudioBuffer>();
  for (const [clave, muestras] of precalcularMuestras(FRECUENCIA_MUESTREO_ZZFX)) {
    const buffer = ctx.createBuffer(1, muestras.length, FRECUENCIA_MUESTREO_ZZFX);
    buffer.copyToChannel(muestras, 0);
    buffers.set(clave, buffer);
  }
  buffersEfectos = buffers;
  precalculos += 1;
}

export function atenuarEfectos(factor: number): void {
  factorEfectos = factor;
  try {
    bus?.atenuar(factor);
  } catch {
    // ver desbloquearAudio.
  }
}

function claveEfecto(id: IdEfectoSonoro, variante: string | undefined): string {
  if (id === "disparo") return variante !== undefined && variante in SONIDO_DISPARO_POR_ARMA ? `disparo:${variante}` : "disparo:";
  if (id === "impacto") return variante !== undefined && variante in SONIDO_IMPACTO_POR_SUPERFICIE ? `impacto:${variante}` : "impacto:planeta";
  return `${id}:`;
}

export function reproducirEfecto(id: IdEfectoSonoro, variante?: string): void {
  historialEfectos = [...historialEfectos, { id, ...(variante !== undefined ? { variante } : {}), enMs: Date.now() }].slice(-TOPE_HISTORIAL_EFECTOS);
  // El contexto puede estar en marcha solo por la música: los efectos siguen
  // su propio interruptor.
  if (silenciado || !contexto || contexto.state !== "running" || !bus || !buffersEfectos) {
    return;
  }
  try {
    const buffer = buffersEfectos.get(claveEfecto(id, variante));
    if (!buffer) return;
    const fuente = contexto.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(bus.entrada);
    fuente.start();
  } catch {
    // ver desbloquearAudio.
  }
}
