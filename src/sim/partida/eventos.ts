import type { IdNave } from "@/sim/partida/tipos";

// Los siete tipos de evento de humor (humor-sistemico): un tipo aparte para
// que el selector de frases y el banco de reacciones indexen por él sin
// depender de la forma completa de EventoSimulacion.
export type TipoEventoHumor =
  | "autoimpacto"
  | "deriva-traiciona"
  | "derrumbe-bajo-el-lider"
  | "arma-falla"
  | "enterrado"
  | "caida-al-vacio"
  | "tiro-imposible-acertado";

// Orden estable, usado por los tests (humor-3) y por cualquier UI que quiera
// listar los siete tipos sin duplicar el literal.
export const TIPOS_EVENTO_HUMOR: readonly TipoEventoHumor[] = [
  "autoimpacto",
  "deriva-traiciona",
  "derrumbe-bajo-el-lider",
  "arma-falla",
  "enterrado",
  "caida-al-vacio",
  "tiro-imposible-acertado",
];

// Unión discriminada, ampliada en humor-sistemico con los siete eventos de
// humor que describe la arquitectura: el núcleo los emite, la cáscara los
// convierte en espectáculo (sacudida, texto, repetición). Ampliar una unión
// discriminada es aditivo; avanzar() ya podía emitirlos sin que este fichero
// necesitara ninguna otra forma nueva.
export type EventoSimulacion =
  | {
      readonly tipo: "disparo";
      readonly nave: IdNave;
      readonly arma: string;
      readonly anguloGrados: number;
      readonly potencia: number;
    }
  | {
      readonly tipo: "impacto";
      readonly x: number;
      readonly y: number;
      readonly objetivo: IdNave;
      readonly danio: number;
      // Solo lo produce el Gravitón de Segunda Mano (balistica-armas):
      // positivo hacia +x. Opcional para no romper los eventos ya emitidos
      // por armas sin efecto de empuje.
      readonly desplazamientoPx?: number;
    }
  // La nave que se ha hecho daño a sí misma (Despedida): paralelo al evento
  // "impacto" con objetivo === nave, pero con nombre propio para que la
  // presentación y el selector de frases no tengan que inferirlo comparando
  // ids.
  | { readonly tipo: "autoimpacto"; readonly nave: IdNave; readonly danio: number }
  // El disparo habría dado en el blanco con deriva cero y no lo ha hecho con
  // la deriva del mapa: la nave que dispara es la "traicionada".
  | { readonly tipo: "deriva-traiciona"; readonly nave: IdNave }
  // El terreno bajo quien iba en cabeza (más integridad) pierde apoyo como
  // efecto colateral de este disparo, sin ser el objetivo directo.
  | { readonly tipo: "derrumbe-bajo-el-lider"; readonly nave: IdNave }
  // La tirada de fiabilidad del arma ha fallado: el disparo vuela pero no
  // aplica huella ni daño.
  | { readonly tipo: "arma-falla"; readonly nave: IdNave; readonly arma: string }
  // El terreno bajo la nave ha subido lo bastante como para sepultarla
  // (el Vertedero Portátil es el caso principal, no el único posible).
  | { readonly tipo: "enterrado"; readonly nave: IdNave }
  // La nave se ha quedado sin suelo en su columna (transición, no estado).
  // Evento de humor puro: no cambia la integridad ni fuerza el fin de
  // partida, ver el comentario de caeAlVacio en eventosHumor.ts.
  | { readonly tipo: "caida-al-vacio"; readonly nave: IdNave }
  // El ángulo/potencia disparados se alejan mucho de la solución balística
  // exacta para esa potencia y aun así el disparo ha dado en el objetivo.
  | { readonly tipo: "tiro-imposible-acertado"; readonly nave: IdNave; readonly objetivo: IdNave }
  // grav-6 / render-espacio (esp-1, esp-6): el proyectil ha agotado el
  // presupuesto de vuelo multipozo sin cumplir nunca su condición de parada
  // -- una órbita estable de facto. No es un fallo de fiabilidad (arma-falla,
  // que sí tiene punto de caída): aquí no hay ningún punto de impacto que
  // mostrar, el turno pasa igual.
  | { readonly tipo: "proyectil-perdido"; readonly nave: IdNave }
  | { readonly tipo: "turno-fin"; readonly siguienteTurno: IdNave }
  | { readonly tipo: "partida-fin"; readonly ganador: IdNave };
