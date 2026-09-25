#!/usr/bin/env node
// terreno-6: getImageData y putImageData no pueden aparecer en el camino de
// colisión del juego. El núcleo (src/sim) no debe tocarlas NUNCA, ni
// siquiera en su propia generación, porque no importa nada de canvas. La
// cáscara de terreno (src/juego/terreno) solo tiene permiso en dos sitios
// declarados explícitamente abajo: el pintado inicial completo del mapa
// (una pasada única, nunca por impacto) y el puente de depuración que usan
// los tests de Playwright (que no es camino de juego real). Es mecánico a
// propósito -- el research marca la desincronización máscara/textura como
// un fallo de arquitectura que ninguna micro-optimización salva.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const PROHIBIDAS = ["getImageData", "putImageData"];

const LISTA_BLANCA = new Set([
  // Pintado inicial completo de la máscara (pintarCompleta): una pasada
  // única al generar el mapa, nunca en el camino de refresco por impacto
  // (refrescarRectangulo, en el mismo fichero, que solo usa fillRect y
  // clearRect).
  "src/juego/terreno/SuperficieCanvasPhaser.ts",
  // Puente de depuración para Playwright (comprobarPuntos): una sola
  // lectura del lienzo por lote de puntos, nunca en el camino de colisión
  // del juego real.
  "src/juego/depuracion/exponerTerreno.ts",
]);

const DIRECTORIOS_A_REVISAR = ["src/sim", "src/juego/terreno", "src/juego/depuracion", "src/juego/scenes"];

async function ficherosTypeScript(directorio) {
  const entradas = await readdir(directorio, { withFileTypes: true }).catch(() => []);
  const resultados = [];
  for (const entrada of entradas) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      resultados.push(...(await ficherosTypeScript(ruta)));
    } else if (entrada.name.endsWith(".ts") || entrada.name.endsWith(".tsx")) {
      resultados.push(ruta);
    }
  }
  return resultados;
}

async function main() {
  const raiz = process.cwd();
  const infracciones = [];

  for (const directorio of DIRECTORIOS_A_REVISAR) {
    const ficheros = await ficherosTypeScript(path.join(raiz, directorio));
    for (const fichero of ficheros) {
      const relativo = path.relative(raiz, fichero).split(path.sep).join("/");
      if (LISTA_BLANCA.has(relativo)) {
        continue;
      }
      const contenido = await readFile(fichero, "utf8");
      for (const prohibida of PROHIBIDAS) {
        if (contenido.includes(prohibida)) {
          infracciones.push(`${relativo}: usa ${prohibida}, fuera de la lista blanca`);
        }
      }
    }
  }

  if (infracciones.length > 0) {
    console.error("Lectura/escritura de canvas fuera del camino permitido:");
    for (const linea of infracciones) {
      console.error(`  - ${linea}`);
    }
    process.exit(1);
  }

  console.log("OK: sin getImageData/putImageData fuera de la lista blanca (terreno-6).");
}

main();
