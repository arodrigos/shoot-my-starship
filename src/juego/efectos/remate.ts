// Remate del golpe decisivo (rem-1..rem-7). Todo es presentación: el
// simulador ya resolvió el turno entero, así que nada de aquí toca src/sim ni
// su reloj, y el determinismo de las semillas queda intacto.

export type ModoRemate = "ninguno" | "destello" | "completo";
export type NombreFaseRemate = "destello" | "pausa" | "acercamiento" | "sosten" | "vuelta";

export interface EntradaRemate {
  readonly navesDestruidas: number;
  readonly finDePartida: boolean;
  readonly permiteMovimiento: boolean;
}

// `finDePartida` no cambia el modo: una partida solo acaba si cae una nave, y
// ese caso ya cuenta en `navesDestruidas`. Se conserva en la firma para que el
// llamador deje dicho que el cierre de partida también pasa por aquí.
export function decidirRemate(entrada: EntradaRemate): ModoRemate {
  if (entrada.navesDestruidas <= 0) return "ninguno";
  return entrada.permiteMovimiento ? "completo" : "destello";
}

export const DURACION_DESTELLO_REMATE_MS = 150;
export const ALFA_DESTELLO_REMATE = 0.5;
export const ZOOM_REMATE = 1.5;
// Si la máquina del remate no termina por sí sola, a partir de aquí se fuerza
// el fin: la partida nunca se queda congelada.
export const LIMITE_SEGURIDAD_REMATE_MS = 1200;

export interface FaseRemate {
  readonly nombre: NombreFaseRemate;
  readonly inicioMs: number;
  readonly finMs: number;
}

// El destello arranca junto con la pausa y acaba dentro de ella (150 ms de
// 200): sumadas una tras otra las fases darían 950 ms y el tope es 800.
const FASES_COMPLETO: readonly FaseRemate[] = [
  { nombre: "destello", inicioMs: 0, finMs: DURACION_DESTELLO_REMATE_MS },
  { nombre: "pausa", inicioMs: 0, finMs: 200 },
  { nombre: "acercamiento", inicioMs: 200, finMs: 400 },
  { nombre: "sosten", inicioMs: 400, finMs: 550 },
  { nombre: "vuelta", inicioMs: 550, finMs: 800 },
];

export function planRemate(modo: Exclude<ModoRemate, "ninguno">): readonly FaseRemate[] {
  return modo === "completo" ? FASES_COMPLETO : FASES_COMPLETO.slice(0, 1);
}

export function duracionPlan(plan: readonly FaseRemate[]): number {
  return plan.reduce((maximo, fase) => Math.max(maximo, fase.finMs), 0);
}

export interface Punto {
  readonly x: number;
  readonly y: number;
}

// Centro de la vista con zoom, recortado para que nunca enseñe nada fuera del
// mundo (impactos en bordes y esquinas incluidos).
export function centroDeZoom(impacto: Punto, mundoAncho: number, mundoAlto: number, zoom: number): Punto {
  const mitadX = mundoAncho / (2 * zoom);
  const mitadY = mundoAlto / (2 * zoom);
  return {
    x: Math.min(mundoAncho - mitadX, Math.max(mitadX, impacto.x)),
    y: Math.min(mundoAlto - mitadY, Math.max(mitadY, impacto.y)),
  };
}

export interface FotogramaRemate {
  readonly fase: NombreFaseRemate | null;
  readonly zoom: number;
  readonly centro: Punto;
  // Alfa del velo blanco del destello (0 fuera de esa fase).
  readonly alfaDestello: number;
  readonly congelado: boolean;
  readonly terminado: boolean;
}

const suave = (t: number): number => t * t * (3 - 2 * t);

// Reloj propio del remate, avanzado con el delta de la escena: así lo adelanta
// igual que adelanta el resto de la escena __debug.avanzarHastaTurnoHumano.
export class ControladorRemate {
  readonly plan: readonly FaseRemate[];
  readonly centroZoom: Punto;
  private transcurridoMs = 0;

  constructor(
    readonly modo: Exclude<ModoRemate, "ninguno">,
    private readonly centroEncuadreOriginal: Punto,
    impacto: Punto,
    mundoAncho: number,
    mundoAlto: number,
  ) {
    this.plan = planRemate(modo);
    this.centroZoom = centroDeZoom(impacto, mundoAncho, mundoAlto, ZOOM_REMATE);
  }

  get tiempoMs(): number {
    return this.transcurridoMs;
  }

  avanzar(deltaMs: number): FotogramaRemate {
    this.transcurridoMs += Math.max(0, deltaMs);
    return this.fotograma(this.transcurridoMs);
  }

  fotograma(t: number): FotogramaRemate {
    const total = duracionPlan(this.plan);
    const terminado = t >= total || t >= LIMITE_SEGURIDAD_REMATE_MS;
    // La fase "principal" es la que mueve la cámara; el destello va aparte.
    const fase = this.plan.find((f) => f.nombre !== "destello" && t < f.finMs) ?? null;
    const destello = this.plan.find((f) => f.nombre === "destello" && t < f.finMs);
    if (terminado || (!fase && !destello)) {
      return { fase: null, zoom: 1, centro: this.centroEncuadreOriginal, alfaDestello: 0, congelado: false, terminado: true };
    }
    const alfaDestello = destello ? ALFA_DESTELLO_REMATE * (1 - t / destello.finMs) : 0;
    if (!fase) return { fase: "destello", zoom: 1, centro: this.centroEncuadreOriginal, alfaDestello, congelado: false, terminado: false };
    const avance = (t - fase.inicioMs) / (fase.finMs - fase.inicioMs);
    let zoom = 1;
    let centro = this.centroEncuadreOriginal;
    if (fase.nombre === "acercamiento") {
      zoom = 1 + (ZOOM_REMATE - 1) * suave(avance);
      centro = mezclar(this.centroEncuadreOriginal, this.centroZoom, suave(avance));
    } else if (fase.nombre === "sosten") {
      zoom = ZOOM_REMATE;
      centro = this.centroZoom;
    } else if (fase.nombre === "vuelta") {
      zoom = ZOOM_REMATE - (ZOOM_REMATE - 1) * suave(avance);
      centro = mezclar(this.centroZoom, this.centroEncuadreOriginal, suave(avance));
    }
    return {
      fase: fase.nombre,
      zoom,
      centro,
      alfaDestello,
      congelado: fase.nombre === "pausa",
      terminado: false,
    };
  }
}

function mezclar(a: Punto, b: Punto, k: number): Punto {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

// Tope de destellos de cámara por segundo (WCAG 2.3.1): el registro de tiempos
// que expone __debug.remate se comprueba contra esta función.
export function maximoDestellosPorSegundo(tiemposMs: readonly number[]): number {
  const ordenados = [...tiemposMs].sort((a, b) => a - b);
  let maximo = 0;
  for (let i = 0; i < ordenados.length; i++) {
    let n = 0;
    for (let j = i; j < ordenados.length && ordenados[j] - ordenados[i] < 1000; j++) n++;
    maximo = Math.max(maximo, n);
  }
  return maximo;
}
