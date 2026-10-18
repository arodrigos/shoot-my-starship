import { borrarPartidaGuardada, escribirPartidaGuardada, type MotivoFalloAlmacen, type ResultadoEscritura } from "@/juego/partidaGuardada/almacen";
import { crearInstantanea } from "@/juego/partidaGuardada/instantanea";
import type { DatosPartida } from "@/juego/partidaGuardada/tipos";

export interface EstadoGuardado {
  readonly existe: boolean;
  // numeroTurno de la instantánea que hay en el almacén; null si no hay.
  readonly numeroTurno: number | null;
  readonly error: MotivoFalloAlmacen | null;
  readonly ultimoGuardadoMs: number | null;
}

interface Dependencias {
  readonly escribir: (cadena: string) => ResultadoEscritura;
  readonly borrar: () => boolean;
  readonly ahora: () => number;
}

const DEPENDENCIAS_REALES: Dependencias = { escribir: escribirPartidaGuardada, borrar: borrarPartidaGuardada, ahora: () => performance.now() };

// Una instantánea por partida. La cadena se calcula al cerrar el turno (fuera
// de cualquier toque); en hidden/pagehide solo se reescribe la ya calculada,
// porque ahí no hay tiempo de codificar nada.
export class GuardadorPartida {
  private pendiente: { readonly cadena: string; readonly numeroTurno: number } | null = null;
  private existe = false;
  private numeroTurno: number | null = null;
  private error: MotivoFalloAlmacen | null = null;
  private ultimoGuardadoMs: number | null = null;
  private avisado = false;

  constructor(
    private readonly alFallar: (motivo: MotivoFalloAlmacen) => void,
    private readonly dependencias: Dependencias = DEPENDENCIAS_REALES,
  ) {}

  guardar(datos: DatosPartida): void {
    const inicio = this.dependencias.ahora();
    const cadena = crearInstantanea(datos);
    this.pendiente = { cadena, numeroTurno: datos.estado.numeroTurno };
    this.escribirPendiente();
    this.ultimoGuardadoMs = this.dependencias.ahora() - inicio;
  }

  // visibilitychange→hidden y pagehide: solo si la última escritura no se completó.
  reescribirSiPendiente(): void {
    if (this.pendiente !== null) this.escribirPendiente();
  }

  borrar(): void {
    this.pendiente = null;
    this.dependencias.borrar();
    this.existe = false;
    this.numeroTurno = null;
  }

  estado(): EstadoGuardado {
    return { existe: this.existe, numeroTurno: this.numeroTurno, error: this.error, ultimoGuardadoMs: this.ultimoGuardadoMs };
  }

  private escribirPendiente(): void {
    if (this.pendiente === null) return;
    const resultado = this.dependencias.escribir(this.pendiente.cadena);
    if (resultado.ok) {
      this.existe = true;
      this.numeroTurno = this.pendiente.numeroTurno;
      this.error = null;
      this.pendiente = null;
      return;
    }
    this.error = resultado.motivo;
    // Una vez por partida: no se repite en cada turno.
    if (!this.avisado) {
      this.avisado = true;
      this.alFallar(resultado.motivo);
    }
  }
}
