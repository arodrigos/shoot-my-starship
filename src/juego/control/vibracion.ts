// Política pura de la vibración del móvil: sin DOM ni navigator, para poder
// probarla con cualquier entrada. El store (vibracionStore.ts) le da el contexto.

export type TipoVibracion = "disparo" | "impacto" | "remate" | "prueba";

// La API solo controla la duración, no la intensidad. Todos los patrones
// empiezan y acaban vibrando y suman 200 ms o menos para no molestar.
export const PATRONES_VIBRACION: Readonly<Record<TipoVibracion, readonly number[]>> = {
  disparo: [15],
  impacto: [25, 40, 25],
  remate: [50, 40, 90],
  prueba: [15],
};

// Un Racimo de Tuppers alcanza con varios perdigones casi a la vez: una sola
// vibración por ventana, no un zumbido.
export const INTERVALO_MINIMO_IMPACTO_MS = 250;

export interface ContextoVibracion {
  readonly soportada: boolean;
  readonly preferencia: boolean;
  readonly movimientoReducido: boolean;
  readonly documentoVisible: boolean;
  readonly enMedicion: boolean;
  readonly ultimoImpactoMs: number | null;
}

export type MotivoApagada = "no-soportada" | "movimiento-reducido" | "preferencia" | null;

export function decidirVibracion(ctx: ContextoVibracion, tipo: TipoVibracion, ahoraMs: number): readonly number[] | null {
  if (!ctx.soportada || !ctx.preferencia || ctx.movimientoReducido || !ctx.documentoVisible) return null;
  // La prueba del interruptor sí vale durante una medición: la pide un toque.
  if (ctx.enMedicion && tipo !== "prueba") return null;
  if (tipo === "impacto" && ctx.ultimoImpactoMs !== null && ahoraMs - ctx.ultimoImpactoMs < INTERVALO_MINIMO_IMPACTO_MS) return null;
  return PATRONES_VIBRACION[tipo];
}

export function motivoApagada(ctx: Pick<ContextoVibracion, "soportada" | "movimientoReducido" | "preferencia">): MotivoApagada {
  if (!ctx.soportada) return "no-soportada";
  if (ctx.movimientoReducido) return "movimiento-reducido";
  if (!ctx.preferencia) return "preferencia";
  return null;
}
