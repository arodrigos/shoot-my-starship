// El catálogo es de datos, no de código (criterio armas-1): añadir un arma
// nueva es añadir una entrada de este tipo al catálogo, nunca escribir un
// módulo o una rama de código específica de esa arma. El resolutor
// (resolver.ts) es genérico sobre estos cinco ejes y no conoce ningún id de
// arma en particular.
export type SignoHuella = "restar" | "sumar";

// Eje 1 (trayectoria) y eje 4 (momento): cómo se comporta el proyectil
// además de la parábola común a todas las armas. "impacto-simple" es la
// mayoría del catálogo; las otras dos variantes son las que el research
// marca como lo que convierte "variedad" en real y no solo nominal.
// armas-nuevas: "instantaneo" es el Rayo Láser -- recorre una línea recta
// (gravedad 0, sin planetas) en vez de una parábola, que es justo lo que
// significa "inmune a la gravedad" en términos de vuelo. Reutiliza
// simularVuelo con gravedad/deriva forzadas a 0 en vez de escribir un
// trazador de rayos aparte: sigue siendo el mismo oráculo de vuelo para
// todas las armas.
export type ComportamientoDeVuelo =
  | { readonly tipo: "impacto-simple" }
  | { readonly tipo: "submuniciones"; readonly cantidad: number; readonly dispersionPxS: number }
  | { readonly tipo: "rodante"; readonly distanciaMaximaPx: number; readonly pasoPx: number }
  | { readonly tipo: "instantaneo" };

// Eje 2 (huella en el terreno): la forma que deja en la máscara. "circular"
// cubre cráter y relleno según el signo; "capsula" es la excavación alargada
// de la Zanjadora Manolita (armas-3: al menos 3 veces más ancha que alta);
// "ninguna" es el Gravitón, que no toca la máscara -- su efecto es sobre la
// nave, no sobre el terreno, y declararlo así evita escribir un radio 0 que
// sí tocaría un píxel.
export type HuellaDeArma =
  | { readonly tipo: "circular"; readonly radio: number; readonly signo: SignoHuella }
  | { readonly tipo: "capsula"; readonly medioLargoPx: number; readonly radio: number; readonly signo: SignoHuella }
  | { readonly tipo: "ninguna" };

// Eje 3 (efecto sobre la nave). "danio" es el perfil habitual (caída lineal
// con la distancia); "empuje" es el Gravitón (cero daño, desplazamiento
// lateral); "danio-y-autodanio" es Despedida (daño al objetivo Y a quien
// dispara).
export type EfectoSobreNave =
  | { readonly tipo: "danio"; readonly radioEfectoPx: number; readonly danioMaximo: number }
  | { readonly tipo: "empuje"; readonly desplazamientoPx: number }
  | {
      readonly tipo: "danio-y-autodanio";
      readonly radioEfectoPx: number;
      readonly danioMaximo: number;
      readonly autoDanioMaximo: number;
      readonly radioAutoHuellaPx: number;
    };

export interface Arma {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly comportamiento: ComportamientoDeVuelo;
  readonly huella: HuellaDeArma;
  readonly efecto: EfectoSobreNave;
  // Eje 5 (fiabilidad): probabilidad de que el arma funcione como se
  // declara. 1 para el catálogo entero salvo el Petardo de Feria (armas-6).
  readonly fiabilidad: number;
  // Usos totales por partida (control-apuntado, control-6): ausente en el
  // resto del catálogo porque no tienen límite. resolverDisparo no la lee
  // -- el límite se aplica en la cáscara (el selector de arma), no en el
  // núcleo, porque "cuántos usos lleva cada arma" es memoria de partida
  // (partida-completa), no una propiedad de un disparo individual.
  readonly usosMaximos?: number;
  // armas-nuevas: los seis ejes nuevos del catálogo, todos opcionales y
  // aditivos (mismo patrón que usosMaximos u origenY en otros ficheros) --
  // un arma que no los declara se comporta exactamente como antes de este
  // bloque, sin tocar ARMA_DE_PRUEBA de armas-1 ni ningún otro fixture
  // previo. resolver.ts los lee con `?? valorPorDefecto`, nunca con un id.
  //
  // Precio en el modo con presupuesto; 0 o ausente es "gratis siempre".
  readonly coste?: number;
  // Distancia máxima, en píxeles de sólido recorrido, que el proyectil
  // atraviesa antes de detonar -- 0 o ausente es "detona en la superficie",
  // el comportamiento de todo el catálogo anterior a este bloque.
  readonly penetracionPx?: number;
  // Dispersión angular máxima (grados, +/-) añadida al ángulo de disparo
  // mediante el mismo EstadoAleatorio hilvanado que la tirada de fiabilidad
  // -- nunca el azar no determinista del lenguaje (nucleo-4). 0 o ausente
  // es "sale exactamente al ángulo pedido", el comportamiento de siempre.
  readonly dispersionGrados?: number;
  // Ráfaga: varios proyectiles idénticos repartidos en abanico alrededor
  // del ángulo pedido. Ausente o cantidad 1 es un disparo único de siempre.
  readonly disparosSimultaneos?: { readonly cantidad: number; readonly aperturaGrados: number };
  // true solo en el Rayo Láser: además de comportamiento "instantaneo",
  // declara explícitamente el eje para que arm-2 pueda contar sus valores
  // sin inferirlo del tipo de comportamiento.
  readonly inmuneAGravedad?: boolean;
}
