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

// Debe llamarse SOLO desde un gesto real del usuario (el pointerdown de la
// propia escena, el mismo que empieza a apuntar -- ver Partida.ts y las
// desviaciones del bloque: no hay una pantalla de bloqueo dedicada): crear o
// reanudar un AudioContext fuera de un gesto es lo que dispara el aviso de
// autoplay del navegador (humor-4), incluso si luego no llega a sonar nada.
export function desbloquearAudio(): void {
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
