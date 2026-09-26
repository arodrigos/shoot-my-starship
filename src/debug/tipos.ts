import type { EventoSimulacion, TipoEventoHumor } from "@/sim/partida/eventos";
import type { EstadisticasPartida, ParteDeGuerra } from "@/sim/partida/parteDeGuerra";
import type { EstadoAudio } from "@/juego/audio/motor";

// Punto de observación que los tests de Playwright leen desde fuera del
// juego (window.__debug.*). Vive en un módulo aparte para que cada bloque
// añada sus propios campos sin que el núcleo de simulación (src/sim, que no
// puede depender de window) tenga que saber que existe.
export interface DebugTerreno {
  esSolido: (x: number, y: number) => boolean;
  // Compara máscara y textura en un lote de puntos con UNA sola lectura del
  // canvas (terreno-3): devuelve, para cada punto, si esSolido(x,y) coincide
  // con que el píxel de la textura tenga alfa > 0.
  comprobarPuntos: (puntos: { x: number; y: number }[]) => boolean[];
  aplicarHuella: (
    cx: number,
    cy: number,
    radio: number,
    signo: "restar" | "sumar",
  ) => { x: number; y: number; ancho: number; alto: number };
  // true en cuanto el guion de huellas de la escena de pruebas ha terminado
  // de aplicarse -- así el test no depende de una espera fija (issue #151).
  listo: boolean;
}

// render-1: lo que produjo el último disparo (del jugador o de la máquina)
// -- ángulo, potencia e impacto EN COORDENADAS DE MUNDO, para comparar entre
// viewports sin que ninguna coordenada de pantalla se cuele en la
// comparación.
export interface DebugUltimoDisparo {
  anguloGrados: number;
  potencia: number;
  impacto: { x: number; y: number };
  // humor-6: dónde paró REALMENTE la animación cliente (AnimadorProyectil),
  // no el impacto que calculó el núcleo -- pueden no coincidir en el mismo
  // píxel exacto (la máscara que ve el cliente ya lleva tallado el cráter de
  // este mismo disparo antes de que la animación arranque), así que la
  // repetición se compara contra este valor, el que de verdad se vio en
  // pantalla, no contra el teórico.
  impactoReal?: { x: number; y: number };
}

// control-apuntado: el ajuste vivo del HUD (fuera del lienzo) y lo que ya se
// disparó de verdad, para que los tests puedan esperar a un estado concreto
// (issue #151) en vez de a un tiempo fijo.
export interface DebugControl {
  ajuste: { anguloGrados: number; potencia: number; armaId: string };
  ultimoDisparo: { anguloGrados: number; potencia: number; armaId: string } | null;
  puedeDisparar: boolean;
  ayudaVisible: boolean;
  usosPorArma: Readonly<Record<string, number>>;
}

// render-6: lo que el indicador de deriva dibujó de verdad, no el dato
// crudo del mapa -- así el test compara lo que se ve, que es lo que pide el
// criterio.
export interface DebugDeriva {
  valorMundo: number;
  etiqueta: string;
  sentido: -1 | 0 | 1;
  longitudFlechaPx: number;
}

export interface DebugNave {
  readonly id: 0 | 1;
  readonly x: number;
  readonly y: number;
  readonly integridad: number;
}

