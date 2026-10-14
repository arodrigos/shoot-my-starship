import { despacharPwa, obtenerDatosPwa } from "@/juego/pwa/estadoPwa";

// Lo mínimo que se usa de @serwist/window, para poder probar el ciclo de vida
// con un doble sin cargar el service worker real.
export interface SerwistVentana {
  addEventListener(tipo: "installed", oyente: (evento: { isUpdate?: boolean }) => void): void;
  addEventListener(tipo: "waiting", oyente: (evento: { wasWaitingBeforeRegister?: boolean }) => void): void;
  addEventListener(tipo: "controlling", oyente: () => void): void;
  register(): Promise<unknown>;
  update(): Promise<void>;
  messageSkipWaiting(): void;
}

export interface EntornoCiclo {
  readonly enLinea: () => boolean;
  readonly almacenamiento: { persist?: () => Promise<boolean> } | undefined;
  readonly recargar: () => void;
}

// forzarVersionNueva (y cualquier segundo registro) deja más de una instancia
// escuchando "controlling": sin este cerrojo cada una pediría su recarga.
let recargando = false;

// Conecta los eventos del service worker al estado PWA. skipWaiting está a
// false en el worker: una versión nueva solo toma el mando cuando el usuario
// pulsa Recargar, nunca a mitad de partida mezclando chunks de dos builds.
export function conectarCiclo(sw: SerwistVentana, entorno: EntornoCiclo): void {
  sw.addEventListener("installed", (evento) => {
    const esActualizacion = evento.isUpdate === true;
    despacharPwa({ tipo: "instalado", esActualizacion });
    // Sin persist(), iOS puede desalojar la caché de un juego que no se abre
    // en semanas; si lo deniega no pasa nada visible.
    if (!esActualizacion) void entorno.almacenamiento?.persist?.().catch(() => undefined);
  });
  sw.addEventListener("waiting", () => despacharPwa({ tipo: "esperando" }));
  sw.addEventListener("controlling", () => {
    despacharPwa({ tipo: "controlando" });
    if (!recargando && obtenerDatosPwa().recargaPedida) {
      recargando = true;
      entorno.recargar();
    }
  });
}

export async function comprobarActualizacion(sw: SerwistVentana, entorno: EntornoCiclo): Promise<void> {
  try {
    await sw.update();
    despacharPwa({ tipo: "comprobacion-ok" });
  } catch {
    despacharPwa({ tipo: "fallo-comprobacion", conRed: entorno.enLinea() });
  }
}

export function pulsarRecargar(sw: SerwistVentana): void {
  despacharPwa({ tipo: "recargar" });
  sw.messageSkipWaiting();
}
