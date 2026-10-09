import type { IdVoz } from "@/contenido/bancoBromas";

// voz-chistes (voz-5): los tres personajes comparten la misma voz del sistema
// y se distinguen solo por velocidad y tono. Así un chiste nuevo en el banco
// ya tiene voz sin ningún fichero de audio (ACTIVOS.md los prohíbe).
export interface TimbreVoz {
  readonly rate: number;
  readonly pitch: number;
}

export const TIMBRE_POR_VOZ: Readonly<Record<IdVoz, TimbreVoz>> = {
  // Seca y mesurada: lenta y grave, como quien lee un balance.
  "la-contable": { rate: 0.92, pitch: 0.85 },
  // Grandilocuente: pausado y de pecho.
  "almirante-bisagra": { rate: 0.98, pitch: 0.95 },
  // Nerviosa y aguda.
  chispa: { rate: 1.15, pitch: 1.35 },
};
