import Phaser from "phaser";
import { COLORES_NAVE } from "@/juego/naves/paletaNaves";
import { puntosCascoVariante, type VarianteNave } from "@/sim/naves/geometriaCasco";
import { direccionDeNave } from "@/sim/naves/contacto";
import type { IdNave } from "@/sim/partida/tipos";
import { ALFA_RASTRO, ESCALA_SILUETA_RASTRO, GROSOR_RASTRO_U, segmentosDiscontinuos, type Rastro } from "@/juego/rastro/rastros";

// Pinta el rastro por debajo de la mira (depth 30) y de la banda de dispersión:
// trazo a guiones y tenue, y en el impacto el contorno de la silueta del
// asiento que disparó, para que no dependa solo del color.
export function dibujarRastro(grafico: Phaser.GameObjects.Graphics, rastro: Rastro | null): void {
  grafico.clear();
  if (rastro === null) return;
  const color = COLORES_NAVE[rastro.asiento] ?? COLORES_NAVE[0];
  grafico.lineStyle(GROSOR_RASTRO_U, color, ALFA_RASTRO);
  for (const s of segmentosDiscontinuos(rastro.puntos)) {
    grafico.lineBetween(s.desde.x, s.desde.y, s.hasta.x, s.hasta.y);
  }
  if (rastro.impacto === null) return;
  const dir = direccionDeNave(rastro.asiento as IdNave);
  const silueta = puntosCascoVariante((rastro.asiento % 4) as VarianteNave, dir).map(
    (p) => new Phaser.Math.Vector2(rastro.impacto!.x + p.x * ESCALA_SILUETA_RASTRO, rastro.impacto!.y + p.y * ESCALA_SILUETA_RASTRO),
  );
  grafico.strokePoints(silueta, true, true);
}
