// humor-sistemico: síntesis puramente procedural (osciladores de Web Audio,
// nunca un fichero de sonido) -- coherente con la política de "todo
// vectorial o generado" del producto, la misma razón por la que el terreno
// es una máscara y no una textura pintada a mano.
//
// Ningún golpe cómico depende de que esto funcione (humor-2): cada función
// pública está envuelta en try/catch y no lanza nunca, así que un navegador
// sin Web Audio, con --mute-audio o con la política de autoplay bloqueando
// el contexto deja el juego mudo pero nunca roto.
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
  try {
    const bruto = window.localStorage.getItem(CLAVE_SILENCIADO);
    return bruto === null ? true : bruto !== "0";
  } catch {
    return true;
  }
}

function guardarSilenciado(valor: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_SILENCIADO, valor ? "1" : "0");
  } catch {
    // Cuota agotada o almacenamiento no disponible: la preferencia no
    // persiste entre partidas, un fallo visible y sin consecuencias, no una
    // excepción sin capturar (mismo patrón que el resto del módulo).
  }
}

let silenciado = leerSilenciadoGuardado();

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
  if (silenciado) return;
  try {
    if (!contexto) {
      contexto = new AudioContext();
    }
    if (contexto.state === "suspended") {
      void contexto.resume();
    }
  } catch {
    // Sin Web Audio el juego sigue siendo jugable en silencio.
  }
}

// snd-1: único punto que activa o desactiva el sonido -- lo llama el
// silenciador del HUD (gesto explícito del jugador), nunca el arranque de
// partida. Activar ES el gesto que desbloquearAudio exige, así que aquí se
// llama sin pasar por el gate de `silenciado` (que ya se acaba de bajar).
export function alternarSonido(): boolean {
  silenciado = !silenciado;
  guardarSilenciado(silenciado);
  if (silenciado) {
    pausarAudio();
  } else {
    desbloquearAudio();
  }
  return silenciado;
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
  if (!contexto || contexto.state !== "running") {
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

// sonido-procedimental (snd-2): un timbre por efecto de combate, distinto de
// los TonoReaccion de humor-sistemico (esos narran la reacción cómica del
// turno completo, estos marcan el instante del disparo/impacto/roce/cuenta
// atrás). "impacto" y "roce" deben sonar de forma claramente distinta para
// reforzar con el oído la misma distinción que ya hace contacto-honesto a
// nivel visual, y las dos cuentas atrás (mecha/mina) deben distinguirse
// entre sí para que un jugador que lleve las dos armas a la vez sepa cuál
// está a punto de explotar sin mirar la pantalla.
export type IdEfectoSonoro = "disparo" | "impacto" | "roce" | "tictac-mecha" | "tictac-mina";

const PERFIL_POR_EFECTO: Readonly<Record<IdEfectoSonoro, PerfilTono>> = {
  disparo: { frecuenciaHz: 520, duracionS: 0.06, tipo: "square" },
  impacto: { frecuenciaHz: 130, duracionS: 0.22, tipo: "sawtooth" },
  roce: { frecuenciaHz: 900, duracionS: 0.05, tipo: "sine" },
  "tictac-mecha": { frecuenciaHz: 1100, duracionS: 0.04, tipo: "square" },
  "tictac-mina": { frecuenciaHz: 700, duracionS: 0.04, tipo: "triangle" },
};

// snd-2 se verifica leyendo este historial desde window.__debug, no
// escuchando audio real: así el test es determinista y no depende de que el
// Chromium headless del CI reproduzca sonido de verdad (mismo principio que
// humor-6 -- "un audio bloqueado por el navegador no puede impedir que [el
// efecto] aparezca"). Por eso el registro ocurre SIEMPRE, incluso silenciado
// o sin contexto, y solo la reproducción real queda condicionada a él.
const TOPE_HISTORIAL_EFECTOS = 20;
let historialEfectos: Array<{ id: IdEfectoSonoro; enMs: number }> = [];

export function obtenerHistorialEfectos(): readonly { id: IdEfectoSonoro; enMs: number }[] {
  return historialEfectos;
}

export function reproducirEfecto(id: IdEfectoSonoro): void {
  historialEfectos = [...historialEfectos, { id, enMs: Date.now() }].slice(-TOPE_HISTORIAL_EFECTOS);
  if (!contexto || contexto.state !== "running") {
    return;
  }
  try {
    const perfil = PERFIL_POR_EFECTO[id];
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
