import type Phaser from "phaser";
import { esMaterialPlaneta, obtenerMaterial, type Mascara } from "@/sim/terreno/mascara";
import type { RectanguloSucio } from "@/sim/terreno/huella";
import type { SuperficieDeTerreno } from "@/juego/terreno/Terreno";
import { FACTOR_BORDE_QUEMADO, PALETA_ESPACIO_ESCOMBRO, PALETA_ESPACIO_PLANETAS, type PaletaTerreno, oscurecer } from "@/juego/paleta";
import { clasificarPixelVisual } from "@/juego/terreno/clasificacionVisual";
import { ColaRefresco, pintarRectangulo, rectanguloARepintar } from "@/juego/terreno/refrescoIncremental";

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

// Hay más materiales de planeta que colores en la paleta: se reutilizan en
// ciclo, y el sombreado esférico sigue distinguiendo cada cuerpo.
const NUM_COLORES_PLANETA = Object.keys(PALETA_ESPACIO_PLANETAS).length;

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

// crateres-y-escombros: el borde quemado se oscurece SOBRE el color ya
// sombreado del planeta (no sobre el color base plano), para que un cráter
// en la cara oscura siga leyéndose más oscuro que uno en la cara iluminada
// -- el chamuscado tizna el material, no sustituye su iluminación. El
// escombro no lleva este tratamiento (ver el comentario de
// PALETA_ESPACIO_ESCOMBRO): son fragmentos sueltos, no un cráter sobre un
// cuerpo esférico.
function colorPixel(
  mascara: Mascara,
  material: number,
  x: number,
  y: number,
  geometrias: ReadonlyMap<number, GeometriaPlaneta>,
): PaletaTerreno {
  if (!esMaterialPlaneta(material)) {
    return PALETA_ESPACIO_ESCOMBRO;
  }
  const base = PALETA_ESPACIO_PLANETAS[((material - 1) % NUM_COLORES_PLANETA) + 1] ?? PALETA_ESPACIO_ESCOMBRO;
  const geometria = geometrias.get(material);
  const sombreado = geometria
    ? (() => {
        const sombra = factorSombra(x - geometria.cx, y - geometria.cy, geometria.radio);
        return { r: Math.round(base.r * sombra), g: Math.round(base.g * sombra), b: Math.round(base.b * sombra) };
      })()
    : base;

  if (clasificarPixelVisual(mascara, x, y) === "borde-quemado") {
    return oscurecer(sombreado, FACTOR_BORDE_QUEMADO);
  }
  return sombreado;
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
  ) {
    this.cola = new ColaRefresco(textura);
  }

  private readonly cola: ColaRefresco;

  // paron-explosion: un solo ImageData del rectángulo sucio y un putImageData;
  // la subida a la GPU queda en la cola (vaciarCola), una vez por frame. Ya
  // no hay update(): hacía getImageData del mapa entero tras cada impacto.
  refrescarRectangulo(mascara: Mascara, sucio: RectanguloSucio): void {
    const rect = rectanguloARepintar(mascara, sucio);
    if (rect === null) {
      return;
    }
    pintarRectangulo(this.textura, rect, (x, y) => {
      const material = obtenerMaterial(mascara, x, y);
      return material === 0 ? null : colorPixel(mascara, material, x, y, this.geometrias);
    });
    this.cola.marcar();
  }

  vaciarCola(): boolean {
    return this.cola.vaciar();
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
        const color = colorPixel(mascara, material, x, y, this.geometrias);
        imagen.data[base] = color.r;
        imagen.data[base + 1] = color.g;
        imagen.data[base + 2] = color.b;
        imagen.data[base + 3] = 255;
      }
    }

    contexto.putImageData(imagen, 0, 0);
    this.cola.descartar();
    this.textura.update();
  }
}
