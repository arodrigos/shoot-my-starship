import type Phaser from "phaser";
import type { Terreno } from "@/juego/terreno/Terreno";
import "@/debug/tipos";

// Puente entre el terreno real del juego y los tests de Playwright
// (window.__debug.terreno). Vive aparte de la escena y de
// SuperficieCanvasPhaser para que la LISTA BLANCA de terreno-6 quede
// acotada a este único fichero: es la "página de pruebas" del criterio, y
// es la única pieza fuera de la generación inicial con permiso para leer el
// canvas con getImageData -- y solo lo hace una vez por llamada, nunca en
// el camino de colisión del juego real.
//
// render-juego: comprobarPuntos lee la máscara SIEMPRE a través de
// terreno.esSolido(x,y), nunca de una referencia capturada al crear el
// puente -- avanzar() sustituye la máscara entera por una clonada en cada
// disparo real (Terreno.sincronizarDesde), así que una referencia fija
// quedaría apuntando a la máscara del turno 0 para siempre. terreno-mascara
// mutaba la máscara en el sitio (aplicarHuella), por eso el bug no se veía
// en la página de pruebas de aquel bloque.
export function exponerDepuracionDeTerreno(terreno: Terreno, texturaCanvas: Phaser.Textures.CanvasTexture): void {
  window.__debug = window.__debug ?? {};

  window.__debug.terreno = {
    esSolido: (x, y) => terreno.esSolido(x, y),

    comprobarPuntos: (puntos) => {
      // Una sola lectura de todo el lienzo para todo el lote de puntos, no
      // una por punto: es la lectura "hecha UNA SOLA VEZ al final" que pide
      // terreno-3.
      const imagen = texturaCanvas.context.getImageData(0, 0, texturaCanvas.width, texturaCanvas.height);
      return puntos.map(({ x, y }) => {
        const solidoMascara = terreno.esSolido(x, y);
        const indiceAlfa = (y * imagen.width + x) * 4 + 3;
        const solidoTextura = imagen.data[indiceAlfa] > 0;
        return solidoMascara === solidoTextura;
      });
    },

    aplicarHuella: (cx, cy, radio, signo) => terreno.aplicarHuella(cx, cy, radio, signo),

    listo: false,
  };
}
