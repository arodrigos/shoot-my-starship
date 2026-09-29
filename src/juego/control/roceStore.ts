// contacto-honesto (con-3, con-6): puente React/Phaser para el mensaje de
// roce -- mismo patrón singleton pub/sub que resultadoTurnoStore.ts. Vive
// aparte de ese store (y no simplemente concatenado a su texto) porque
// con-6 exige que su panel no se solape ni con el de resultado ni con el de
// broma: necesita su propia posición en pantalla, y por tanto su propio
// suscriptor.
export interface EstadoRoce {
  readonly texto: string | null;
}

let estado: EstadoRoce = { texto: null };
const escuchas = new Set<() => void>();

function fijar(parcial: Partial<EstadoRoce>): void {
  estado = { ...estado, ...parcial };
  for (const escucha of escuchas) escucha();
}

export function obtenerRoce(): EstadoRoce {
  return estado;
}

export function suscribirRoce(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarRoce(texto: string): void {
  fijar({ texto });
}

// Se limpia en cada disparo nuevo (dispararEntrada) para que un roce viejo
// no se quede pegado en pantalla turnos después de que dejó de ser cierto.
export function limpiarRoce(): void {
  fijar({ texto: null });
}
