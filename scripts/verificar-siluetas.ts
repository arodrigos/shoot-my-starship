// arte-siluetas (arte-siluetas-1, arte-siluetas-3, arte-siluetas-4):
// sustituye a hashSilueta, que solo probaba que dos listas de puntos no
// fueran idénticas -- esto renderiza cada silueta al tamaño real que tiene
// en pantalla (con "canvas", ya en devDependencies) y compara por pares
// con pixelmatch, en color y en gris. Un hash no puede decir si dos formas
// se LEEN distintas; un recuento de píxeles sí.
import { createCanvas } from "canvas";
import pixelmatch from "pixelmatch";
import { CATALOGO_ARMAS } from "../src/sim/armas/catalogo";
import { puntosSilueta, familiaVisualDe, dimensionMayor, type PuntoProyectil } from "../src/juego/proyectiles/geometriaProyectil";
import { puntosCascoVariante, ANCHO_CASCO, ALTO_CASCO, type VarianteNave } from "../src/sim/naves/geometriaCasco";
import { puntosSenaNave } from "../src/juego/naves/senaNave";
import { COLORES_NAVE } from "../src/juego/naves/paletaNaves";

const UMBRAL_DIFERENCIA = 0.25;
const MARGEN_PX = 6;

function rasterizar(
  puntos: readonly { readonly x: number; readonly y: number }[],
  ancho: number,
  alto: number,
  colorHex: string,
): Uint8ClampedArray {
  const lienzo = createCanvas(ancho, alto);
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.translate(ancho / 2, alto / 2);
  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.moveTo(puntos[0].x, puntos[0].y);
  for (const p of puntos.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, ancho, alto).data;
}

// Dos siluetas pueden tener tamaños distintos (radios de catálogo
// distintos): se comparan dentro del mayor de los dos lienzos, ambas
// centradas, para que una silueta más pequeña no "gane" el pixelmatch solo
// por tener menos superficie que comparar.
function tamanoComunPara(...gruposDePuntos: (readonly PuntoProyectil[])[]): number {
  const maxDimension = Math.max(...gruposDePuntos.map((p) => dimensionMayor(p)));
  return Math.ceil(maxDimension) + MARGEN_PX * 2;
}

function enGris(datos: Uint8ClampedArray): Uint8ClampedArray {
  const gris = new Uint8ClampedArray(datos.length);
  for (let i = 0; i < datos.length; i += 4) {
    const luminancia = 0.299 * datos[i] + 0.587 * datos[i + 1] + 0.114 * datos[i + 2];
    gris[i] = gris[i + 1] = gris[i + 2] = luminancia;
    gris[i + 3] = datos[i + 3];
  }
  return gris;
}

// Cuenta cuántos píxeles del lienzo común no son fondo puro (negro): el
// lienzo común (tamanoComunPara) añade margen alrededor de la silueta más
// grande de cada par, así que la mayoría de sus píxeles son fondo
// compartido por las dos imágenes -- dividir por el lienzo ENTERO diluye
// cualquier diferencia real de forma con ese margen, que no aporta nada a
// "¿se leen distintas estas dos siluetas?". Lo que importa es qué fracción
// de la zona que ALGUNA de las dos ocupa, difiere entre ambas.
function esFondo(datos: Uint8ClampedArray, indice: number): boolean {
  return datos[indice] < 10 && datos[indice + 1] < 10 && datos[indice + 2] < 10;
}

