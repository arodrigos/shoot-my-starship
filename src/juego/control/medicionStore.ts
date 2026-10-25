// Puente React/Phaser de la partida de medición (?rendimiento=1 → «Medir»).
// Mismo patrón pub/sub que el resto de stores: la escena y el guion escriben,
// Aplicacion y el panel leen.

export type NombreTramoStore = "reposo" | "pepinazo" | "racimo" | "propulsores" | "turno-ia";

export interface EstadoMedicion {
  estado: "inactiva" | "en-curso" | "terminada" | "cancelada" | "incompleta";
  tramo: { indice: number; total: 5; nombre: NombreTramoStore } | null;
  copia: "pendiente" | "copiada" | "fallida" | "no-soportada";
  texto: string | null;
  valida: boolean | null;
  // Punto de impacto de cada tramo de arma, para comprobar que dos
  // ejecuciones juegan la misma partida.
  impactos: Partial<Record<NombreTramoStore, { x: number; y: number }>>;
}

// Semilla fija: dos ejecuciones con el mismo viewport juegan la misma partida.
export const SEMILLA_MEDICION = 20261025;

const INICIAL: EstadoMedicion = { estado: "inactiva", tramo: null, copia: "pendiente", texto: null, valida: null, impactos: {} };
let actual: EstadoMedicion = INICIAL;
const escuchas = new Set<() => void>();
// Lo que el recuadro sabía al pulsar «Medir»: el INP de los toques reales de la
// sesión, que el recorrido (sin toques) no puede medir.
let inpAlIniciar: number | null = null;
let cancelacion = false;

function fijar(cambio: Partial<EstadoMedicion>): void {
  actual = { ...actual, ...cambio };
  for (const escucha of escuchas) escucha();
}

export function obtenerMedicion(): EstadoMedicion {
  return actual;
}

export function suscribirMedicion(fn: () => void): () => void {
  escuchas.add(fn);
  return () => escuchas.delete(fn);
}

export function iniciarPartidaMedicion(inpToques: number | null = null, copia: EstadoMedicion["copia"] = "pendiente"): void {
  if (actual.estado === "en-curso") return;
  inpAlIniciar = inpToques;
  cancelacion = false;
  actual = { ...INICIAL, estado: "en-curso", copia };
  for (const escucha of escuchas) escucha();
}

export function inpAlIniciarMedicion(): number | null {
  return inpAlIniciar;
}

export function fijarTramoMedicion(indice: number, nombre: NombreTramoStore): void {
  fijar({ tramo: { indice, total: 5, nombre } });
}

export function terminarMedicion(final: Pick<EstadoMedicion, "estado" | "texto" | "valida">): void {
  fijar({ ...final, tramo: null });
}

export function fijarCopiaMedicion(copia: EstadoMedicion["copia"]): void {
  fijar({ copia });
}

export function cancelarMedicion(): void {
  cancelacion = true;
}

export function medicionCancelada(): boolean {
  return cancelacion;
}

// La promesa del portapapeles se arma en el toque de «Medir» (el único gesto
// del usuario) y la resuelve el guion al acabar con el texto.
export function guardarResolutorCopia(resolver: (texto: string) => void, rechazar: (e: unknown) => void): void {
  resolutorCopia = { resolver, rechazar };
}
let resolutorCopia: { resolver: (texto: string) => void; rechazar: (e: unknown) => void } | null = null;

export function resolverCopia(texto: string): void {
  resolutorCopia?.resolver(texto);
  resolutorCopia = null;
}

export function rechazarCopia(e: unknown): void {
  resolutorCopia?.rechazar(e);
  resolutorCopia = null;
}

export function reiniciarMedicion(): void {
  actual = INICIAL;
  inpAlIniciar = null;
  resolutorCopia = null;
  cancelacion = false;
  for (const escucha of escuchas) escucha();
}

export function registrarImpactoMedicion(nombre: NombreTramoStore, punto: { x: number; y: number }): void {
  fijar({ impactos: { ...actual.impactos, [nombre]: punto } });
}
