import { esSolido, type Mascara } from "@/sim/terreno/mascara";
import type { EstadoNave } from "@/sim/partida/tipos";

export interface ResultadoEmpuje {
  readonly nave: EstadoNave;
  readonly destruidaPorEmpuje: boolean;
}

// Consecuencia de un desplazamiento en espacio abierto (nav-5): a
// diferencia del suelo plano de antes, aquí no hay "abajo" que frene un
// empuje -- si el vector saca a la nave del mundo o la mete dentro de un
// sólido, la nave queda destruida en el sitio en vez de quedar incrustada o
// flotando fuera de mapa. Es el mecanismo genérico de este bloque; enganchar
// esto al efecto real del Gravitón (hoy resolverDisparo solo sabe desplazar
// en 1D sobre el suelo plano) es trabajo de armas-nuevas.
export function resolverEmpujeEnEspacioAbierto(
  mascara: Mascara,
  ancho: number,
  alto: number,
  nave: EstadoNave,
  dx: number,
  dy: number,
): ResultadoEmpuje {
  const x = nave.x + dx;
  const y = (nave.y ?? 0) + dy;

  const fueraDeMundo = x < 0 || x >= ancho || y < 0 || y >= alto;
  const dentroDeSolido = !fueraDeMundo && esSolido(mascara, Math.round(x), Math.round(y));

  if (fueraDeMundo || dentroDeSolido) {
    return { nave: { ...nave, integridad: 0 }, destruidaPorEmpuje: true };
  }
  return { nave: { ...nave, x, y }, destruidaPorEmpuje: false };
}