function fraccionDistinta(a: Uint8ClampedArray, b: Uint8ClampedArray, ancho: number, alto: number): number {
  // includeAA:true es obligatorio aquí -- el arte de este bloque es de dos
  // colores planos (fondo + relleno), y el detector de antialiasing de
  // pixelmatch (pensado para capturas de pantalla reales) confunde el
  // borde de UNA silueta con "antialiasing" y lo ignora aunque la otra
  // imagen no tenga nada en esas coordenadas -- con el detector activado
  // (el comportamiento por defecto) dos siluetas con contornos distintos
  // pero el mismo par de colores podían salir con una diferencia cercana a
  // 0%, que es exactamente lo que pasó en la primera pasada de este arnés.
  const diferentes = pixelmatch(a, b, undefined, ancho, alto, { threshold: 0.1, includeAA: true });
  let ocupados = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (!esFondo(a, i) || !esFondo(b, i)) ocupados++;
  }
  return diferentes / Math.max(1, ocupados);
}

interface Fallo {
  readonly descripcion: string;
  readonly fraccion: number;
}

function compararParArmas(a: (typeof CATALOGO_ARMAS)[number], b: (typeof CATALOGO_ARMAS)[number]): Fallo | null {
  const puntosA = puntosSilueta(a);
  const puntosB = puntosSilueta(b);
  const lado = tamanoComunPara(puntosA, puntosB);
  const colorArma = "#ffe08a"; // COLOR_PROYECTIL real (AnimadorProyectil.ts): mismo color para toda arma -- la
  // forma es la única diferenciadora, así que la comparación en gris reutiliza el mismo render.
  const rasterA = rasterizar(puntosA, lado, lado, colorArma);
  const rasterB = rasterizar(puntosB, lado, lado, colorArma);
  const fraccion = fraccionDistinta(rasterA, rasterB, lado, lado);
  const fraccionGris = fraccionDistinta(enGris(rasterA), enGris(rasterB), lado, lado);
  const peor = Math.min(fraccion, fraccionGris);
  if (peor < UMBRAL_DIFERENCIA) {
    return { descripcion: `${a.id} vs ${b.id} (familia ${familiaVisualDe(a)})`, fraccion: peor };
  }
  return null;
}

function compararArmasPorFamilia(): Fallo[] {
  const porFamilia = new Map<string, (typeof CATALOGO_ARMAS)[number][]>();
  for (const arma of CATALOGO_ARMAS) {
    const familia = familiaVisualDe(arma);
    porFamilia.set(familia, [...(porFamilia.get(familia) ?? []), arma]);
  }
  const fallos: Fallo[] = [];
  for (const armas of porFamilia.values()) {
    for (let i = 0; i < armas.length; i++) {
      for (let j = i + 1; j < armas.length; j++) {
        const fallo = compararParArmas(armas[i], armas[j]);
        if (fallo) fallos.push(fallo);
      }
    }
  }
  return fallos;
}

// arte-siluetas-3/4: las cuatro variantes de casco (con su seña e
// indicador de color real), aunque solo las variantes 0 y 1 estén en juego
// hoy -- nucleo-n-naves activará las otras dos sin tener que volver a este
// arnés.
function rasterizarNave(variante: VarianteNave): Uint8ClampedArray {
  const lado = Math.ceil(Math.max(ANCHO_CASCO, ALTO_CASCO)) + MARGEN_PX * 2;
  const lienzo = createCanvas(lado, lado);
  const ctx = lienzo.getContext("2d");
  // node-canvas antialiasea los bordes del polígono por defecto, mezclando
  // el color del casco con el fondo en una banda continua de tonos
  // intermedios -- arte-siluetas-4 cuenta colores DE DISEÑO (casco, seña,
  // daño), no artefactos de rasterizado, así que aquí se desactiva: es la
  // misma razón por la que "none" (y no "gray"/"subpixel") es la opción
  // correcta para contar colores exactos, no para que el borde se vea
  // bonito en pantalla.
  ctx.antialias = "none";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, lado, lado);
  ctx.translate(lado / 2, lado / 2);

  const dibujarPoligono = (puntos: readonly PuntoProyectil[], colorHex: string) => {
    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, puntos[0].y);
    for (const p of puntos.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
  };

  const colorHex = `#${COLORES_NAVE[variante].toString(16).padStart(6, "0")}`;
  dibujarPoligono(puntosCascoVariante(variante, 1), colorHex);
  dibujarPoligono(puntosSenaNave(variante, 1, ANCHO_CASCO, ALTO_CASCO), "#ffffff");
  return ctx.getImageData(0, 0, lado, lado).data;
}

