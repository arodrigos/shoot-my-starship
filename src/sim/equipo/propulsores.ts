import { PASO_FIJO_MS } from "@/sim/tiempo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { HOLGURA_SOLIDO_NAVE_PX, libreDeSolido } from "@/sim/naves/colocacion";
import { chocaConOtraNave, esPosicionValida, limitesNave, type PuntoNave } from "@/sim/naves/zonaValida";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import { esSolido, type Mascara } from "@/sim/terreno/mascara";

// Radio del círculo cuya área es 1/4 de la pantalla: «como máximo un cuarto de
// la pantalla» en la medida que confirmó Adrián.
export function alcancePropulsores(mundo: ParametrosMundo): number {
  return Math.sqrt((mundo.ancho * mundo.alto) / (4 * Math.PI));
}

// Cota defensiva: con varios pozos una nave podría orbitar sin llegar nunca al
// círculo; ~4 s de vuelo sobran para recorrer el alcance a cualquier potencia.
const PASOS_MAXIMOS_PROPULSORES = Math.round(4_000 / PASO_FIJO_MS);

// Una nave posada queda justo en el borde de la holgura que exige
// esPosicionValida (HOLGURA_SOLIDO_NAVE_PX): sin una gracia, el primer paso que
// roza esa franja se daba por «obstáculo» y la nave no se movía nada. La gracia
// cubre solo la salida: hasta GRACIA_CONTACTO_U del origen, y nunca con el
// cuerpo (CUERPO_NAVE_PX) metido en el sólido.
const GRACIA_CONTACTO_U = 2 * HOLGURA_SOLIDO_NAVE_PX;
const CUERPO_NAVE_PX = 6;

// Normal saliente de la superficie bajo la nave: del centroide de los píxeles
// sólidos del entorno hacia el origen. null si no hay sólido cerca (en pleno
// espacio no hay nada de lo que salir).
function normalSaliente(desde: PuntoNave, mascara: Mascara): PuntoNave | null {
  const r = GRACIA_CONTACTO_U;
  const cx = Math.round(desde.x);
  const cy = Math.round(desde.y);
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r || !esSolido(mascara, cx + dx, cy + dy)) continue;
      sx += dx;
      sy += dy;
      n++;
    }
  }
  if (n === 0) return null;
  const largo = Math.hypot(sx, sy);
  return largo === 0 ? null : { x: -sx / largo, y: -sy / largo };
}

export type MotivoParadaPropulsores = "alcance" | "obstaculo" | "tiempo";

export interface ParametrosPropulsores {
  readonly desde: PuntoNave;
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly mundo: ParametrosMundo;
  readonly mascara: Mascara;
  readonly planetas?: RegistroPlanetas;
  readonly otras: readonly PuntoNave[];
}

export interface ResultadoPropulsores {
  // Ruta recorrida, de la posición inicial a la final (la previsualización la
  // dibuja tal cual: lo que se ve es lo que se vuela).
  readonly ruta: readonly PuntoNave[];
  readonly destino: PuntoNave;
  readonly motivo: MotivoParadaPropulsores;
}

// La nave es un cuerpo que sigue las mismas reglas de gravedad que un proyectil
// (mismo integrador y mismos pozos), cortado en el círculo de alcance. Se para
// en la última posición válida: contra un sólido, otra nave o el margen del
// mundo no hay rebote ni daño, simplemente no avanza más.
export function volarConPropulsores(parametros: ParametrosPropulsores): ResultadoPropulsores {
  const { desde, anguloGrados, potencia, mundo, mascara, planetas, otras } = parametros;
  const alcance = alcancePropulsores(mundo);
  const velocidad = velocidadDesdePotencia(potencia);
  const rad = (anguloGrados * Math.PI) / 180;
  const inicial = crearProyectil(desde.x, desde.y, velocidad * Math.cos(rad), -velocidad * Math.sin(rad));

  // Rumbo en pantalla (y crece hacia abajo) frente a la normal saliente: solo
  // si se aleja de la superficie (producto escalar > 0) hay gracia de salida.
  const normal = normalSaliente(desde, mascara);
  const graciaDeSalida = normal !== null && Math.cos(rad) * normal.x - Math.sin(rad) * normal.y > 0;
  const dentroDeLimites = (punto: PuntoNave): boolean => {
    const { xMin, xMax, yMin, yMax } = limitesNave(mundo);
    return punto.x >= xMin && punto.x <= xMax && punto.y >= yMin && punto.y <= yMax;
  };

  const ruta: PuntoNave[] = [{ x: desde.x, y: desde.y }];
  let motivo: MotivoParadaPropulsores = "tiempo";
  let anterior: PuntoNave = ruta[0];
  let pasos = 0;

  simularVuelo(
    inicial,
    mundo.gravedad,
    mundo.deriva,
    (cuerpo) => {
      pasos++;
      if (pasos > PASOS_MAXIMOS_PROPULSORES) return true;
      let punto: PuntoNave = { x: cuerpo.x, y: cuerpo.y };
      const distancia = Math.hypot(punto.x - desde.x, punto.y - desde.y);
      if (distancia >= alcance) {
        // Se recorta sobre el círculo para que el destino sea exactamente el
        // alcance y no el paso entero que lo sobrepasa.
        const dx = punto.x - anterior.x;
        const dy = punto.y - anterior.y;
        const tramo = Math.hypot(dx, dy);
        const faltaDesdeAnterior = alcance - Math.hypot(anterior.x - desde.x, anterior.y - desde.y);
        const t = tramo === 0 ? 0 : Math.min(1, Math.max(0, faltaDesdeAnterior / tramo));
        punto = { x: anterior.x + dx * t, y: anterior.y + dy * t };
        if (esPosicionValida(punto, mundo, mascara, otras)) ruta.push(punto);
        motivo = "alcance";
        return true;
      }
      const enSalida =
        graciaDeSalida &&
        distancia < GRACIA_CONTACTO_U &&
        dentroDeLimites(punto) &&
        !chocaConOtraNave(punto, otras) &&
        libreDeSolido(mascara, punto.x, punto.y, CUERPO_NAVE_PX);
      if (!enSalida && !esPosicionValida(punto, mundo, mascara, otras)) {
        motivo = "obstaculo";
        return true;
      }
      ruta.push(punto);
      anterior = punto;
      return false;
    },
    // Presupuesto de pasos propio y corto del modo multipozo: la cota de
    // arriba ya acota el modo de un mapa sin planetas.
    { ...(planetas ? { planetas } : {}), presupuestoPasos: PASOS_MAXIMOS_PROPULSORES + 2 },
  );

  return { ruta, destino: ruta[ruta.length - 1], motivo };
}
