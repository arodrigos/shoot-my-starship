// arma-granada-espoleta (gra-2): puente React/Phaser para la cuenta atrás
// visible de un proyectil "mecha" -- mismo patrón singleton pub/sub que
// roceStore.ts. Store propio (no un campo más de otro store) porque vive en
// la zona de juego, no en la consola, y ninguno de los stores existentes
// publica nada dentro de esa zona.
export interface EstadoCuentaAtras {
  readonly segundos: number | null;
}

let estado: EstadoCuentaAtras = { segundos: null };
const escuchas = new Set<() => void>();

function fijar(parcial: Partial<EstadoCuentaAtras>): void {
  estado = { ...estado, ...parcial };
  for (const escucha of escuchas) escucha();
}

export function obtenerCuentaAtras(): EstadoCuentaAtras {
  return estado;
}

export function suscribirCuentaAtras(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarCuentaAtras(segundos: number): void {
  if (estado.segundos === segundos) return;
  fijar({ segundos });
}

// Se limpia al empezar cada disparo nuevo y en cuanto el vuelo en curso deja
// de ser una espoleta encendida (impacto, fin de animación) -- igual que
// limpiarRoce(), para que un contador viejo no se quede pegado en pantalla.
export function limpiarCuentaAtras(): void {
  if (estado.segundos === null) return;
  fijar({ segundos: null });
}
