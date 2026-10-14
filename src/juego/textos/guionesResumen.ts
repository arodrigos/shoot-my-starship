import { NOMBRE_TU_NAVE } from "@/contenido/resumenesPartida";
import { buscarPersonalidad } from "@/sim/ia/personalidades";
import { resumenPartida } from "@/sim/partida/resumenPartida";
import { NOMBRES_CORTOS_RIVAL, textoDesplazamiento } from "@/juego/textos/nombresEnTexto";

export interface PublicacionPrueba {
  readonly resumen: string;
  readonly rotulo: string;
  readonly personalidadId: string;
}

const SEMILLA_GUION = 7;

// Guion «el rival X desplaza al humano local único»: el mismo generador y los
// mismos textos que una partida real de un humano contra X, sin tener que
// provocar el desplazamiento con un tiro.
export function guionResumenPrueba(id: string): PublicacionPrueba {
  const coincidencia = /^desplazado-por-(bisagra|contable|chispa)$/.exec(id);
  if (!coincidencia) throw new Error(`Guion de resumen desconocido: ${id}`);
  const personalidad = buscarPersonalidad(coincidencia[1] === "bisagra" ? "almirante-bisagra" : coincidencia[1] === "contable" ? "la-contable" : "chispa");
  const resumen = resumenPartida(
    {
      asientos: [
        { nombre: NOMBRE_TU_NAVE, esYo: true, desplazada: true, integridad: 100, fallosSeguidos: 0, viva: true },
        { nombre: NOMBRES_CORTOS_RIVAL[personalidad.id] ?? personalidad.nombre, integridad: 110, fallosSeguidos: 0, viva: true },
      ],
      ronda: 1,
      recientes: [],
      situacionForzada: "desplazada",
    },
    SEMILLA_GUION,
  );
  return { resumen: resumen.texto, rotulo: textoDesplazamiento(NOMBRE_TU_NAVE, true), personalidadId: personalidad.id };
}
