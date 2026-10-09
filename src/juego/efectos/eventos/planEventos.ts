import type { EstadoUniverso, TipoEvento } from "@/sim/universo/tipos";

// Qué efectos gráficos tienen que verse para un EstadoUniverso. Es una función
// pura y sin Phaser para que la invariante «lo visible es exactamente lo que
// hay en el estado» se pruebe con estados generados, y para que la escena solo
// tenga que cuadrar lo que dibuja contra esta lista.
export interface EfectoPersistente {
  // Identidad estable: la escena crea lo que falta y destruye lo que sobra
  // comparando claves, sin reconstruir lo que sigue vivo.
  readonly clave: string;
  readonly tipo: TipoEvento;
  readonly nave?: number;
  readonly objeto?: number;
  // Solo viento-solar: de ahí sale el sentido de las estelas.
  readonly derivaAnadida?: number;
}

export function planificarPersistentes(universo: EstadoUniverso | undefined): readonly EfectoPersistente[] {
  if (universo === undefined) return [];
  const deEfectos = universo.efectos.map((efecto): EfectoPersistente => ({
    clave: efecto.nave === undefined ? `efecto:${efecto.tipo}` : `efecto:${efecto.tipo}:${efecto.nave}`,
    tipo: efecto.tipo,
    ...(efecto.nave !== undefined ? { nave: efecto.nave } : {}),
    ...(efecto.derivaAnadida !== undefined ? { derivaAnadida: efecto.derivaAnadida } : {}),
  }));
  const deObjetos = (universo.objetos ?? []).map((objeto): EfectoPersistente => ({ clave: `objeto:${objeto.id}`, tipo: objeto.tipo, objeto: objeto.id }));
  return [...deEfectos, ...deObjetos];
}

// Entradas de __debug.efectosVisibles: «evento-<tipo>».
export function etiquetaDebug(tipo: TipoEvento): `evento-${TipoEvento}` {
  return `evento-${tipo}`;
}

// Eventos que no dejan nada en el estado (lotería, reparación, terremoto): su
// efecto es un destello que se ve un rato y se va solo. La duración es
// generosa a propósito: el e2e lo observa un segundo después de forzarlo.
export const DURACION_TRANSITORIO_MS: Readonly<Partial<Record<TipoEvento, number>>> = {
  loteria: 2400,
  reparacion: 2000,
  terremoto: 2400,
};
