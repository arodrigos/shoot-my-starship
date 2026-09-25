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
export type ComportamientoDeVuelo =
  | { readonly tipo: "impacto-simple" }
  | { readonly tipo: "submuniciones"; readonly cantidad: number; readonly dispersionPxS: number }
  | { readonly tipo: "rodante"; readonly distanciaMaximaPx: number; readonly pasoPx: number };

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
}
