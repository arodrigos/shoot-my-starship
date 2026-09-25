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
  // render-7: fuerza el fin de partida disparando Despedida con puntería
  // balística exacta -- jugarTurnosGuionizados no sirve para esto porque el
  // enfrentamiento La Contable / Almirante Bisagra no converge a un ganador
  // en un número razonable de turnos (ver desviaciones).
  forzarFinDePartida?: () => void;
}

declare global {
  interface Window {
    __debug: DebugGlobal;
  }
}
