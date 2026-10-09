// Facilidad de acierto medida por arma, en porcentaje de combinaciones de
// la rejilla que causan daño (npm run medir:armas -> docs/facilidad-armas.md).
// Copia estática para que la pantalla de selección enseñe con qué criterio se
// fijó el precio sin arrastrar el arnés de medición (tests/utils) al bundle;
// tests/unit/economia/facilidad-medida.test.ts la compara con la medición viva
// para que no pueda quedarse vieja en silencio.
export const FACILIDAD_MEDIDA_PCT: Readonly<Record<string, number>> = {
  "pepinazo-cortesia": 2.2,
  "mortero-lamentable": 2.4,
  "zanjadora-manolita": 2.1,
  "vertedero-portatil": 0.0,
  "racimo-de-tuppers": 2.4,
  "petardo-de-feria": 1.7,
  "pelota-de-chatarra": 1.9,
  "graviton-segunda-mano": 0.0,
  "despedida": 2.9,
  "barrena-planetaria": 2.0,
  "rayo-laser": 1.1,
  "mosca-cojonera": 2.3,
  "granada-de-espoleta": 2.3,
  "gancho-pegajoso": 8.1,
  "minirobot-saltaplanetas": 2.0,
};
