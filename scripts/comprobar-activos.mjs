#!/usr/bin/env node
// cie-3: la única amenaza legal declarada del producto (ver ACTIVOS.md) es
// que aparezca un activo externo con licencia. Este guardia hace mecánica
// la comprobación que hoy se hacía a mano contra la API de GitHub: falla si
// aparece un fichero binario de imagen/audio/fuente en src/ o public/, o si
// el código referencia una URL externa típica de activos (CDN de fuentes,
// de imágenes, next/font). Es intencionadamente mecánico -- lo mismo que
// terreno-6/cie-5, un guardia sin caso negativo que "parece proteger" es
// justo el fallo que este bloque ya encontró una vez en otro guardia.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const EXTENSIONES_BINARIAS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".ico",
  ".svg",
  ".mp3",
  ".wav",
  ".ogg",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
];

// Dominios habituales de activos externos con licencia (fuentes, imágenes,
// CDNs) más el propio mecanismo de next/font, que descarga fuentes en build.
const PATRONES_URL_EXTERNA = [
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /next\/font/,
  /unpkg\.com/,
  /cdnjs\.cloudflare\.com/,
  /jsdelivr\.net/,
  /imgur\.com/,
  /cloudinary\.com/,
  /https?:\/\/[^\s"'`)]+\.(png|jpe?g|gif|webp|avif|svg|mp3|wav|ogg|ttf|otf|woff2?)/i,
];

const DIRECTORIOS_A_REVISAR = ["src", "public"];

async function todosLosFicheros(directorio) {
  const entradas = await readdir(directorio, { withFileTypes: true }).catch(() => []);
  const resultados = [];
  for (const entrada of entradas) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      resultados.push(...(await todosLosFicheros(ruta)));
    } else {
      resultados.push(ruta);
    }
  }
  return resultados;
}

const EXTENSIONES_DE_TEXTO = new Set([".ts", ".tsx", ".css", ".mjs", ".js", ".json"]);

export async function encontrarInfracciones(raiz, directorios = DIRECTORIOS_A_REVISAR) {
  const infracciones = [];

  for (const directorio of directorios) {
    const ficheros = await todosLosFicheros(path.join(raiz, directorio));
    for (const fichero of ficheros) {
      const relativo = path.relative(raiz, fichero).split(path.sep).join("/");
      const ext = path.extname(fichero).toLowerCase();

      if (EXTENSIONES_BINARIAS.includes(ext)) {
        infracciones.push(`${relativo}: activo binario (${ext}) -- todo gráfico tiene que ser procedimental`);
        continue;
      }

      if (!EXTENSIONES_DE_TEXTO.has(ext)) {
        continue;
      }

      const contenido = await readFile(fichero, "utf8").catch(() => "");
      for (const patron of PATRONES_URL_EXTERNA) {
        const coincidencia = contenido.match(patron);
        if (coincidencia) {
          infracciones.push(`${relativo}: referencia una URL/mecanismo de activo externo (${coincidencia[0]})`);
        }
      }
    }
  }

  return infracciones;
}

async function main() {
  const infracciones = await encontrarInfracciones(process.cwd());

  if (infracciones.length > 0) {
    console.error("Activos externos detectados (ver ACTIVOS.md, cie-3):");
    for (const linea of infracciones) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  console.log("OK: ningún activo binario ni URL externa de activos en src/ o public/ (cie-3).");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
