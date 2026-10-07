import type { ModoJuego } from "@/sim/partida/tipos";
import type { FasePartida, TipoEvento } from "@/sim/universo/tipos";

export interface DefinicionEvento {
  readonly tipo: TipoEvento;
  readonly nombre: string;
  readonly bueno: boolean;
  // Sobre qué cae: una nave concreta o el universo entero (el afectado sorteado
  // solo se muestra en el cartel cuando es de nave).
  readonly alcance: "nave" | "global";
  readonly curativo: boolean;
  readonly soloPresupuesto: boolean;
}

// Los eventos son datos: añadir uno es añadir una entrada, y la lógica de
// efectos.ts despacha por `tipo`.
export const CATALOGO_EVENTOS: readonly DefinicionEvento[] = [
  { tipo: "loteria", nombre: "Lotería galáctica", bueno: true, alcance: "nave", curativo: false, soloPresupuesto: true },
  { tipo: "vitaminas", nombre: "Vitaminas artificiales", bueno: true, alcance: "nave", curativo: false, soloPresupuesto: false },
  { tipo: "virus", nombre: "Virus", bueno: false, alcance: "nave", curativo: false, soloPresupuesto: false },
  { tipo: "reparacion", nombre: "Reparación de planetas", bueno: true, alcance: "global", curativo: true, soloPresupuesto: false },
  { tipo: "terremoto", nombre: "Terremoto galáctico", bueno: false, alcance: "global", curativo: false, soloPresupuesto: false },
  { tipo: "gravedad-x2", nombre: "Gravedad ×2", bueno: false, alcance: "global", curativo: false, soloPresupuesto: false },
  { tipo: "gravedad-mitad", nombre: "Gravedad ÷2", bueno: false, alcance: "global", curativo: false, soloPresupuesto: false },
  { tipo: "viento-solar", nombre: "Viento solar", bueno: false, alcance: "global", curativo: false, soloPresupuesto: false },
  { tipo: "agujero-negro", nombre: "Agujero negro errante", bueno: false, alcance: "global", curativo: false, soloPresupuesto: false },
  { tipo: "corazon", nombre: "Corazón galáctico", bueno: true, alcance: "global", curativo: true, soloPresupuesto: false },
  { tipo: "tormenta", nombre: "Tormenta solar", bueno: false, alcance: "global", curativo: false, soloPresupuesto: false },
];

export function buscarEvento(tipo: TipoEvento): DefinicionEvento {
  const definicion = CATALOGO_EVENTOS.find((candidata) => candidata.tipo === tipo);
  if (definicion === undefined) throw new Error(`buscarEvento: tipo desconocido "${tipo}"`);
  return definicion;
}

// Sin lotería en barra libre (no hay saldo que premiar) y sin eventos curativos
// durante la muerte súbita (alargarían la partida que ese drenaje quiere cerrar).
export function eventosDisponibles(modo: ModoJuego | undefined, fase: FasePartida): readonly DefinicionEvento[] {
  return CATALOGO_EVENTOS.filter(
    (evento) => !(evento.soloPresupuesto && modo !== "presupuesto") && !(evento.curativo && fase === "muerte-subita"),
  );
}
