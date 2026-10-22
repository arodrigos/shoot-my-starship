// Un único sitio para el destino de los tests de navegador. El localStorage
// que siembra storageState solo se aplica si su origen coincide con el de la
// página: con el origen local escrito a mano en cada fichero, un BASE_URL
// apuntando a otro sitio dejaba eventos, muerte súbita y partida guardada
// encendidos sin que ningún test lo dijera.

export const PUERTO_LOCAL = 3000;
export const ORIGEN_LOCAL = `http://127.0.0.1:${PUERTO_LOCAL}`;

// Vacío cuenta como ausente: `new URL("")` lanzaría al cargar la config.
export const BASE_URL_EXTERNA = process.env.BASE_URL || undefined;

export const BASE_URL = BASE_URL_EXTERNA ?? ORIGEN_LOCAL;

// baseURL puede llevar ruta; storageState solo admite el origen.
export const ORIGEN_PRUEBAS = new URL(BASE_URL).origin;
