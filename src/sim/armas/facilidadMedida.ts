// Facilidad de acierto medida por arma, en porcentaje de combinaciones de
// la rejilla que causan daño (npm run medir:armas -> docs/facilidad-armas.md).
// Copia estática para que la pantalla de selección enseñe con qué criterio se
// fijó el precio sin arrastrar el arnés de medición (tests/utils) al bundle;
// tests/unit/economia/facilidad-medida.test.ts la compara con la medición viva
// para que no pueda quedarse vieja en silencio.
export const FACILIDAD_MEDIDA_PCT: Readonly<Record<string, number>> = {
  "pepinazo-cortesia": 2.6,
  "mortero-lamentable": 2.8,
  "zanjadora-manolita": 2.5,
  "vertedero-portatil": 0.0,
  "racimo-de-tuppers": 2.5,
  "petardo-de-feria": 2.2,
  "pelota-de-chatarra": 2.4,
  "graviton-segunda-mano": 0.0,
  "despedida": 3.3,
  "barrena-planetaria": 2.5,
  "rayo-laser": 0.8,
  "mosca-cojonera": 2.9,
  "granada-de-espoleta": 2.7,
  "gancho-pegajoso": 6.9,
  "minirobot-saltaplanetas": 2.4,
};
