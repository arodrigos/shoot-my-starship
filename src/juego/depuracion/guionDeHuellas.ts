import { crearGeneradorAleatorio } from "@/sim/aleatorio";
import type { SignoHuella } from "@/sim/terreno/huella";

export interface HuellaDeGuion {
  readonly cx: number;
  readonly cy: number;
  readonly radio: number;
  readonly signo: SignoHuella;
}

// Semilla fija a propósito: terreno-3 exige que la sincronía máscara/textura
// no diverja tras un guion de huellas "aleatorias", y eso solo es
// verificable en CI si el guion es siempre el mismo.
const SEMILLA_GUION = 555;
const NUM_HUELLAS = 200;
const PROPORCION_QUE_AÑADE = 0.2;

export function generarGuionDeHuellas(ancho: number, alto: number): HuellaDeGuion[] {
  const aleatorio = crearGeneradorAleatorio(SEMILLA_GUION);
  const huellas: HuellaDeGuion[] = [];

  for (let i = 0; i < NUM_HUELLAS; i++) {
    huellas.push({
      cx: aleatorio() * ancho,
      cy: aleatorio() * alto,
      radio: 10 + aleatorio() * 50,
      signo: aleatorio() < PROPORCION_QUE_AÑADE ? "sumar" : "restar",
    });
  }

  return huellas;
}
