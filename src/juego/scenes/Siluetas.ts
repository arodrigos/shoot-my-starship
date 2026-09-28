import Phaser from "phaser";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { puntosSilueta } from "@/juego/proyectiles/geometriaProyectil";
import "@/debug/tipos";

const COLOR_PROYECTIL = 0xffe08a;
const COLOR_FONDO_CELDA = 0x1c1f2a;
const ANCHO_CELDA = 140;
const ALTO_CELDA = 100;
const COLUMNAS = 5;

// proy-1 (feedback de la sexta devolución, requisito c): captura de las 13
// siluetas en fila que el criterio pide literalmente -- dibujada con la
// MISMA llamada a fillPoints que usa AnimadorProyectil en el vuelo real, no
// un render aparte, para que la captura demuestre lo que ve el jugador y no
// solo la geometría en abstracto.
export class Siluetas extends Phaser.Scene {
  constructor() {
    super("Siluetas");
  }

  create(): void {
    window.__debug = window.__debug ?? {};

    CATALOGO_ARMAS.forEach((arma, indice) => {
      const columna = indice % COLUMNAS;
      const fila = Math.floor(indice / COLUMNAS);
      const cx = ANCHO_CELDA * (columna + 0.5);
      const cy = ALTO_CELDA * (fila + 0.5);

      this.add.rectangle(cx, cy, ANCHO_CELDA - 4, ALTO_CELDA - 4, COLOR_FONDO_CELDA);

      const puntos = puntosSilueta(arma).map((p) => new Phaser.Math.Vector2(p.x, p.y));
      const grafico = this.add.graphics();
      grafico.fillStyle(COLOR_PROYECTIL, 1);
      grafico.fillPoints(puntos, true);
      grafico.setPosition(cx, cy);

      this.add
        .text(cx, cy + ALTO_CELDA / 2 - 16, arma.nombre, { fontSize: "11px", color: "#ffffff" })
        .setOrigin(0.5, 0.5);
    });

    window.__debug.siluetasListo = true;
  }
}
