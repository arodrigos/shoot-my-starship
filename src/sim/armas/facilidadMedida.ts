// Facilidad de acierto medida por arma, en porcentaje de combinaciones de
// la rejilla que causan daño (npm run medir:armas -> docs/facilidad-armas.md).
// Copia estática para que la pantalla de selección enseñe con qué criterio se
// fijó el precio sin arrastrar el arnés de medición (tests/utils) al bundle;
// tests/unit/economia/facilidad-medida.test.ts la compara con la medición viva
// para que no pueda quedarse vieja en silencio.
export const FACILIDAD_MEDIDA_PCT: Readonly<Record<string, number>> = {
  "pepinazo-cortesia": 3.1,
  "mortero-lamentable": 3.3,
  "zanjadora-manolita": 2.3,
  "vertedero-portatil": 0.0,
  "racimo-de-tuppers": 6.6,
  "petardo-de-feria": 2.1,
  "pelota-de-chatarra": 2.3,
  "graviton-segunda-mano": 0.0,
  "despedida": 4.5,
  "barrena-planetaria": 2.7,
  "rayo-laser": 1.2,
  "mosca-cojonera": 3.3,
  "granada-de-espoleta": 3.2,
  "gancho-pegajoso": 8.5,
  "minirobot-saltaplanetas": 2.6,
};
