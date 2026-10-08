// Facilidad de acierto medida por arma, en porcentaje de combinaciones de
// la rejilla que causan daño (npm run medir:armas -> docs/facilidad-armas.md).
// Copia estática para que la pantalla de selección enseñe con qué criterio se
// fijó el precio sin arrastrar el arnés de medición (tests/utils) al bundle;
// tests/unit/economia/facilidad-medida.test.ts la compara con la medición viva
// para que no pueda quedarse vieja en silencio.
export const FACILIDAD_MEDIDA_PCT: Readonly<Record<string, number>> = {
  "pepinazo-cortesia": 2.4,
  "mortero-lamentable": 2.5,
  "zanjadora-manolita": 2.0,
  "vertedero-portatil": 0.0,
  "racimo-de-tuppers": 6.6,
  "petardo-de-feria": 1.5,
  "pelota-de-chatarra": 1.8,
  "graviton-segunda-mano": 0.0,
  "despedida": 3.2,
  "barrena-planetaria": 2.3,
  "rayo-laser": 0.9,
  "mosca-cojonera": 2.8,
  "granada-de-espoleta": 2.4,
  "gancho-pegajoso": 7.9,
  "minirobot-saltaplanetas": 2.2,
};
