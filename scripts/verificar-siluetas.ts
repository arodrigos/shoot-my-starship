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
import { puntosCascoConDanio, ANCHO_CASCO, ALTO_CASCO, type NivelDanio, type VarianteNave } from "../src/sim/naves/geometriaCasco";
import { dentroDelPoligono } from "../src/sim/naves/contacto";
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

// naves-silueta: la cáscara dibuja el MISMO polígono que usa el núcleo
// (puntosCascoConDanio), así que se rasteriza con la rutina de dibujo de la
// nave (relleno del polígono, sin antialias) y se compara, píxel a píxel de
// una rejilla de 1 u, con dentroDelPoligono: lo visible y lo que colisiona
// tienen que coincidir. Lo que falte hasta el 100 % es el borde del trazado.
const NIVELES: readonly NivelDanio[] = ["alta", "media", "baja"];
const COINCIDENCIA_MINIMA = 0.995;
const LADO_RASTER = Math.ceil(Math.max(ANCHO_CASCO, ALTO_CASCO)) + MARGEN_PX * 2;

function rasterizarNave(variante: VarianteNave, nivel: NivelDanio): Uint8ClampedArray {
  const lienzo = createCanvas(LADO_RASTER, LADO_RASTER);
  const ctx = lienzo.getContext("2d");
  ctx.antialias = "none";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, LADO_RASTER, LADO_RASTER);
  ctx.translate(LADO_RASTER / 2, LADO_RASTER / 2);
  const puntos = puntosCascoConDanio(1, nivel, variante);
  ctx.fillStyle = `#${COLORES_NAVE[variante].toString(16).padStart(6, "0")}`;
  ctx.beginPath();
  ctx.moveTo(puntos[0].x, puntos[0].y);
  for (const p of puntos.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, LADO_RASTER, LADO_RASTER).data;
}

function coincidenciaConNucleo(variante: VarianteNave, nivel: NivelDanio): number {
  const datos = rasterizarNave(variante, nivel);
  const puntos = puntosCascoConDanio(1, nivel, variante);
  let coinciden = 0;
  for (let py = 0; py < LADO_RASTER; py++) {
    for (let px = 0; px < LADO_RASTER; px++) {
      const dibujado = !esFondo(datos, (py * LADO_RASTER + px) * 4);
      const x = px + 0.5 - LADO_RASTER / 2;
      const y = py + 0.5 - LADO_RASTER / 2;
      if (dibujado === dentroDelPoligono(x, y, puntos)) coinciden++;
    }
  }
  return coinciden / (LADO_RASTER * LADO_RASTER);
}

function compararNaves(): Fallo[] {
  const variantes: readonly VarianteNave[] = [0, 1, 2, 3];
  const rasteres = variantes.map((v) => rasterizarNave(v, "alta"));
  const fallos: Fallo[] = [];
  for (let i = 0; i < variantes.length; i++) {
    for (let j = i + 1; j < variantes.length; j++) {
      const fraccion = fraccionDistinta(rasteres[i], rasteres[j], LADO_RASTER, LADO_RASTER);
      const fraccionGris = fraccionDistinta(enGris(rasteres[i]), enGris(rasteres[j]), LADO_RASTER, LADO_RASTER);
      const peor = Math.min(fraccion, fraccionGris);
      if (peor < UMBRAL_DIFERENCIA) {
        fallos.push({ descripcion: `nave ${variantes[i]} vs nave ${variantes[j]}`, fraccion: peor });
      }
    }
  }
  return fallos;
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

  for (const v of [0, 1, 2, 3] as const) {
    for (const nivel of NIVELES) {
      const c = coincidenciaConNucleo(v, nivel);
      if (c < COINCIDENCIA_MINIMA) {
        fallos.push(`nav-2: nave ${v} (${nivel}) coincide con el núcleo solo en el ${(c * 100).toFixed(2)}% de la rejilla (mínimo ${COINCIDENCIA_MINIMA * 100}%)`);
      }
    }
  }

  if (fallos.length > 0) {
    console.error("verificar:siluetas -- huecos encontrados:");
    for (const f of fallos) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    `OK: ${CATALOGO_ARMAS.length} armas distinguibles por familia visual, 4 naves distinguibles por forma (color y gris), dibujo y polígono del núcleo coinciden en las 12 siluetas.`,
  );
}

main();