export interface DebugGlobal {
  ultimoPunto?: { x: number; y: number };
  terreno?: DebugTerreno;
  ultimoDisparo?: DebugUltimoDisparo;
  control?: DebugControl;
  deriva?: DebugDeriva;
  naves?: readonly DebugNave[];
  // render-2, render-5: juega N turnos reales (misma avanzar() que un
  // jugador) sin animación, para que el test pueda comprobar el estado
  // renderizado tras una partida guionizada sin depender de temporizadores.
  jugarTurnosGuionizados?: (numero: number) => void;
  // render-5: expone si el juego ha detectado la restauración del contexto
  // WebGL, para que el test no dependa de una espera fija (issue #151).
  webgl?: { restauraciones: number };
  // render-3: true mientras el proyectil está en vuelo, para que el test
  // sepa cuándo empieza y termina el turno animado sin una espera fija.
  animacionEnCurso?: boolean;
  // control-1: de quién es el turno ahora mismo y cuántos turnos van
  // resueltos -- para esperar a "el turno ha vuelto al jugador tras el
  // disparo de la máquina" sin una espera fija (issue #151).
  turno?: 0 | 1;
  numeroTurno?: number;
  // control-1, control-5: la solución balística exacta (deriva 0) para que
  // el disparo de quien tiene el turno ahora acierte al rival -- deja que
  // el test arrastre de verdad hasta ese ángulo/potencia en vez de
  // adivinarlos o de tocar el núcleo por la puerta de atrás.
  solucionBalisticaJugador?: () => { anguloGrados: number; potencia: number } | null;
  // render-4: el rectángulo de mundo que la cámara muestra ahora mismo, para
  // comprobar que el campo de batalla entero cabe sin recorte sin tener que
  // inferirlo de una captura de pantalla.
  camara?: { x: number; y: number; ancho: number; alto: number };
  // humor-1: la sacudida de cámara es una transformación de la matriz de
  // render (Camera.shakeEffect), no un desplazamiento de worldView/scroll --
  // no hay forma de detectarla comparando el rectángulo de cámara entre dos
  // instantes, así que se expone directamente el isRunning del efecto.
  sacudiendoCamara?: boolean;
  // render-7: fuerza el fin de partida disparando Despedida con puntería
  // balística exacta -- jugarTurnosGuionizados no sirve para esto porque el
  // enfrentamiento La Contable / Almirante Bisagra no converge a un ganador
  // en un número razonable de turnos (ver desviaciones).
  forzarFinDePartida?: () => void;
  // humor-1: los eventos de humor del último turno resuelto, para que el
  // test compruebe QUÉ pasó sin tener que adivinarlo de la pantalla.
  ultimosEventos?: readonly EventoSimulacion[];
  // humor-2, humor-4: estado real del AudioContext, para comprobar que un
  // navegador con el audio mudo o suspendido sigue mostrando la reacción
  // visual igualmente.
  estadoAudio?: () => EstadoAudio;
  // humor-6: dispara la repetición instantánea del último disparo resuelto
  // (de cualquiera de las dos naves) sin tocar el estado de partida; expone
  // el punto de impacto que la repetición reproduce para comparar con el
  // impacto real ya visto en ultimoDisparo.
  reproducirRepeticion?: () => void;
  repeticionEnCurso?: boolean;
  impactoRepeticion?: { x: number; y: number } | null;
  // humor-7: el parte de guerra publicado al terminar la partida, con las
  // estadísticas reales que lo sustentan -- para comprobar que el texto no
  // es un remate fijo disfrazado de dinámico.
  parteDeGuerra?: (ParteDeGuerra & { estadisticas: EstadisticasPartida }) | null;
  // humor-2: dispara la reacción real (sacudida, frase, tono) para un tipo de
  // evento de humor concreto, sin tener que fabricar por juego real las
  // condiciones de física/IA de cada uno de los 7 -- pasa por el mismo
  // reaccionarAHumor que usa avanzar() en una partida normal, así que prueba
  // el camino de producción, no un doble de pruebas.
  dispararReaccionHumor?: (tipo: TipoEventoHumor) => void;
  // partida-1: la huella determinista del mundo actual -- la semilla de
  // terreno determina el relieve de forma unívoca (generarMascara), así que
  // comparar esta tupla entre dos partidas equivale a comparar el hash del
  // terreno sin tener que leer el canvas con getImageData desde el test.
  mapa?: { id: string; semillaTerreno: number; gravedad: number; etiquetaDeriva: string };
  // render-espacio: true en el hito jugable nuevo (naves flotando entre
  // planetas), false en el modo de suelo plano de siempre -- así los tests
  // no tienen que inferir el modo comparando la forma de `mapa` o de
  // `naves`.
  modoEspacial?: boolean;
  // esp-3: cuántas veces se ha horneado el fondo de estrellas/nebulosa desde
  // que arrancó esta escena -- tiene que quedarse en 1 para siempre, también
  // después de varios turnos e impactos, porque el fondo no es terreno y
  // ningún redibujado por rectángulo sucio debería tocarlo.
  fondoEspacial?: { bakes: number };
  // esp-6: el resultado del turno que acaba de cerrarse -- incluye el caso
  // "proyectil perdido en órbita" con su propio texto (qué ha pasado y qué
  // hacer), no solo el genérico de impacto/fallo.
  resultadoTurno?: string;
  // esp-6: fuerza el cierre de turno con un evento "proyectil-perdido" real
  // (mismo aplicarResultadoTurno que usa un disparo de verdad), sin depender
  // de encontrar por gesto una órbita estable de un sistema planetario
  // concreto -- ese evento no es de humor (no está en TIPOS_EVENTO_HUMOR), así
  // que dispararReaccionHumor no sirve para forzarlo.
  forzarProyectilPerdido?: () => void;
}

declare global {
  interface Window {
    __debug: DebugGlobal;
  }
}
