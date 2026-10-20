// Cliente del trabajador de simulación: expone promesas, descarta respuestas
// desfasadas y, sin Worker (o si falla), resuelve en línea con el MISMO
// manejador, así que la partida sigue igual aunque más lenta.
import { manejarPeticion } from "@/juego/motor/manejador";
import type { FaseImpacto } from "@/sim/partida/avanzar";
import {
  TIEMPO_LIMITE_PETICION_MS,
  TIEMPO_LIMITE_TRABAJADOR_VIVO_MS,
  type MetricasDeCalculo,
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

// Una fase del turno resuelta, con lo que costó: calculoMs es el tiempo dentro
// del trabajador y esperaColaMs lo que la petición estuvo esperando delante de
// otras (previsualizaciones, sobre todo).
export interface FaseResuelta<T> {
  readonly resultado: T;
  readonly metricas: MetricasDeCalculo & { readonly esperaColaMs: number };
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
  // Gancho de prueba: mientras sea true, el cierre no se entrega hasta soltarlo.
  private cierreRetenido = false;
  private liberarCierre: (() => void) | null = null;
  private previsEnVuelo = false;
  private previsPendiente: { readonly peticion: SinCabecera<Extract<Peticion, { tipo: "previsualizar" }>>; readonly resolver: (r: ResultadoPrevisualizar | null) => void } | null = null;
  private trabajador: TrabajadorLike | null = null;
  private siguienteId = 1;
  private idPartida = 1;
  private readonly ultimoPorTipo: Partial<Record<TipoPeticion, number>> = {};
  private readonly pendientes = new Map<number, Pendiente>();
  // Última vez que el trabajador contestó algo: distingue un trabajador roto
  // (mudo) de uno que solo va por detrás con la cola de peticiones.
  private ultimaRespuestaMs: number;
  private haRespondido = false;

  constructor(
    fabrica: (() => TrabajadorLike) | null,
    private readonly reloj: () => number = () => performance.now(),
  ) {
    this.ultimaRespuestaMs = reloj();
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
    this.previsPendiente?.resolver(null);
    this.previsPendiente = null;
  }

  // Como mucho una previsualización en el trabajador y una esperando detrás: si
  // el dedo pide más deprisa de lo que se calcula, las intermedias se resuelven
  // con null sin enviarse y la última es la que se calcula. Así un resolverImpacto
  // solo espera, como mucho, a una previsualización.
  previsualizar(peticion: SinCabecera<Extract<Peticion, { tipo: "previsualizar" }>>): Promise<ResultadoPrevisualizar | null> {
    return new Promise((resolver) => {
      this.previsPendiente?.resolver(null);
      this.previsPendiente = { peticion, resolver };
      this.enviarPrevisSiLibre();
    });
  }

  private enviarPrevisSiLibre(): void {
    if (this.previsEnVuelo || this.previsPendiente === null) return;
    const { peticion, resolver } = this.previsPendiente;
    this.previsPendiente = null;
    this.previsEnVuelo = true;
    void this.pedir(peticion).then((r) => {
      this.previsEnVuelo = false;
      // Si mientras tanto se pidió otra, esta ya no es la que interesa.
      resolver(this.previsPendiente === null && r?.tipo === "previsualizar" ? r.resultado : null);
      this.enviarPrevisSiLibre();
    });
  }

  resolverDisparo(peticion: SinCabecera<Extract<Peticion, { tipo: "resolverDisparo" }>>): Promise<ResultadoResolver | null> {
    return this.pedir(peticion).then((r) => (r?.tipo === "resolverDisparo" ? r.resultado : null));
  }

  retenerCierre(retener: boolean): void {
    this.cierreRetenido = retener;
    if (!retener) {
      this.liberarCierre?.();
      this.liberarCierre = null;
    }
  }

  async resolverImpacto(peticion: SinCabecera<Extract<Peticion, { tipo: "resolverImpacto" }>>): Promise<FaseResuelta<FaseImpacto> | null> {
    const enviada = this.reloj();
    const r = await this.pedir(peticion);
    return r?.tipo === "resolverImpacto" ? { resultado: r.resultado, metricas: { ...r.metricas, esperaColaMs: Math.max(0, this.reloj() - enviada - r.metricas.duracionMs) } } : null;
  }

  async cerrarTurno(peticion: SinCabecera<Extract<Peticion, { tipo: "cerrarTurno" }>>): Promise<FaseResuelta<ResultadoResolver> | null> {
    const enviada = this.reloj();
    const r = await this.pedir(peticion);
    if (r?.tipo !== "cerrarTurno") return null;
    // Se retiene hasta que la prueba lo suelta, no un tiempo fijo: con el render
    // por software la animación del impacto dura lo que dure, y un retardo fijo
    // podía vencer antes de que la píldora tuviera ocasión de mostrarse.
    const retenido = this.cierreRetenido;
    const inicioRetencion = this.reloj();
    if (retenido) await new Promise<void>((seguir) => { this.liberarCierre = seguir; });
    const esperaRetencion = retenido ? this.reloj() - inicioRetencion : 0;
    return { resultado: r.resultado, metricas: { ...r.metricas, esperaColaMs: Math.max(0, this.reloj() - enviada - r.metricas.duracionMs - esperaRetencion) } };
  }

  decidirIA(peticion: SinCabecera<Extract<Peticion, { tipo: "decidirIA" }>>): Promise<ResultadoDecidirIA | null> {
    return this.pedir(peticion).then((r) => (r?.tipo === "decidirIA" ? r.resultado : null));
  }

  private pedir(sinCabecera: SinCabecera<Peticion>): Promise<Respuesta | null> {
    const idPeticion = this.siguienteId++;
    const peticion = { ...sinCabecera, idPeticion, idPartida: this.idPartida } as Peticion;
    this.ultimoPorTipo[peticion.tipo] = idPeticion;
    return new Promise((resolver) => {
      const pendiente: Pendiente = { tipo: peticion.tipo, peticion, resolver, temporizador: this.armarTemporizador(peticion) };
      this.pendientes.set(idPeticion, pendiente);
      this.enviar(peticion);
    });
  }

  // Solo se abandona el trabajador si lleva TIEMPO_LIMITE_PETICION_MS sin
  // contestar nada. Si ha contestado hace poco, la petición espera su turno
  // en la cola: pasar al cálculo en línea bloquearía el hilo principal.
  private armarTemporizador(peticion: Peticion): ReturnType<typeof setTimeout> {
    const temporizador = setTimeout(() => {
      const pendiente = this.pendientes.get(peticion.idPeticion);
      if (!pendiente) return;
      const mudoMs = this.reloj() - this.ultimaRespuestaMs;
      const limiteMs = this.haRespondido ? TIEMPO_LIMITE_TRABAJADOR_VIVO_MS : TIEMPO_LIMITE_PETICION_MS;
      if (mudoMs < limiteMs) {
        this.pendientes.set(peticion.idPeticion, { ...pendiente, temporizador: this.armarTemporizador(peticion) });
        return;
      }
      this.pasarAEnLinea(`la petición ${peticion.tipo} superó ${limiteMs} ms (trabajador mudo ${Math.round(mudoMs)} ms, ${this.pendientes.size} pendientes)`);
    }, TIEMPO_LIMITE_PETICION_MS);
    return temporizador;
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
    this.ultimaRespuestaMs = this.reloj();
    this.haRespondido = true;
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
    this.previsPendiente?.resolver(null);
    this.previsPendiente = null;
    this.trabajador?.terminate();
    this.trabajador = null;
    for (const p of this.pendientes.values()) clearTimeout(p.temporizador);
    this.pendientes.clear();
  }
}
