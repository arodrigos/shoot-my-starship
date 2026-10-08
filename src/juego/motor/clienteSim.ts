// Cliente del trabajador de simulación: expone promesas, descarta respuestas
// desfasadas y, sin Worker (o si falla), resuelve en línea con el MISMO
// manejador, así que la partida sigue igual aunque más lenta.
import { manejarPeticion } from "@/juego/motor/manejador";
import {
  TIEMPO_LIMITE_PETICION_MS,
  type Peticion,
  type Respuesta,
  type ResultadoDecidirIA,
  type ResultadoPrevisualizar,
  type ResultadoResolver,
  type TipoPeticion,
} from "@/juego/motor/protocolo";

export type ModoMotor = "trabajador" | "en-linea";

export interface TrabajadorLike {
  onmessage: ((evento: MessageEvent<Respuesta>) => void) | null;
  onerror: ((evento: unknown) => void) | null;
  postMessage(mensaje: Peticion): void;
  terminate(): void;
}

type SinCabecera<T extends Peticion> = Omit<T, "idPeticion" | "idPartida">;

// Regla de la cáscara: solo se aplica la respuesta que coincide con el último
// idPeticion emitido DE SU TIPO y con la partida vigente; el resto se
// descarta sin tocar el estado.
export function respuestaVigente(
  respuesta: Pick<Respuesta, "tipo" | "idPeticion" | "idPartida">,
  ultimoPorTipo: Readonly<Partial<Record<TipoPeticion, number>>>,
  idPartidaVigente: number,
): boolean {
  if (respuesta.idPartida !== idPartidaVigente || respuesta.tipo === "error") return false;
  return ultimoPorTipo[respuesta.tipo] === respuesta.idPeticion;
}

interface Pendiente {
  readonly tipo: TipoPeticion;
  readonly peticion: Peticion;
  readonly resolver: (respuesta: Respuesta | null) => void;
  readonly temporizador: ReturnType<typeof setTimeout>;
}

export class ClienteSim {
  modo: ModoMotor;
  motivoEnLinea: string | null = null;
  private trabajador: TrabajadorLike | null = null;
  private siguienteId = 1;
  private idPartida = 1;
  private readonly ultimoPorTipo: Partial<Record<TipoPeticion, number>> = {};
  private readonly pendientes = new Map<number, Pendiente>();

  constructor(fabrica: (() => TrabajadorLike) | null) {
    this.modo = "en-linea";
    if (fabrica) {
      try {
        this.trabajador = fabrica();
        this.trabajador.onmessage = (evento) => this.alRecibir(evento.data);
        this.trabajador.onerror = () => this.pasarAEnLinea("el trabajador lanzó un error");
        this.modo = "trabajador";
      } catch (error) {
        this.motivoEnLinea = error instanceof Error ? error.message : "no se pudo crear el trabajador";
      }
    } else {
      this.motivoEnLinea = "Worker no disponible";
    }
  }

  // Una escena nueva o un escenario cargado invalida todo lo que viaja.
  nuevaPartida(): void {
    this.idPartida++;
  }

  previsualizar(peticion: SinCabecera<Extract<Peticion, { tipo: "previsualizar" }>>): Promise<ResultadoPrevisualizar | null> {
    return this.pedir(peticion).then((r) => (r?.tipo === "previsualizar" ? r.resultado : null));
  }

  resolverDisparo(peticion: SinCabecera<Extract<Peticion, { tipo: "resolverDisparo" }>>): Promise<ResultadoResolver | null> {
    return this.pedir(peticion).then((r) => (r?.tipo === "resolverDisparo" ? r.resultado : null));
  }

  decidirIA(peticion: SinCabecera<Extract<Peticion, { tipo: "decidirIA" }>>): Promise<ResultadoDecidirIA | null> {
    return this.pedir(peticion).then((r) => (r?.tipo === "decidirIA" ? r.resultado : null));
  }

  private pedir(sinCabecera: SinCabecera<Peticion>): Promise<Respuesta | null> {
    const idPeticion = this.siguienteId++;
    const peticion = { ...sinCabecera, idPeticion, idPartida: this.idPartida } as Peticion;
    this.ultimoPorTipo[peticion.tipo] = idPeticion;
    return new Promise((resolver) => {
      const temporizador = setTimeout(() => {
        this.pasarAEnLinea(`la petición ${peticion.tipo} superó ${TIEMPO_LIMITE_PETICION_MS} ms`);
      }, TIEMPO_LIMITE_PETICION_MS);
      this.pendientes.set(idPeticion, { tipo: peticion.tipo, peticion, resolver, temporizador });
      this.enviar(peticion);
    });
  }

  private enviar(peticion: Peticion): void {
    if (this.modo === "trabajador" && this.trabajador) {
      try {
        this.trabajador.postMessage(peticion);
        return;
      } catch (error) {
        this.pasarAEnLinea(error instanceof Error ? error.message : "postMessage falló");
        return;
      }
    }
    // Se cede el hilo antes de calcular para que el toque que lo originó se
    // pinte primero, igual que haría la respuesta de un trabajador.
    setTimeout(() => this.alRecibir(manejarPeticion(peticion)), 0);
  }

  private alRecibir(respuesta: Respuesta): void {
    const pendiente = this.pendientes.get(respuesta.idPeticion);
    if (!pendiente) return;
    clearTimeout(pendiente.temporizador);
    this.pendientes.delete(respuesta.idPeticion);
    if (respuesta.tipo === "error") {
      // Un fallo del cálculo no es un fallo del transporte: se re-ejecuta en
      // línea para que el error real salga por el camino de siempre.
      pendiente.resolver(manejarPeticion(pendiente.peticion));
      return;
    }
    pendiente.resolver(respuestaVigente(respuesta, this.ultimoPorTipo, this.idPartida) ? respuesta : null);
  }

  private pasarAEnLinea(motivo: string): void {
    if (this.modo === "en-linea") return;
    this.modo = "en-linea";
    this.motivoEnLinea = motivo;
    this.trabajador?.terminate();
    this.trabajador = null;
    // Lo que estaba en vuelo se vuelve a pedir en línea: nadie queda colgado.
    const huerfanas = [...this.pendientes.values()];
    this.pendientes.clear();
    for (const p of huerfanas) {
      clearTimeout(p.temporizador);
      setTimeout(() => p.resolver(respuestaVigente(p.peticion, this.ultimoPorTipo, this.idPartida) ? manejarPeticion(p.peticion) : null), 0);
    }
  }

  terminar(): void {
    this.trabajador?.terminate();
    this.trabajador = null;
    for (const p of this.pendientes.values()) clearTimeout(p.temporizador);
    this.pendientes.clear();
  }
}
