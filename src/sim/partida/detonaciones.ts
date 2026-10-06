import type { Arma } from "@/sim/armas/tipos";
import type { PuntoDeImpacto } from "@/sim/armas/resolver";
import { esSolido, type Mascara } from "@/sim/terreno/mascara";

// explosiones-visuales: lo que el núcleo declara de CADA detonación real, para
// que la cáscara dibuje una explosión por entrada sin deducir nada por su
// cuenta (ni dónde estalló, ni hasta dónde llega el daño).
export interface Detonacion {
  readonly x: number;
  readonly y: number;
  readonly armaId: string;
  readonly radioEfectoU: number;
  readonly danioAplicado: number;
  readonly sobre: "nave" | "planeta" | "vacio";
}

// Un punto de detonación cae en la superficie, así que el píxel exacto puede
// ser aire aunque el cráter se haya tallado en un planeta: se mira un
// entorno corto en vez de un único píxel.
const SONDAS_SUPERFICIE_PX = 3;
const DESPLAZAMIENTOS_SONDA: readonly (readonly [number, number])[] = [
  [0, 0],
  [SONDAS_SUPERFICIE_PX, 0],
  [-SONDAS_SUPERFICIE_PX, 0],
  [0, SONDAS_SUPERFICIE_PX],
  [0, -SONDAS_SUPERFICIE_PX],
];

// El empuje (Gravitón) no declara radio de efecto: lo que enseña su onda es
// el área que talla en el terreno.
export function radioEfectoDeArma(arma: Arma): number {
  if (arma.efecto.tipo !== "empuje") return arma.efecto.radioEfectoPx;
  return arma.huella.tipo === "ninguna" ? 0 : arma.huella.radio;
}

// `mascaraAntes` es la del estado previo al disparo: la posterior ya lleva el
// cráter tallado y el punto de impacto habría dejado de ser sólido.
export function detonacionesDeDisparo(
  arma: Arma,
  puntos: readonly PuntoDeImpacto[],
  danioPorPunto: readonly number[],
  mascaraAntes: Mascara,
): Detonacion[] {
  const radioEfectoU = radioEfectoDeArma(arma);
  return puntos.map((punto, indice) => {
    const danioAplicado = danioPorPunto[indice] ?? 0;
    const sobreSolido = DESPLAZAMIENTOS_SONDA.some(([dx, dy]) =>
      esSolido(mascaraAntes, Math.round(punto.x + dx), Math.round(punto.y + dy)),
    );
    const sobre = punto.impactoNave !== undefined || danioAplicado > 0 ? "nave" : sobreSolido ? "planeta" : "vacio";
    return { x: punto.x, y: punto.y, armaId: arma.id, radioEfectoU, danioAplicado, sobre };
  });
}
