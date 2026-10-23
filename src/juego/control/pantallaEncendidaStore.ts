import {
  estadoInicialPantallaEncendida,
  seDesea,
  transicionPantallaEncendida,
  type DatosPantallaEncendida,
  type EfectoPantallaEncendida,
  type EventoPantallaEncendida,
} from "@/juego/control/pantallaEncendida";
import { obtenerParteDeGuerra, suscribirOtraPartida, suscribirParteDeGuerra } from "@/juego/control/parteDeGuerraStore";

// Lo mínimo que se usa de WakeLockSentinel y navigator.wakeLock; se declara
// aquí para poder inyectar un proveedor falso en los tests unitarios.
export interface CentinelaBloqueo {
  release(): Promise<void>;
  addEventListener(tipo: "release", escucha: () => void): void;
}
export interface ProveedorBloqueo {
  request(tipo: "screen"): Promise<CentinelaBloqueo>;
}

export interface InstantaneaPantallaEncendida {
  readonly soportada: boolean;
  readonly deseada: boolean;
  readonly estado: DatosPantallaEncendida["estado"];
  readonly peticiones: number;
  readonly sentinelasVivas: number;
  readonly rechazosSeguidos: number;
}

let proveedorInyectado: ProveedorBloqueo | null | undefined;
let datos: DatosPantallaEncendida | null = null;
let centinela: CentinelaBloqueo | null = null;
let peticiones = 0;
let instalado = false;

function proveedor(): ProveedorBloqueo | null {
  if (proveedorInyectado !== undefined) return proveedorInyectado;
  if (typeof navigator === "undefined") return null;
  const candidato = (navigator as Navigator & { wakeLock?: ProveedorBloqueo }).wakeLock;
  return candidato && typeof candidato.request === "function" ? candidato : null;
}

function actual(): DatosPantallaEncendida {
  if (datos === null) datos = estadoInicialPantallaEncendida(proveedor() !== null);
  return datos;
}

function soltarCentinela(): void {
  const viejo = centinela;
  centinela = null;
  if (viejo === null) return;
  // release() puede lanzar en seco o devolver una promesa rechazada: en los
  // dos casos el bloqueo ya no nos importa y el juego no debe enterarse.
  try {
    viejo.release().catch(() => undefined);
  } catch {
    // ignorado a propósito
  }
}

function pedir(): void {
  const p = proveedor();
  if (p === null) return;
  peticiones++;
  let promesa: Promise<CentinelaBloqueo>;
  try {
    promesa = p.request("screen");
  } catch {
    // Un request que lanza en seco se trata como rechazo, fuera de este
    // turno de la pila para no reentrar en la transición en curso.
    queueMicrotask(() => despachar({ tipo: "peticionRechazada" }));
    return;
  }
  promesa.then(
    (nuevo) => {
      // El centinela se guarda ANTES de avisar: si ya no se desea, la
      // transición pide soltar y tiene que encontrarlo.
      centinela = nuevo;
      try {
        nuevo.addEventListener("release", () => {
          // Un release tardío de un centinela ya sustituido no cuenta.
          if (centinela === nuevo) {
            centinela = null;
            despachar({ tipo: "liberadoPorSistema" });
          }
        });
      } catch {
        // sin escucha de release: el reintento por toque no se activará solo
      }
      despachar({ tipo: "peticionResuelta" });
    },
    () => despachar({ tipo: "peticionRechazada" }),
  );
}

function ejecutar(efecto: EfectoPantallaEncendida): void {
  if (efecto === "pedir") pedir();
  else soltarCentinela();
}

function despachar(evento: EventoPantallaEncendida): void {
  const { estado, efectos } = transicionPantallaEncendida(actual(), evento);
  datos = estado;
  for (const efecto of efectos) ejecutar(efecto);
}

export function obtenerPantallaEncendida(): InstantaneaPantallaEncendida {
  const d = actual();
  return {
    soportada: d.soportada,
    deseada: seDesea(d),
    estado: d.estado,
    peticiones,
    sentinelasVivas: centinela === null ? 0 : 1,
    rechazosSeguidos: d.rechazosSeguidos,
  };
}

// La llamada tiene que ocurrir de forma síncrona dentro del manejador del
// gesto (clic en «Jugar»/«Continuar»): fuera de él algunos navegadores
// rechazan el request.
export function marcarPartidaEnCurso(enCurso: boolean): void {
  despachar({ tipo: enCurso ? "entrarPartida" : "salirPartida" });
}

// Para los tests: parte limpio, con o sin API según el proveedor.
export function reiniciarPantallaEncendida(proveedorFalso?: ProveedorBloqueo | null): void {
  soltarCentinela();
  proveedorInyectado = proveedorFalso;
  datos = null;
  peticiones = 0;
}

// Cuelga el store del navegador: parte de guerra, «Otra partida», visibilidad,
// toques y el gancho de pruebas. Idempotente; devuelve la baja.
export function instalarPantallaEncendida(): () => void {
  if (instalado || typeof document === "undefined") return () => undefined;
  instalado = true;
  actual();
  const bajas: Array<() => void> = [];
  let parteVisible = obtenerParteDeGuerra().parte !== null;
  if (parteVisible) despachar({ tipo: "parteVisible" });
  bajas.push(
    suscribirParteDeGuerra(() => {
      const hay = obtenerParteDeGuerra().parte !== null;
      if (hay === parteVisible) return;
      parteVisible = hay;
      despachar({ tipo: hay ? "parteVisible" : "parteOculto" });
    }),
    // El clic en «Otra partida» pide el bloqueo dentro del propio gesto; el
    // parte se limpia más tarde, cuando arranca la escena nueva.
    suscribirOtraPartida(() => {
      parteVisible = false;
      despachar({ tipo: "parteOculto" });
    }),
  );
  const alCambiarVisibilidad = () => despachar({ tipo: document.visibilityState === "hidden" ? "documentoOculto" : "documentoVisible" });
  const alTocar = () => despachar({ tipo: "toqueEnPartida" });
  document.addEventListener("visibilitychange", alCambiarVisibilidad);
  document.addEventListener("pointerdown", alTocar, true);
  window.__debug = window.__debug ?? {};
  window.__debug.pantallaEncendida = obtenerPantallaEncendida;
  return () => {
    for (const baja of bajas) baja();
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    document.removeEventListener("pointerdown", alTocar, true);
    instalado = false;
  };
}
