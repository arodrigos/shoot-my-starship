// Máquina de estados pura del bloqueo de pantalla (Screen Wake Lock). No toca
// el navegador: devuelve los efectos que el store ejecuta, de modo que la
// regla "como mucho un bloqueo vivo, y ninguno fuera de la partida" se pueda
// probar con secuencias arbitrarias de eventos.

export type EstadoPantallaEncendida = "no-soportado" | "inactivo" | "pidiendo" | "activo" | "soltado" | "rechazado";

export type EventoPantallaEncendida =
  | { readonly tipo: "entrarPartida" }
  | { readonly tipo: "salirPartida" }
  | { readonly tipo: "parteVisible" }
  | { readonly tipo: "parteOculto" }
  | { readonly tipo: "documentoVisible" }
  | { readonly tipo: "documentoOculto" }
  | { readonly tipo: "peticionResuelta" }
  | { readonly tipo: "peticionRechazada" }
  | { readonly tipo: "liberadoPorSistema" }
  | { readonly tipo: "toqueEnPartida" };

export type EfectoPantallaEncendida = "pedir" | "soltar";

export interface DatosPantallaEncendida {
  readonly soportada: boolean;
  readonly enPartida: boolean;
  readonly parteVisible: boolean;
  readonly documentoVisible: boolean;
  readonly estado: EstadoPantallaEncendida;
  // Rechazos seguidos de peticiones lanzadas por un toque. El rechazo de la
  // petición del propio gesto de «Jugar» no cuenta: es el que motiva el
  // reintento, no un reintento.
  readonly rechazosSeguidos: number;
  // La petición en vuelo salió de un toque (y no de un gesto de partida).
  readonly peticionPorToque: boolean;
}

export const MAX_REINTENTOS_POR_TOQUE = 3;

export function estadoInicialPantallaEncendida(soportada: boolean): DatosPantallaEncendida {
  return {
    soportada,
    enPartida: false,
    parteVisible: false,
    documentoVisible: true,
    estado: soportada ? "inactivo" : "no-soportado",
    rechazosSeguidos: 0,
    peticionPorToque: false,
  };
}

export function seDesea(d: DatosPantallaEncendida): boolean {
  return d.soportada && d.enPartida && !d.parteVisible;
}

export interface Transicion {
  readonly estado: DatosPantallaEncendida;
  readonly efectos: readonly EfectoPantallaEncendida[];
}

export function transicionPantallaEncendida(previo: DatosPantallaEncendida, evento: EventoPantallaEncendida): Transicion {
  if (!previo.soportada) return { estado: previo, efectos: [] };
  let d = previo;
  const efectos: EfectoPantallaEncendida[] = [];
  // Un bloqueo "pendiente de llegar" solo se resuelve en peticionResuelta o
  // peticionRechazada; mientras tanto no se pide otro ni se da por soltado.
  const pidiendo = () => d.estado === "pidiendo";
  const soltarSiActivo = (destino: EstadoPantallaEncendida) => {
    if (d.estado === "activo") {
      efectos.push("soltar");
      d = { ...d, estado: destino };
    }
  };
  const pedir = (porToque: boolean) => {
    efectos.push("pedir");
    d = { ...d, estado: "pidiendo", peticionPorToque: porToque };
  };

  switch (evento.tipo) {
    case "entrarPartida":
      d = { ...d, enPartida: true, rechazosSeguidos: 0 };
      break;
    case "salirPartida":
      d = { ...d, enPartida: false };
      break;
    case "parteVisible":
      d = { ...d, parteVisible: true, rechazosSeguidos: 0 };
      break;
    case "parteOculto":
      d = { ...d, parteVisible: false };
      break;
    case "documentoVisible":
      d = { ...d, documentoVisible: true };
      break;
    case "documentoOculto":
      d = { ...d, documentoVisible: false };
      break;
    case "peticionResuelta":
      if (pidiendo()) {
        // Llegó tarde: si ya no se desea (parte, salida, página oculta) el
        // bloqueo recién concedido se suelta en el acto.
        d = { ...d, estado: "activo", rechazosSeguidos: 0 };
        if (!(seDesea(d) && d.documentoVisible)) soltarSiActivo("soltado");
      }
      break;
    case "peticionRechazada":
      if (pidiendo()) {
        d = { ...d, estado: "rechazado", rechazosSeguidos: d.peticionPorToque ? d.rechazosSeguidos + 1 : d.rechazosSeguidos };
      }
      break;
    case "liberadoPorSistema":
      if (d.estado === "activo") d = { ...d, estado: "soltado" };
      break;
    case "toqueEnPartida":
      if (
        seDesea(d) &&
        d.documentoVisible &&
        (d.estado === "soltado" || d.estado === "rechazado") &&
        d.rechazosSeguidos < MAX_REINTENTOS_POR_TOQUE
      ) {
        pedir(true);
      }
      return { estado: d, efectos };
  }

  // Reconciliación tras un cambio de contexto: lo que se desea manda.
  if (!seDesea(d) || !d.documentoVisible) {
    soltarSiActivo("soltado");
  }
  if (!d.enPartida && !pidiendo() && d.estado !== "inactivo") d = { ...d, estado: "inactivo" };
  else if (d.enPartida && d.parteVisible && d.estado === "inactivo") d = { ...d, estado: "soltado" };
  const llegaGesto = evento.tipo === "entrarPartida" || evento.tipo === "parteOculto" || evento.tipo === "documentoVisible";
  if (
    llegaGesto &&
    seDesea(d) &&
    d.documentoVisible &&
    (d.estado === "inactivo" || d.estado === "soltado" || (evento.tipo === "parteOculto" && d.estado === "rechazado"))
  ) {
    pedir(false);
  }
  return { estado: d, efectos };
}
