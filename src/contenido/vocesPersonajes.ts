import type { IdVoz } from "@/contenido/bancoBromas";

// voz-resumenes: velocidad normal (0,9 a 1,0) y tonos casi neutros; antes
// Chispa leía a 1,15 y no daba tiempo a entenderla. Origen: voz-chistes (voz-5): los tres personajes comparten la misma voz del sistema
// y se distinguen solo por velocidad y tono. Así un chiste nuevo en el banco
// ya tiene voz sin ningún fichero de audio (ACTIVOS.md los prohíbe).
export interface TimbreVoz {
  readonly rate: number;
  readonly pitch: number;
}

export const TIMBRE_POR_VOZ: Readonly<Record<IdVoz, TimbreVoz>> = {
  // Seca y mesurada: algo más lenta y grave, como quien lee un balance.
  "la-contable": { rate: 0.9, pitch: 0.95 },
  // Grandilocuente: pausado y de pecho.
  "almirante-bisagra": { rate: 1, pitch: 1 },
  // Nerviosa: algo más aguda, sin acelerar.
  chispa: { rate: 0.95, pitch: 1.1 },
};
