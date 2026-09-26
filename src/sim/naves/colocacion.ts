import { siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import { buscarDisparoViable } from "@/sim/balistica/busqueda";
import { esSolido } from "@/sim/terreno/mascara";
import type { SistemaGenerado } from "@/sim/sistema/generador";
import type { EstadoNave, ParametrosMundo } from "@/sim/partida/tipos";

// Las tres holguras que separan "aleatorio" de "aleatorio jugable"
// (nav-2): ninguna nave incrustada en un sólido, ninguna nave pegada a la
// otra, ninguna nave pegada al borde del mundo.
export const HOLGURA_SOLIDO_NAVE_PX = 30;
export const SEPARACION_MINIMA_NAVES_PX = 350;
export const MARGEN_MUNDO_NAVE_PX = 40;

// Radio de impacto de una nave a efectos de "hay tiro posible" (nav-3): no
// es una hitbox de colisión real -- eso lo decide el catálogo de daño de
// balistica-armas más adelante -- es solo el umbral que separa "casi" de
// "sirve" para comprobar que esta colocación es jugable. Del orden del
// radio de efecto medio del catálogo actual (ver armas/catalogo.ts).
export const TOLERANCIA_IMPACTO_NAVE_PX = 60;

const MAX_INTENTOS_COLOCACION = 5;
const MAX_INTENTOS_PUNTO = 500;

function libreDeSolido(mascara: SistemaGenerado["mascara"], x: number, y: number, holgura: number): boolean {
  const cx = Math.round(x);
  const cy = Math.round(y);
  const r = Math.ceil(holgura);
  const holguraCuadrado = holgura * holgura;

  for (let dy = -r; dy <= r; dy++) {
    const restante = holguraCuadrado - dy * dy;
    if (restante < 0) continue;
    const dxMax = Math.floor(Math.sqrt(restante));
    for (let dx = -dxMax; dx <= dxMax; dx++) {
      if (esSolido(mascara, cx + dx, cy + dy)) return false;
    }
  }
  return true;
}

interface Punto {
  readonly x: number;
  readonly y: number;
}

interface PasoElegirPunto {
  readonly punto: Punto | null;
  readonly aleatorio: EstadoAleatorio;
}

function elegirPunto(
  mascara: SistemaGenerado["mascara"],
  ancho: number,
  alto: number,
  aleatorioInicial: EstadoAleatorio,
  evitar: readonly Punto[],
): PasoElegirPunto {
  let aleatorio = aleatorioInicial;

  for (let intento = 0; intento < MAX_INTENTOS_PUNTO; intento++) {
    const pasoX = siguienteAleatorio(aleatorio);
    aleatorio = pasoX.estado;
    const pasoY = siguienteAleatorio(aleatorio);
    aleatorio = pasoY.estado;

    const x = MARGEN_MUNDO_NAVE_PX + pasoX.valor * (ancho - 2 * MARGEN_MUNDO_NAVE_PX);
    const y = MARGEN_MUNDO_NAVE_PX + pasoY.valor * (alto - 2 * MARGEN_MUNDO_NAVE_PX);

    if (!libreDeSolido(mascara, x, y, HOLGURA_SOLIDO_NAVE_PX)) continue;
    if (evitar.some((otro) => Math.hypot(otro.x - x, otro.y - y) < SEPARACION_MINIMA_NAVES_PX)) continue;

    return { punto: { x, y }, aleatorio };
  }

  return { punto: null, aleatorio };
}

export interface ResultadoColocacion {
  readonly naves: readonly [EstadoNave, EstadoNave];
  readonly aleatorio: EstadoAleatorio;
  readonly intentos: number;
}

// "Aleatorio jugable" (colocacion-naves): coloca las dos naves flotando
// entre los planetas con las tres holguras de arriba Y con un tiro posible
// demostrado entre ellas (nav-3, con el buscador numérico real, nunca uno
// simplificado) -- si alguna de las dos cosas falla, la colocación entera
// se descarta y se vuelve a tirar. Lanza si se agotan los intentos: con las
// garantías de generarSistema (corredor libre, topes de cuerpos y de
// tamaño) esto no debería ocurrir nunca, así que agotarlos es un fallo real
// que hay que ver, no un caso a esconder con un valor por defecto.
export function colocarNaves(
  sistema: SistemaGenerado,
  mundo: ParametrosMundo,
  aleatorioInicial: EstadoAleatorio,
): ResultadoColocacion {
  let aleatorio = aleatorioInicial;

  for (let intento = 1; intento <= MAX_INTENTOS_COLOCACION; intento++) {
    const pasoA = elegirPunto(sistema.mascara, mundo.ancho, mundo.alto, aleatorio, []);
    aleatorio = pasoA.aleatorio;
    if (!pasoA.punto) continue;

    const pasoB = elegirPunto(sistema.mascara, mundo.ancho, mundo.alto, aleatorio, [pasoA.punto]);
    aleatorio = pasoB.aleatorio;
    if (!pasoB.punto) continue;

    const disparo = buscarDisparoViable({
      mascara: sistema.mascara,
      ancho: mundo.ancho,
      alto: mundo.alto,
      planetas: sistema.planetas,
      gravedad: mundo.gravedad,
      deriva: mundo.deriva,
      origenX: pasoA.punto.x,
      origenY: pasoA.punto.y,
      objetivoX: pasoB.punto.x,
      objetivoY: pasoB.punto.y,
      toleranciaPx: TOLERANCIA_IMPACTO_NAVE_PX,
    });
    if (!disparo) continue;

    const naves: [EstadoNave, EstadoNave] = [
      { x: pasoA.punto.x, y: pasoA.punto.y, integridad: 100 },
      { x: pasoB.punto.x, y: pasoB.punto.y, integridad: 100 },
    ];
    return { naves, aleatorio, intentos: intento };
  }

  throw new Error(`colocarNaves: no se encontró una colocación jugable tras ${MAX_INTENTOS_COLOCACION} intentos`);
}
