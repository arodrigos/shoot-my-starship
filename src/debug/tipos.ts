import type { EventoSimulacion, TipoEventoHumor } from "@/sim/partida/eventos";
import type { EstadisticasPartida, ParteDeGuerra } from "@/sim/partida/parteDeGuerra";
import type { EstadoAudio, IdEfectoSonoro } from "@/juego/audio/motor";
import type { CategoriaBroma } from "@/sim/partida/categoriaBroma";
import type { IdVoz } from "@/contenido/bancoBromas";
import type { IdNave } from "@/sim/partida/tipos";
import type { TipoEvento } from "@/sim/universo/tipos";
import type { EstadoProyectil } from "@/sim/fisica/proyectil";
import type { EstadoAleatorio } from "@/sim/aleatorio";
import type { DatosExplosionPorCapas, NombreFaseExplosion } from "@/juego/efectos/ExplosionPorCapas";
import type { TipoVisualPixel } from "@/juego/terreno/clasificacionVisual";
import type { EntradaHistoricoBroma } from "@/juego/control/broma";
import type { Detonacion } from "@/sim/partida/detonaciones";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";

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
  // crateres-y-escombros (crt-1): qué tipo visual dibuja este punto, misma
  // clasificación pura que usa el renderizador real.
  clasificarVisual: (x: number, y: number) => TipoVisualPixel;
  // crateres-y-escombros (crt-1): primer punto de la máscara real con ese
  // material (ver mascara.ts: 0 aire, 1..6 planeta, 255 escombro), o null si
  // no hay ninguno -- evita coordenadas fijas atadas a una semilla concreta.
  buscarPixelDeMaterial: (material: number) => { x: number; y: number } | null;
  // crateres-y-escombros (crt-1): color RGBA ya pintado en el lienzo real
  // para un lote de puntos, con una sola lectura (mismo patrón que
  // comprobarPuntos).
  leerColores: (puntos: { x: number; y: number }[]) => { r: number; g: number; b: number; a: number }[];
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
  // arma-mosca (mos-3): insumos completos del vuelo RESUELTO -- el e2e no
  // tiene forma de leer el resultado del núcleo desde fuera del proceso, así
  // que le da todo lo que simularVuelo necesita para recalcularlo ella misma
  // en Node y comparar esa trayectoria, punto a punto, contra la animada
  // (trayectoriaAnimadaUltimoVuelo). Opcional: solo lo rellenan los disparos
  // posteriores a este bloque.
  armaId?: string;
  inicial?: EstadoProyectil;
  gravedad?: number;
  deriva?: number;
  // gravedad-visible (grav-vis-4): sin esto, reconstruir el vuelo en Node
  // con solo gravedad/deriva ignora la atracción de los planetas (que en el
  // hito espacial es la ÚNICA gravedad que hay, gravedad=0) y la trayectoria
  // recalculada diverge de la real en cuanto el pozo empieza a desviarla.
  planetas?: RegistroPlanetas;
  aleatorioAntes?: EstadoAleatorio;
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
  // realce-impacto (rlc-3): espejo de EstadoControl.sacudidaActiva, para que
  // el e2e lea el ajuste persistido sin depender de leer el DOM del botón.
  sacudidaActiva: boolean;
  // sonido-procedimental (snd-1): espejo de EstadoControl.silenciado, mismo
  // motivo que sacudidaActiva -- leer el ajuste persistido sin depender del
  // DOM del botón de silenciar.
  silenciado: boolean;
}

// render-6: lo que el indicador de deriva dibujó de verdad, no el dato
// crudo del mapa -- así el test compara lo que se ve, que es lo que pide el
// criterio.
export interface DebugDeriva {
  valorMundo: number;
  etiqueta: string;
  sentido: -1 | 0 | 1;
  longitudFlechaPx: number;
  // hud-canales-1 (undécima corrección): bordes reales de la etiqueta en
  // CSS px, para comprobar que cabe en el lienzo sin leer píxeles a ojo.
  etiquetaBordeIzquierdoCssPx: number;
  etiquetaBordeDerechoCssPx: number;
}

