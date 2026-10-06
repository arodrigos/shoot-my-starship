// Facilidad de acierto medida por arma, en porcentaje de combinaciones de
// la rejilla que causan daño (npm run medir:armas -> docs/facilidad-armas.md).
// Copia estática para que la pantalla de selección enseñe con qué criterio se
// fijó el precio sin arrastrar el arnés de medición (tests/utils) al bundle;
// tests/unit/economia/facilidad-medida.test.ts la compara con la medición viva
// para que no pueda quedarse vieja en silencio.
export const FACILIDAD_MEDIDA_PCT: Readonly<Record<string, number>> = {
  "pepinazo-cortesia": 2.8,
  "mortero-lamentable": 2.8,
  "zanjadora-manolita": 2.4,
  "vertedero-portatil": 0.0,
  "racimo-de-tuppers": 5.8,
  "petardo-de-feria": 1.9,
  "pelota-de-chatarra": 2.2,
  "graviton-segunda-mano": 0.0,
  "despedida": 3.5,
  "barrena-planetaria": 2.8,
  "rayo-laser": 1.1,
  "mosca-cojonera": 3.2,
  "granada-de-espoleta": 2.8,
  "gancho-pegajoso": 8.1,
};