function compararNaves(): Fallo[] {
  const variantes: readonly VarianteNave[] = [0, 1, 2, 3];
  const rasteres = variantes.map((v) => rasterizarNave(v));
  const lado = Math.ceil(Math.max(ANCHO_CASCO, ALTO_CASCO)) + MARGEN_PX * 2;
  const fallos: Fallo[] = [];
  for (let i = 0; i < variantes.length; i++) {
    for (let j = i + 1; j < variantes.length; j++) {
      const fraccion = fraccionDistinta(rasteres[i], rasteres[j], lado, lado);
      const fraccionGris = fraccionDistinta(enGris(rasteres[i]), enGris(rasteres[j]), lado, lado);
      const peor = Math.min(fraccion, fraccionGris);
      if (peor < UMBRAL_DIFERENCIA) {
        fallos.push({ descripcion: `nave ${variantes[i]} vs nave ${variantes[j]}`, fraccion: peor });
      }
    }
  }
  return fallos;
}

// arte-siluetas-4: cuenta de colores por silueta de nave -- simplificación
// declarada (ver desviaciones del entregable): se cuenta sobre un render a
// opacidad plena (sin el alfa parcial que sí usa Nave.ts fuera del núcleo,
// esc-5), porque lo que decide esc-5 es la JERARQUÍA de opacidad, no el
// número de colores -- mezclar las dos cosas aquí habría exigido
// reproducir ese alfa-blend contra un fondo arbitrario sin que el criterio
// (no camino_critico) lo pida.
function contarColores(variante: VarianteNave): Set<string> {
  const datos = rasterizarNave(variante);
  const colores = new Set<string>();
  for (let i = 0; i < datos.length; i += 4) {
    if (datos[i + 3] === 0) continue; // transparente/fondo no cuenta como color de la silueta
    colores.add(`${datos[i]},${datos[i + 1]},${datos[i + 2]}`);
  }
  return colores;
}

function main(): void {
  const fallos: string[] = [];

  const fallosArmas = compararArmasPorFamilia();
  for (const f of fallosArmas) {
    fallos.push(`arte-siluetas-1: ${f.descripcion} solo difieren en el ${(f.fraccion * 100).toFixed(1)}% de los píxeles (umbral ${UMBRAL_DIFERENCIA * 100}%)`);
  }

  const fallosNaves = compararNaves();
  for (const f of fallosNaves) {
    fallos.push(`arte-siluetas-3: ${f.descripcion} solo difieren en el ${(f.fraccion * 100).toFixed(1)}% de los píxeles (umbral ${UMBRAL_DIFERENCIA * 100}%)`);
  }

  const variantes: readonly VarianteNave[] = [0, 1, 2, 3];
  for (const v of variantes) {
    const colores = contarColores(v);
    // El negro de fondo (#000000) nunca forma parte de la silueta en este
    // render (fillRect inicial): si aparece en el set es porque el fondo
    // quedó expuesto dentro del contorno, no un color "de la nave" --
    // igualmente se cuenta, porque un hueco real en la silueta también
    // cuenta como un tramo visual más que distinguir.
    if (colores.size > 5) {
      fallos.push(`arte-siluetas-4: nave ${v} usa ${colores.size} colores (máximo 5)`);
    }
  }

  if (fallos.length > 0) {
    console.error("verificar:siluetas -- huecos encontrados:");
    for (const f of fallos) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    `OK: ${CATALOGO_ARMAS.length} armas distinguibles por familia visual, 4 naves distinguibles por forma (color y gris), ninguna nave con más de 5 colores.`,
  );
}

main();
