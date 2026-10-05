import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { elegirArma, quitarArma, seleccionInicial, type SeleccionArmas } from "@/sim/partida/economia";

// Puente React/Phaser de la pantalla de selección de armas (economia-loadout):
// mismo patrón singleton pub/sub que relevoStore.ts. Vive aparte del store de
// control porque la selección es privada de cada jugador y desaparece del DOM
// en cuanto confirma, sin dejar rastro para el siguiente.
export interface EstadoSeleccion {
  readonly activa: boolean;
  readonly jugador: string | null;
  // Con varios humanos el dispositivo cambia de manos: antes de enseñar
  // saldo y armas hay que tocar «Soy X», igual que en el relevo.
  readonly identificado: boolean;
  readonly seleccion: SeleccionArmas;
  // Qué le falta para pagar el arma que acaba de intentar elegir.
  readonly error: string | null;
  // Primer «Empezar» sin armas: avisa de que solo habrá las 3 gratis y pide
  // confirmar una segunda vez.
  readonly avisoVacio: boolean;
}

const ESTADO_INICIAL: EstadoSeleccion = {
  activa: false,
  jugador: null,
  identificado: true,
  seleccion: seleccionInicial(0),
  error: null,
  avisoVacio: false,
};

let estado: EstadoSeleccion = ESTADO_INICIAL;
let manejadorConfirmar: ((seleccion: SeleccionArmas) => void) | null = null;
const escuchas = new Set<() => void>();

function fijar(nuevo: EstadoSeleccion): void {
  estado = nuevo;
  for (const escucha of escuchas) escucha();
}

export function obtenerSeleccion(): EstadoSeleccion {
  return estado;
}

export function suscribirSeleccion(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function abrirSeleccion(jugador: string, saldo: number, pedirIdentificacion: boolean): void {
  fijar({ ...ESTADO_INICIAL, activa: true, jugador, identificado: !pedirIdentificacion, seleccion: seleccionInicial(saldo) });
}

export function identificarJugadorSeleccion(): void {
  if (estado.activa) fijar({ ...estado, identificado: true });
}

// Pulsar un arma ya elegida la devuelve (reembolsa); pulsar una que no se
// puede pagar no hace nada salvo explicar cuánto falta.
export function alternarArmaEnSeleccion(armaId: string): void {
  if (!estado.activa) return;
  const arma = CATALOGO_ARMAS.find((candidata) => candidata.id === armaId);
  if (!arma) return;
  if (estado.seleccion.armas.includes(armaId)) {
    fijar({ ...estado, seleccion: quitarArma(estado.seleccion, arma), error: null, avisoVacio: false });
    return;
  }
  const resultado = elegirArma(estado.seleccion, arma);
  if (resultado.ok) {
    fijar({ ...estado, seleccion: resultado.seleccion, error: null, avisoVacio: false });
  } else if (resultado.motivo === "saldo-insuficiente") {
    fijar({ ...estado, error: `${arma.nombre} cuesta ${resultado.faltan} créditos más de los que te quedan.`, avisoVacio: false });
  }
}

export function confirmarSeleccion(): void {
  if (!estado.activa || !estado.identificado) return;
  if (estado.seleccion.armas.length === 0 && !estado.avisoVacio) {
    fijar({ ...estado, avisoVacio: true });
    return;
  }
  manejadorConfirmar?.(estado.seleccion);
}

export function registrarManejadorSeleccion(manejador: (seleccion: SeleccionArmas) => void): () => void {
  manejadorConfirmar = manejador;
  return () => {
    if (manejadorConfirmar === manejador) manejadorConfirmar = null;
  };
}

export function cerrarSeleccion(): void {
  if (estado.activa) fijar(ESTADO_INICIAL);
}

export function reiniciarSeleccion(): void {
  fijar(ESTADO_INICIAL);
}
