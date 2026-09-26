import type Phaser from "phaser";
import { esMaterialPlaneta, obtenerMaterial, type Mascara } from "@/sim/terreno/mascara";
import type { RectanguloSucio } from "@/sim/terreno/huella";
import type { SuperficieDeTerreno } from "@/juego/terreno/Terreno";
import { PALETA_ESPACIO_ESCOMBRO, PALETA_ESPACIO_PLANETAS, type PaletaTerreno } from "@/juego/paleta";

// Geometría de un planeta a efectos de sombreado: cx/cy/radio, FIJOS de por
// vida (nucleo-gravedad -- el centro de atracción y el radio declarado nunca
// cambian, solo pixelesVivos), así que basta con capturarla una vez al crear
// la superficie -- nunca hace falta volver a leerla del registro de
// gravedad turno a turno.
export interface GeometriaPlaneta {
  readonly cx: number;
  readonly cy: number;
  readonly radio: number;
}

const AMBIENTE = 0.35;
// Luz fija arriba-a-la-izquierda, normalizada -- el mismo vector para los
// 6 planetas posibles, para que el terminador de todos caiga en el mismo
// lado y el ojo lea "una sola fuente de luz", no seis soles distintos.
const LUZ = (() => {
  const x = -0.5;
  const y = -0.6;
  const z = 0.62;
  const norma = Math.hypot(x, y, z);
  return { x: x / norma, y: y / norma, z: z / norma };
})();

function factorSombra(dx: number, dy: number, radio: number): number {
  const nx = dx / radio;
  const ny = dy / radio;
  const nz2 = 1 - nx * nx - ny * ny;
  const nz = nz2 > 0 ? Math.sqrt(nz2) : 0;
  const producto = nx * LUZ.x + ny * LUZ.y + nz * LUZ.z;
  return AMBIENTE + (1 - AMBIENTE) * Math.max(0, producto);
}

function colorPixel(material: number, x: number, y: number, geometrias: ReadonlyMap<number, GeometriaPlaneta>): PaletaTerreno {
  if (!esMaterialPlaneta(material)) {
    return PALETA_ESPACIO_ESCOMBRO;
  }
  const base = PALETA_ESPACIO_PLANETAS[material] ?? PALETA_ESPACIO_ESCOMBRO;
  const geometria = geometrias.get(material);
  if (!geometria) {
    return base;
  }
  const sombra = factorSombra(x - geometria.cx, y - geometria.cy, geometria.radio);
  return { r: Math.round(base.r * sombra), g: Math.round(base.g * sombra), b: Math.round(base.b * sombra) };
}

// Implementación de SuperficieDeTerreno para el hito espacial (render-espacio,
// esp-1/esp-2/esp-5): a diferencia de SuperficieCanvasPhaser (un único color
// de "sólido" por mapa), aquí cada material de la máscara (un planeta 1..6,
// o escombro) tiene su propio color, y los planetas se sombrean como esfera
// desde su geometría fija -- lo que hace que un cráter reabra la sombra
// exactamente donde el disco ya no tapa el terminador, en vez de dejar un
// parche de color plano que delate la huella (esp-2).
export class SuperficieEspacio implements SuperficieDeTerreno {
  constructor(
    private readonly textura: Phaser.Textures.CanvasTexture,
    private readonly geometrias: ReadonlyMap<number, GeometriaPlaneta>,
  ) {}

  // Mismo contrato que SuperficieCanvasPhaser (terreno-6): solo
  // fillRect/clearRect en el camino de impacto, nunca getImageData ni
  // putImageData. Aquí el color varía píxel a píxel dentro de un planeta
  // (el sombreado), así que el tramo contiguo que de verdad se comprime es
  // el de AIRE (siempre transparente, sea cual sea el material que había
  // antes) -- el resto se pinta píxel a píxel, acotado al rectángulo sucio
  // (pequeño: el radio de huella de un arma, nunca el mapa entero).
  refrescarRectangulo(mascara: Mascara, rectangulo: RectanguloSucio): void {
    if (rectangulo.ancho <= 0 || rectangulo.alto <= 0) {
      return;
    }

    const contexto = this.textura.context;
    const maxX = rectangulo.x + rectangulo.ancho - 1;
    const maxY = rectangulo.y + rectangulo.alto - 1;

    for (let y = rectangulo.y; y <= maxY; y++) {
      let x = rectangulo.x;
      while (x <= maxX) {
        const material = obtenerMaterial(mascara, x, y);
        if (material === 0) {
          const inicioTramo = x;
          while (x + 1 <= maxX && obtenerMaterial(mascara, x + 1, y) === 0) {
            x++;
          }
          contexto.clearRect(inicioTramo, y, x - inicioTramo + 1, 1);
        } else {
          const color = colorPixel(material, x, y, this.geometrias);
          contexto.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
          contexto.fillRect(x, y, 1, 1);
        }
        x++;
      }
    }

    this.textura.update();
  }

  // Pasada completa (generación inicial, render-5 tras RESTORE_WEBGL): en la
  // lista blanca de terreno-6 exactamente igual que SuperficieCanvasPhaser,
  // porque no es el camino de refresco por impacto.
  pintarCompleta(mascara: Mascara): void {
    const contexto = this.textura.context;
    const imagen = contexto.createImageData(mascara.ancho, mascara.alto);

    for (let y = 0; y < mascara.alto; y++) {
      for (let x = 0; x < mascara.ancho; x++) {
        const indice = y * mascara.ancho + x;
        const material = mascara.datos[indice];
        const base = indice * 4;
        if (material === 0) {
          imagen.data[base + 3] = 0;
          continue;
        }
        const color = colorPixel(material, x, y, this.geometrias);
        imagen.data[base] = color.r;
        imagen.data[base + 1] = color.g;
        imagen.data[base + 2] = color.b;
        imagen.data[base + 3] = 255;
      }
    }

    contexto.putImageData(imagen, 0, 0);
    this.textura.update();
  }
}