export interface DebugNave {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly integridad: number;
  // nve-1: el tramo de daño y el hash de la silueta DIBUJADA que le
  // corresponde -- ver src/juego/naves/formaCasco.ts. El e2e compara estos
  // hashes en los tres tramos en vez de leer píxeles del canvas.
  readonly nivelDanio: "alta" | "media" | "baja";
  readonly hashSilueta: number;
  // arte-siluetas-3: el indicador de nave propia (triángulo sobre la nave
  // de quien tiene el turno) no tenía forma de comprobarse desde fuera de
  // Phaser -- ni un e2e podía mirar window.__debug para ver a quién
  // marcarActiva() dejó visible. Refleja Nave.estaActiva() tal cual.
  readonly activa: boolean;
  // escudo-y-propulsores: turnos que le quedan al escudo dibujado (0 = sin
  // escudo), leídos de la propia Nave y no del estado, para que el e2e
  // compruebe lo que se ve.
  readonly escudo: number;
  // sil-1/sil-2: familia de casco del asiento (0-3), leída de la Nave dibujada
  // para que el e2e compruebe que cuatro naves se ven con cuatro formas.
  readonly silueta: 0 | 1 | 2 | 3;
  // Color del asiento en CSS (#rrggbb): el mismo con el que la cáscara pinta
  // su nombre en el histórico.
  readonly colorAsiento: string;
}

// hum-1: un registro por turno de lo que reaccionarABroma publicó de
// verdad, con la atribución completa (quién disparó, qué voz sonó, qué
// categoría de resultado se mostró) -- el HUD/broma.ts solo guarda la ÚLTIMA
// broma de cada tipo, así que sin este historial un test no puede comprobar
// "sin excepción" a lo largo de varios turnos ni cruzar la frase mostrada
// contra el banco de la nave y la categoría que ocurrieron de verdad.
export interface DebugBromaEntry {
  readonly numeroTurno: number;
  readonly tirador: IdNave;
  readonly voz: IdVoz;
  readonly categoria: CategoriaBroma;
  readonly textoDisparo: string | null;
  readonly textoImpacto: string;
  readonly eventos: readonly EventoSimulacion[];
}

export interface DebugEfectoVisible {
  // cat-2: "haz-laser" es el rayo instantáneo (un único segmento nave → punto
  // de impacto, que dura duracionMs); "explosion" es lo de siempre.
  // eventos-visibles: «evento-<tipo>» es el efecto gráfico de un evento del
  // universo (persistente mientras dure, o transitorio unos segundos).
  readonly tipo?: "explosion" | "haz-laser" | "numero-danio" | `evento-${TipoEvento}`;
  // Solo los efectos de evento ligados a una nave.
  readonly nave?: number;
  // vida-color: solo "numero-danio" -- el daño mostrado y el color del
  // asiento de quien disparó.
  readonly valor?: number;
  readonly color?: string;
  readonly duracionMs?: number;
  readonly desde?: { readonly x: number; readonly y: number };
  readonly x: number;
  readonly y: number;
  readonly radioOnda: number;
  readonly particulas: number;
  readonly escala: number;
  readonly sobre: Detonacion["sobre"];
}

