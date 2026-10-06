import { PASO_FIJO_MS } from "@/sim/tiempo";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import type { RegistroPlanetas } from "@/sim/gravedad/planetas";
import { esPosicionValida, type PuntoNave } from "@/sim/naves/zonaValida";
import type { ParametrosMundo } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

// Radio del círculo cuya área es 1/4 de la pantalla: «como máximo un cuarto de
// la pantalla» en la medida que confirmó Adrián.
export function alcancePropulsores(mundo: ParametrosMundo): number {
  return Math.sqrt((mundo.ancho * mundo.alto) / (4 * Math.PI));
}

// Cota defensiva: con varios pozos una nave podría orbitar sin llegar nunca al
// círculo; ~4 s de vuelo sobran para recorrer el alcance a cualquier potencia.
const PASOS_MAXIMOS_PROPULSORES = Math.round(4_000 / PASO_FIJO_MS);

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
      if (!esPosicionValida(punto, mundo, mascara, otras)) {
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
