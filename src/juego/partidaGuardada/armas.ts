import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { esIdEquipo } from "@/sim/equipo/catalogo";

// usosPorArma y los robots cuentan también escudo y propulsores (ids de
// equipo), que no están en el catálogo de armas; buscarArma lanza ante un id
// desconocido y un validador no puede lanzar.
export function buscarArmaOpcional(id: string): boolean {
  return CATALOGO_ARMAS.some((arma) => arma.id === id) || esIdEquipo(id);
}