export interface DebugGlobal {
  ultimoPunto?: { x: number; y: number };
  terreno?: DebugTerreno;
  ultimoDisparo?: DebugUltimoDisparo;
  // arma-mosca (mos-3): posición inicial y de cada paso animado del último
  // vuelo -- el e2e la compara contra ResultadoVuelo.trayectoria del mismo
  // disparo resuelto de nuevo en Node (ver AnimadorProyectil.obtenerTrayectoria).
  trayectoriaAnimadaUltimoVuelo?: readonly { readonly x: number; readonly y: number }[];
  control?: DebugControl;
  deriva?: DebugDeriva;
  naves?: readonly DebugNave[];
  // escudo-y-propulsores (esc-2): radio del círculo de alcance de los
  // propulsores en unidades de mundo, y la ruta prevista cuando están elegidos.
  alcancePropulsores?: number;
  previsualizacionPropulsores?: { readonly puntos: readonly { readonly x: number; readonly y: number }[]; readonly motivo: string } | null;
  // desplazamiento-tras-impacto (des-3): marcas «Estaba aquí» vivas durante el
  // turno siguiente, con el origen de cada desplazamiento.
  fantasmas?: readonly { readonly nave: number; readonly x: number; readonly y: number }[];
  // fantasma (fan-1): naves muertas convertidas en fantasma. Aparte de
  // `fantasmas`, que son las marcas «Estaba aquí» de un desplazamiento.
  fantasmasNave?: readonly {
    readonly nave: number;
    readonly nombre: string;
    readonly alfa: number;
    readonly x: number;
    readonly y: number;
    readonly yVisible: number;
    readonly texturaValida: boolean;
  }[];
  // Recorrido simulado de cada empuje del último turno, con el motivo de parada.
  recorridoEmpuje?: readonly { readonly nave: number; readonly puntos: readonly { readonly x: number; readonly y: number }[]; readonly motivoParada: string }[];
  // minirobot (rob-2): robots posados en un planeta, con su posición y saltos.
  robots?: readonly { readonly dueno: number; readonly planetaId: number; readonly x: number; readonly y: number; readonly saltos: number }[];
  // eventos-universo: calendario y efectos vivos, y un gancho para fijar el
  // próximo evento sin esperar al sorteo (solo e2e).
  proximoEvento?: { readonly enTurnos: number; readonly tipo: string; readonly afectado: number } | null;
  efectos?: readonly { readonly tipo: string; readonly nave?: number; readonly turnosRestantes: number }[];
  // eventos-objetos: corazones y tormentas vivos, con la ruta que recorrerán al
  // cerrar el turno actual (la misma función que los mueve).
  objetos?: readonly {
    readonly id: number;
    readonly tipo: string;
    readonly x: number;
    readonly y: number;
    readonly turnosRestantes: number;
    readonly rutaPrevista: readonly { readonly x: number; readonly y: number }[];
  }[];
  // Solo e2e: coloca objetos exactos (posición y velocidad) para fijar un escenario.
  fijarObjetos?: (objetos: readonly { tipo: "corazon" | "tormenta"; x: number; y: number; vx: number; vy: number }[]) => void;
  // Solo e2e: sitúa la partida en una ronda y con unas integridades exactas.
  fijarMuerteSubita?: (escenario: { ronda: number; integridades?: readonly number[] }) => void;
  ronda?: number;
  // Solo e2e: aplica el evento ya, sin esperar al calendario, y lo refresca
  // como si hubiera llegado al cerrar un turno.
  forzarEvento?: (tipo: TipoEvento, afectado?: number) => void;
  fijarProximoEvento?: (proximo: { enTurnos: number; tipo: "loteria" | "vitaminas" | "virus" | "reparacion" | "terremoto" | "gravedad-x2" | "gravedad-mitad" | "viento-solar" | "agujero-negro" | "corazon" | "tormenta"; afectado: number }) => void;
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
  turno?: IdNave;
  // multi-setup-partida: quién controla cada nave, en el orden de asientos.
  // Ids de las naves eliminadas, en el orden en que cayeron.
  eliminadas?: readonly number[];
  // Ganador de la partida (null = empate); ausente mientras sigue en curso.
  ganador?: number | null;
  controladores?: readonly { readonly tipo: "humano" | "ia"; readonly nombre: string }[];
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
  // encuadre-movil: el tamaño de mundo lógico que quedó activo tras ajustar
  // al contenedor real -- MUNDO_ANCHO/MUNDO_ALTO ya no son fijos, así que el
  // e2e necesita este canal en vez de asumir 1920x1080.
  mundo?: { ancho: number; alto: number };
  // pantalla-completa (pan-1): cuenta los "resize" de Phaser.Scale desde que arranca la partida.
  contadorResize?: number;
  // consola-compacta: estado y anclaje vigentes de la consola (con-1).
  consola?: { estado: "desplegada" | "minima" | "oculta"; anclaje: "abajo-centro" | "abajo-izquierda" | "abajo-derecha" };
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
  // sonido-procedimental (snd-1, snd-2): función en vivo (mismo patrón que
  // estadoAudio) en vez de un valor congelado en el último render de
  // ControlHUD -- el historial de efectos se escribe desde Partida.ts
  // (Phaser), fuera del ciclo de React, así que una instantánea fijada en un
  // efecto quedaría obsoleta entre disparos.
  audio?: () => { silenciado: boolean; historial: readonly { id: IdEfectoSonoro; enMs: number }[] };
  // banda-sonora (mus-1): estado en vivo de la música, para verificar sin oír.
  musica?: () => {
    estado: "esperando-gesto" | "sonando" | "parada" | "sin-audio";
    notasProgramadas: number;
    vocesActivas: number;
  };
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
  // realce-impacto (rlc-2): danio es opcional (por defecto 0, el mismo
  // comportamiento que con-2/con-3 ya probaban) -- un e2e que quiera un
  // impacto CON daño real para ejercer la sacudida/destello nuevos lo pasa
  // explícito, sin tocar los tests existentes que llaman con 3 argumentos.
  dispararEventoImpactoReal?: (nave: IdNave, x: number, y: number, danio?: number) => void;
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
  // modos-y-presupuesto: modo de la partida ("barra-libre"/"presupuesto") y
  // saldo actual del jugador (null fuera de presupuesto) -- espejo de lo que
  // publica Partida.ts al store de control, para que los tests e2e puedan
  // leerlo sin esperar a que React repinte.
  modo?: "barra-libre" | "presupuesto";
  saldo?: number | null;
  // economia-rectificada: saldo de cada asiento (null sin presupuesto) y el
  // arma de la última entrada resuelta, para comprobar qué compró cada IA.
  saldos?: readonly (number | null)[];
  ultimaEntrada?: { nave: number; arma: string };
  // esp-3: cuántas veces se ha horneado el fondo de estrellas/nebulosa desde
  // que arrancó esta escena -- tiene que quedarse en 1 para siempre, también
  // después de varios turnos e impactos, porque el fondo no es terreno y
  // ningún redibujado por rectángulo sucio debería tocarlo.
  // fondo-y-pozos: la capa estelar cercana y los pozos de gravedad se
  // hornean fundidos en esta misma textura (ver FondoEspacial.ts), así que
  // comparten este único contador en vez de tener uno propio.
  fondoEspacial?: { bakes: number; rehornoHalos?: number };
  // halos-gravedad: anillos de cada pozo tal y como se pintaron (radio, nivel
  // y aceleración objetivo), y la aceleración real del pozo a una distancia
  // para que el e2e compruebe que son coherentes con la física.
  halos?: Array<{ id: number; anillos: Array<{ nivel: number; r: number; aceleracion: number; opacidad: number }> }>;
  aceleracionPozo?: (id: number, r: number) => number | undefined;
  // esp-6: el resultado del turno que acaba de cerrarse -- incluye el caso
  // "proyectil perdido en órbita" con su propio texto (qué ha pasado y qué
  // hacer), no solo el genérico de impacto/fallo.
  resultadoTurno?: string;
  // salida-pantalla: el aviso «¡Perdido!» del último tiro que salió del encuadre,
  // en coordenadas del mundo (el texto vive en el lienzo, no en el DOM).
  avisoPerdido?: { borde: string; x: number; y: number; ancho: number; alto: number };
  // esp-6: fuerza el cierre de turno con un evento "proyectil-perdido" real
  // (mismo aplicarResultadoTurno que usa un disparo de verdad), sin depender
  // de encontrar por gesto una órbita estable de un sistema planetario
  // concreto -- ese evento no es de humor (no está en TIPOS_EVENTO_HUMOR), así
  // que dispararReaccionHumor no sirve para forzarlo.
  forzarProyectilPerdido?: () => void;
  // arma-granada-espoleta (gra-2, solo e2e): fuerza el fusible (en pasos) del
  // PRÓXIMO disparo "mecha", de un solo uso -- ningún mundo jugable tiene
  // gravedad baja de sobra para que un vuelo real supere los 300 pasos
  // reales sin chocar antes (gra-1/gra-4 prueban esos 300 pasos exactos con
  // gravedad de laboratorio, no por este hook), así que el e2e no puede
  // comprobar "el HUD llega a cero en el mismo fotograma que la detonación"
  // apuntando un ángulo/potencia real. No existe rama por arma: si el
  // siguiente disparo no es "mecha", este valor no se lee y se pierde igual.
  forzarFusibleMechaPasos?: (pasos: number) => void;
  // arma-mina-adherente (min-1, solo e2e): mismo motivo y mismo patrón de
  // uso único que forzarFusibleMechaPasos -- fuerza el fusible (en pasos,
  // contados DESDE QUE SE PEGA) del PRÓXIMO disparo "adherente-con-mecha".
  forzarFusibleAdherenciaPasos?: (pasos: number) => void;
  // imp-12: qué fogonazo se disparó de verdad en el último impacto resuelto
  // -- para que el test compruebe la distinción visual hit/sin-daño sin
  // tener que leer píxeles de pantalla.
  ultimoTipoExplosion?: "danio" | "sin-danio";
  // explosiones-por-capas (exl-1): datos del último impacto con daño real --
  // x/y/danio tal como los resolvió el núcleo, más la escala (función pura
  // de danio) y el instante en que se disparó. inicioMs es this.time.now de
  // la escena, no Date.now(): fasesActivasExplosion(elapsedMs) espera un
  // desfase relativo a ESE instante, no al reloj del sistema.
  ultimaExplosionPorCapas?: DatosExplosionPorCapas;
  // explosiones-visuales: las detonaciones del último turno tal como las
  // declara el núcleo, y las explosiones que la cáscara dibujó para ellas
  // (misma longitud y mismo orden). Se sustituyen en cada turno.
  detonaciones?: readonly Detonacion[];
  efectosVisibles?: readonly DebugEfectoVisible[];
  // vida-color: lo que pinta la barra de vida de cada nave viva (una nave a
  // 0 no tiene barra y no aparece).
  hud?: { vidas: readonly { id: number; colorRelleno: string; etiqueta: string; valor: number }[] };
  // Cuántas veces se ha sacudido la cámara en la partida: con movimiento
  // reducido tiene que quedarse como estaba.
  sacudidasCamara?: number;
  // realce-impacto (rlc-1, rlc-2): datos del último realce de impacto (solo
  // en un impacto con daño real y con la sacudida activada) -- amplitud ya
  // calculada por la misma función pura que el unitario ejerce, para que el
  // e2e compruebe "mayor que cero y proporcional" sin leer píxeles.
  ultimoRealceImpacto?: { danio: number; amplitud: number } | null;
  // explosiones-por-capas (exl-1): pura y determinista -- dado un desfase en
  // ms desde el impacto, qué capas de la explosión están activas. No lee
  // nada de la escena: es la misma función que usa el juego para decidir qué
  // dibujar, expuesta para que el test no tenga que adivinar un sleep.
  fasesActivasExplosion?: (elapsedMs: number) => readonly NombreFaseExplosion[];
  // prevision-real (pvr-1, pvr-2, pvr-3): los puntos de mundo que dibuja la
  // mira este fotograma -- null cuando está oculta (fuera de turno, en
  // vuelo, o el tiro se corta antes del primer punto útil). Así el test
  // comprueba la trayectoria y su ocultación leyendo datos, nunca píxeles.
  previsualizacion?: { puntos: readonly { x: number; y: number }[]; visible: true } | null;
  // potencia-dispersion (pot-3, pot-4): la banda de incertidumbre que se
  // dibuja antes de disparar -- extremoMenor/extremoMayor son las DOS
  // trayectorias reales (ángulo ±amplitud, misma gravedad) que delimitan el
  // cono; amplitudGrados es 0 en la banda baja de potencia, donde los dos
  // extremos colapsan en el centro y no se dibuja nada aparte de la mira de
  // siempre. null en las mismas condiciones que `previsualizacion`.
  bandaDispersion?: {
    extremoMenor: readonly { x: number; y: number }[];
    extremoMayor: readonly { x: number; y: number }[];
    amplitudGrados: number;
  } | null;
  // proy-4: partículas vivas del pool de estela y su tope declarado -- así
  // el test comprueba el límite leyendo un contador, no contando objetos de
  // escena ni leyendo píxeles.
  estela?: { vivas: number; tope: number };
  // paron-explosion: instantánea del medidor de frames (getter vivo).
  rendimiento?: import("@/juego/rendimiento/medidorFrames").InstantaneaRendimiento &
    import("@/juego/rendimiento/medidorRespuesta").InstantaneaRespuesta;
  // respuesta-200ms: centinela de la medida. El siguiente toque bloquea el hilo
  // `ms` (tope 1000) dentro de su manejador.
  bloquearHilo?: (ms: number) => void;
  // respuesta-200ms: cómo se resuelve la simulación ("trabajador" o "en-linea").
  motor?: { modo: import("@/juego/motor/clienteSim").ModoMotor; motivo: string | null };
  // proy-4: el máximo de partículas vivas observado en cualquier fotograma
  // desde que arrancó la escena -- una ráfaga de disparos sucede en un único
  // page.evaluate síncrono (ver dispararRafagaTurbo), así que el test no
  // puede muestrear "vivas" fotograma a fotograma desde fuera; este máximo
  // acumulado es la única forma de comprobar que el tope nunca se superó
  // DURANTE la ráfaga, no solo al final de ella.
  estelaMaxVivas?: number;
  // proy-5: posición de mundo y arma del proyectil REAL en vuelo (null fuera
  // de vuelo) -- para comprobar visibilidad/solapo con el HUD sin leer
  // píxeles de pantalla.
  proyectilEnVuelo?: { x: number; y: number; armaId: string } | null;
  // racimo-perdigones: perdigones dibujados ahora (1 el portador entero, 5 el
  // Racimo en los últimos 40 u; 0 sin vuelo) y el máximo del último vuelo.
  proyectil?: { perdigones: number; perdigonesMaximo: number };
  // proy-4 (desviación, ver entregable): dispara y resuelve N turnos reales
  // en ráfaga -- misma dispararEntrada/animación que un turno jugado a mano,
  // pero sin esperar el reloj real entre pasos, para que un test de pool
  // acotado no tenga que reproducir 20 vuelos a velocidad real.
  dispararRafagaTurbo?: (numeroDeDisparos: number) => Promise<void>;
  // imp-11: análogo a solucionBalisticaJugador pero para modo espacial, donde
  // no hay fórmula cerrada -- reutiliza el mismo oráculo real de la IA
  // (barridoRejilla) para dar un disparo con daño > 0 verificado contra el
  // resolutor real, nunca una condición de parada propia del test.
  solucionMultipozoJugador?: () => { anguloGrados: number; potencia: number; danio: number } | null;
  // imp-11: resuelve un disparo concreto (ángulo/potencia) contra el
  // resolutor real sin aplicarlo a la partida, para que el test pueda pedir
  // un fallo garantizado (danio === 0) verificado, no adivinado a ciegas.
  probarDisparoMultipozoJugador?: (anguloGrados: number, potencia: number) => { danio: number };
  // hum-1: historial completo de bromas publicadas desde que arrancó la
  // escena, en orden de turno -- ver DebugBromaEntry.
  historialBromas?: readonly DebugBromaEntry[];
  // historico-mensajes: estado de la hoja del histórico, y un inyector para
  // llenarlo sin jugar decenas de turnos (mismo papel que cargarEscenario).
  historico?: { abierto: boolean; mensajes: number };
  inyectarHistorico?: (entradas: readonly EntradaHistoricoBroma[]) => void;
  // proy-1 (requisito c de la sexta devolución): true en cuanto la escena
  // de pruebas Siluetas ha dibujado las 13 siluetas del catálogo, para que
  // el test de captura no dependa de una espera fija (issue #151).
  siluetasListo?: boolean;
  // cie-2: los planetas del sistema que colocarNaves acabó usando de
  // verdad (nunca uno generado aparte) -- el smoke test de traspaso lo
  // necesita para comprobar "al menos tres planetas" sin tener que leer
  // píxeles del lienzo. Ausente en modo de suelo plano (mapaId).
  planetas?: readonly { readonly id: number; readonly cx: number; readonly cy: number; readonly radio: number }[];
  // esc-1: geometría real (en px de MUNDO) leída de las mismas funciones que
  // dibujan la nave y el catálogo de proyectiles -- para que el e2e mida la
  // proporción de verdad en vez de copiar constantes a mano en el test.
  geometria?: {
    readonly naveLadoMayorDibujadoPx: number;
    readonly radioCascoColisionPx: number;
    readonly proyectilLadoMayorMaximoPx: number;
  };
  // nve-1, nve-3: fuerza la integridad de una nave sin jugar un turno real
  // -- aterrizar EXACTAMENTE en los tres tramos de daño a base de impactos
  // reales no es determinista de apuntar a mano (mismo motivo que
  // dispararEventoRoce/dispararEventoImpactoReal en contacto-honesto). Pasa
  // por el mismo refrescarNaves()/refrescarDebugNaves() que un turno real,
  // así que la silueta que resulta es la que produciría el juego de verdad,
  // no una vista aparte fabricada por el test.
  forzarIntegridad?: (nave: IdNave, integridad: number) => void;
  // arma-granada-espoleta (gra-2, gra-3): segundos restantes de la espoleta
  // en vuelo, en el mismo fotograma que el HUD -- null fuera de un vuelo
  // "mecha", para que el e2e sepa CUÁNDO está en mitad de la cuenta sin una
  // espera fija (issue #151) y sin tener que leer texto del DOM.
  cuentaAtrasMecha?: { segundosRestantes: number } | null;
  // arma-mina-adherente (min-2, min-3): posición de mundo (donde se pegó,
  // nunca la de pantalla) y segundos restantes de la mina en curso -- null
  // en cuanto no hay una mina adherida contando. A diferencia de
  // cuentaAtrasMecha (que arranca al disparar), este campo solo existe
  // DESDE que el proyectil se pega, no desde el disparo (min-5).
  cuentaAtrasAdherencia?: { x: number; y: number; segundosRestantes: number } | null;
  // adrian-angulo-360 (solo e2e): teletransporta una nave a una posición
  // exacta sin jugar un turno real -- mismo motivo y mismo patrón que
  // forzarIntegridad (pasa por refrescarNaves()/refrescarDebugNaves(), así
  // que lo que se ve es lo que produciría el juego de verdad). Solo tiene
  // efecto en el hito espacial (nave.y presente): en suelo plano la altura
  // se deriva siempre del terreno en esa columna y un y explícito no
  // significaría nada. Necesario para colocar al rival justo debajo del
  // tirador de forma determinista: colocarNaves no garantiza esa geometría
  // concreta y no hay forma de pedírsela por semilla.
  forzarPosicionNave?: (nave: IdNave, x: number, y: number) => void;
}

declare global {
  interface Window {
    __debug: DebugGlobal;
  }
}
