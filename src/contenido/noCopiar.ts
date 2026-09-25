// Lector de no-copiar.md (armas-5): el fichero es la fuente de verdad legal
// del riesgo de nombres, no un dato de sim ni de render, así que vive fuera
// de las dos fronteras que ya vigilan los scripts de comprobación. Esto es
// contenido/proceso, no física ni catálogo de juego.
export interface ListaNoCopiar {
  readonly generoArtilleria: readonly string[];
  readonly franquiciasCienciaFiccion: readonly string[];
}

const ENCABEZADO_GENERO = "## Género de artillería";
const ENCABEZADO_FRANQUICIAS = "## Franquicias de ciencia ficción";

function extraerEntradas(markdown: string, encabezado: string): string[] {
  const inicio = markdown.indexOf(encabezado);
  if (inicio === -1) {
    return [];
  }
  const desdeEncabezado = markdown.slice(inicio + encabezado.length);
  // La sección termina en el siguiente "## " o en el final del fichero.
  const finRelativo = desdeEncabezado.indexOf("\n## ");
  const cuerpo = finRelativo === -1 ? desdeEncabezado : desdeEncabezado.slice(0, finRelativo);

  return cuerpo
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea.startsWith("- "))
    .map((linea) => linea.slice(2).trim())
    .filter((entrada) => entrada.length > 0);
}

// Falla explícitamente (devuelve listas vacías) si falta cualquiera de las
// dos secciones en vez de tratarlo como "no hay nada que comprobar": un
// fichero vacío o con una sola sección no debe pasar armas-5 en verde por
// no encontrar nada que comparar.
export function analizarNoCopiar(markdown: string): ListaNoCopiar {
  return {
    generoArtilleria: extraerEntradas(markdown, ENCABEZADO_GENERO),
    franquiciasCienciaFiccion: extraerEntradas(markdown, ENCABEZADO_FRANQUICIAS),
  };
}

// Normalización exigida por el criterio: minúsculas, sin acentos, sin
// signos de puntuación, espacios colapsados. Es la misma función para las
// entradas de no-copiar.md y para el material propio -- si divergieran, un
// acento de más bastaría para esconder una coincidencia real.
export function normalizar(cadena: string): string {
  return cadena
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ColisionNoCopiar {
  readonly cadenaPropia: string;
  readonly entradaProhibida: string;
}

// Coincidencia por substring normalizado en cualquiera de las dos
// direcciones: cubre tanto "la descripción menciona el nombre prohibido
// entero" como "el nombre propio es literalmente una entrada prohibida",
// sin exigir igualdad exacta de toda la cadena.
export function buscarColisiones(cadenasPropias: readonly string[], lista: ListaNoCopiar): ColisionNoCopiar[] {
  const entradasProhibidas = [...lista.generoArtilleria, ...lista.franquiciasCienciaFiccion];
  const colisiones: ColisionNoCopiar[] = [];

  for (const cadenaPropia of cadenasPropias) {
    const normalizadaPropia = normalizar(cadenaPropia);
    for (const entradaProhibida of entradasProhibidas) {
      const normalizadaProhibida = normalizar(entradaProhibida);
      if (normalizadaProhibida.length === 0) continue;
      if (normalizadaPropia.includes(normalizadaProhibida) || normalizadaProhibida.includes(normalizadaPropia)) {
        colisiones.push({ cadenaPropia, entradaProhibida });
      }
    }
  }
  return colisiones;
}
