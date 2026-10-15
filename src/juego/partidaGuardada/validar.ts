import { buscarArmaOpcional } from "@/juego/partidaGuardada/armas";
import { decodificarRle } from "@/juego/partidaGuardada/codecRle";
import { MAX_NAVES, MIN_NAVES, sanearNombre, type JugadorConfig, type MemoriaIA } from "@/juego/jugadores";
import {
  MAX_CARACTERES_INSTANTANEA,
  VERSION_ESQUEMA,
  type CascaraGuardada,
  type ConfigGuardada,
  type MotivoDescarte,
  type ResultadoLectura,
  type SegundosRelojGuardado,
} from "@/juego/partidaGuardada/tipos";
import { INTEGRIDAD_MAXIMA } from "@/sim/naves/vida";
import { esNivelIA } from "@/sim/ia/nivel";
import type { UltimoIntentoIA } from "@/sim/ia/decidir";
import type { EstadisticasPartida } from "@/sim/partida/parteDeGuerra";
import type { EstadoNave, EstadoPartida, ModoJuego } from "@/sim/partida/tipos";
import type { Mascara } from "@/sim/terreno/mascara";

// Un fallo de validación lleva su motivo; validarInstantanea lo convierte en
// un descarte y nada más sale de aquí como excepción.
class Descarte extends Error {
  constructor(readonly motivo: MotivoDescarte) {
    super(motivo);
  }
}

function fallar(motivo: MotivoDescarte): never {
  throw new Descarte(motivo);
}

type Objeto = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function esFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

function objeto(valor: unknown, motivo: MotivoDescarte = "datos"): Objeto {
  return esObjeto(valor) ? valor : fallar(motivo);
}

function numero(valor: unknown, motivo: MotivoDescarte = "datos"): number {
  return esFinito(valor) ? valor : fallar(motivo);
}

function entero(valor: unknown, minimo: number, maximo: number, motivo: MotivoDescarte = "datos"): number {
  return esFinito(valor) && Number.isInteger(valor) && valor >= minimo && valor <= maximo ? valor : fallar(motivo);
}

function lista(valor: unknown, motivo: MotivoDescarte = "datos"): readonly unknown[] {
  return Array.isArray(valor) ? valor : fallar(motivo);
}

function nombreValido(valor: unknown): string {
  // sanearNombre es idempotente sobre un nombre ya saneado: si cambia algo, el
  // texto no salió de la portada.
  return typeof valor === "string" && valor.length > 0 && sanearNombre(valor, "") === valor ? valor : fallar("nombre");
}

function armaValida(id: string): void {
  if (!buscarArmaOpcional(id)) fallar("arma");
}

const MAX_LADO_MASCARA = 4096;

function mascaraDecodificada(valor: unknown): Mascara {
  const m = objeto(valor, "mascara");
  const ancho = entero(m.ancho, 1, MAX_LADO_MASCARA, "mascara");
  const alto = entero(m.alto, 1, MAX_LADO_MASCARA, "mascara");
  const codificada = objeto(m.datos, "mascara");
  if (codificada.codificacion !== "rle-1" || typeof codificada.datos !== "string") fallar("mascara");
  let datos: Uint8Array;
  try {
    datos = decodificarRle(codificada.datos);
  } catch {
    return fallar("mascara");
  }
  if (datos.length !== ancho * alto) fallar("mascara");
  return { ancho, alto, datos };
}

function naveValida(valor: unknown): EstadoNave {
  const n = objeto(valor, "naves");
  const integridad = numero(n.integridad, "naves");
  if (integridad < 0 || integridad > INTEGRIDAD_MAXIMA) fallar("naves");
  numero(n.x, "naves");
  if (n.y !== undefined) numero(n.y, "naves");
  if (n.escudoTurnosRestantes !== undefined) entero(n.escudoTurnosRestantes, 0, 1000, "naves");
  return n as unknown as EstadoNave;
}

function estadoValido(valor: unknown, jugadores: number): EstadoPartida {
  const e = objeto(valor);
  if (e.version !== 1) fallar("version");
  const mundo = objeto(e.mundo);
  numero(mundo.ancho);
  numero(mundo.alto);
  numero(mundo.gravedad);
  numero(mundo.deriva);
  if (typeof mundo.etiquetaDeriva !== "string") fallar("datos");
  const mascara = mascaraDecodificada(e.mascara);

  const brutas = lista(e.naves, "naves");
  if (brutas.length < MIN_NAVES || brutas.length > MAX_NAVES || brutas.length !== jugadores) fallar("naves");
  const naves = brutas.map(naveValida);

  const orden = lista(e.ordenTurno, "turno").map((id) => entero(id, 0, naves.length - 1, "turno"));
  if (orden.length !== naves.length || new Set(orden).size !== naves.length) fallar("turno");
  const turno = entero(e.turno, 0, naves.length - 1, "turno");
  if (!orden.includes(turno) || naves[turno].integridad <= 0) fallar("turno");
  entero(e.numeroTurno, 0, 1_000_000, "turno");

  const aleatorio = objeto(e.aleatorio);
  numero(aleatorio.semilla);
  if (!esObjeto(e.resultado) || e.resultado.tipo !== "en-curso") fallar("terminada");

  if (e.modo !== undefined && e.modo !== "barra-libre" && e.modo !== "presupuesto") fallar("datos");
  // JSON convierte el undefined de un saldo ausente en null; se devuelve a su forma.
  const saldos = e.saldos === undefined ? undefined : lista(e.saldos).map((s) => (s === null ? undefined : numero(s)));
  if (saldos !== undefined && saldos.length !== naves.length) fallar("datos");
  if (e.planetas !== undefined) lista(e.planetas).forEach((p) => numero(objeto(p).id));
  if (e.robots !== undefined) lista(e.robots).forEach((r) => armaValida(String(objeto(r).armaId)));
  if (e.ronda !== undefined) entero(e.ronda, 1, 10_000);
  if (e.muerteSubita !== undefined && typeof e.muerteSubita !== "boolean") fallar("datos");

  let universo: unknown;
  if (e.universo !== undefined) {
    const u = objeto(e.universo);
    lista(u.efectos);
    objeto(u.aleatorio);
    universo = { ...u, mascaraInicial: mascaraDecodificada(u.mascaraInicial) };
  }

  // Se parte de una copia y se sustituyen solo los campos que cambian al
  // decodificar; así no se arrastra nada que el esquema no conozca.
  const estado: Objeto = { ...e, mascara };
  if (saldos !== undefined) estado.saldos = saldos;
  if (universo !== undefined) estado.universo = universo;
  return estado as unknown as EstadoPartida;
}

function jugadorValido(valor: unknown): JugadorConfig {
  const j = objeto(valor);
  nombreValido(j.nombre);
  if (j.tipo !== "humano" && j.tipo !== "ia") fallar("datos");
  if (j.personalidadId !== undefined && typeof j.personalidadId !== "string") fallar("datos");
  if (j.nivel !== undefined && !esNivelIA(j.nivel)) fallar("datos");
  return j as unknown as JugadorConfig;
}

function configValida(valor: unknown): ConfigGuardada {
  const c = objeto(valor);
  const jugadores = lista(c.jugadores, "naves").map(jugadorValido);
  if (jugadores.length < MIN_NAVES || jugadores.length > MAX_NAVES) fallar("naves");
  const modo = c.modo === "barra-libre" || c.modo === "presupuesto" ? (c.modo as ModoJuego) : fallar("datos");
  if (typeof c.todosVemosTodo !== "boolean") fallar("datos");
  if (c.semillaSistema !== null && !esFinito(c.semillaSistema)) fallar("datos");
  if (c.mapaId !== null && typeof c.mapaId !== "string") fallar("datos");
  if (c.relojTurnoS !== null && c.relojTurnoS !== 30 && c.relojTurnoS !== 45 && c.relojTurnoS !== 60) fallar("datos");
  return {
    jugadores,
    modo,
    todosVemosTodo: c.todosVemosTodo,
    semillaSistema: c.semillaSistema as number | null,
    mapaId: c.mapaId as string | null,
    relojTurnoS: c.relojTurnoS as SegundosRelojGuardado | null,
  };
}

function ultimoIntentoValido(valor: unknown): UltimoIntentoIA | null {
  if (valor === null) return null;
  const u = objeto(valor);
  numero(u.distanciaAlObjetivoPx);
  for (const campo of ["fallosConsecutivos", "turnosSeguidosSinDanio", "turnosSeguidosDanioInsuficiente"]) {
    if (u[campo] !== undefined) numero(u[campo]);
  }
  return u as unknown as UltimoIntentoIA;
}

function memoriaValida(valor: unknown): MemoriaIA | null {
  if (valor === null) return null;
  const m = objeto(valor);
  const usos = objeto(m.usosPorArma);
  for (const [id, veces] of Object.entries(usos)) {
    armaValida(id);
    entero(veces, 0, 1_000_000);
  }
  numero(m.fallosConsecutivos);
  numero(m.turnosSeguidosSinDanio);
  numero(m.turnosSeguidosDanioInsuficiente);
  if (typeof m.danioRecibidoDesdeSuTurno !== "boolean") fallar("datos");
  return { ...(m as unknown as MemoriaIA), ultimoIntento: ultimoIntentoValido(m.ultimoIntento) };
}

function cascaraValida(valor: unknown, naves: number): CascaraGuardada {
  const c = objeto(valor);
  const memoriasIA = lista(c.memoriasIA).map(memoriaValida);
  if (memoriasIA.length !== naves) fallar("datos");
  const e = objeto(c.estadisticas);
  const estadisticas: EstadisticasPartida = {
    disparos: numero(e.disparos),
    fallos: numero(e.fallos),
    autoimpactos: numero(e.autoimpactos),
    danioHechoAlEnemigo: numero(e.danioHechoAlEnemigo),
    pixelesDestruidos: numero(e.pixelesDestruidos),
  };
  return { memoriasIA, estadisticas };
}

// Nunca lanza, con cualquier cadena. La aceptación depende solo de que los
// datos sean coherentes: versionJuego solo decide si se avisa (deOtraVersion)
// y con qué motivo se descarta lo que ya no encaja.
export function validarInstantanea(cadena: string, versionActual: string): ResultadoLectura {
  try {
    if (typeof cadena !== "string" || cadena.length > MAX_CARACTERES_INSTANTANEA) return { tipo: "descartada", motivo: "tamano" };
    let bruto: unknown;
    try {
      bruto = JSON.parse(cadena);
    } catch {
      return { tipo: "descartada", motivo: "json" };
    }
    const i = objeto(bruto, "json");
    if (i.version !== VERSION_ESQUEMA) return { tipo: "descartada", motivo: "version" };
    const versionJuego = typeof i.versionJuego === "string" ? i.versionJuego : fallar("datos");
    const deOtraVersion = versionJuego !== versionActual;
    try {
      const config = configValida(i.config);
      const estado = estadoValido(i.estado, config.jugadores.length);
      const cascara = cascaraValida(i.cascara, estado.naves.length);
      const guardadaEn = numero(i.guardadaEn);
      const r = objeto(i.rotulo);
      const rotulo = { ronda: entero(r.ronda, 1, 10_000), nombres: lista(r.nombres, "nombre").map(nombreValido) };
      return { tipo: "valida", datos: { estado, config, cascara }, deOtraVersion, guardadaEn, rotulo };
    } catch (error) {
      // Una partida de otra versión que ya no encaja (un arma retirada...) se
      // explica en la portada como incompatibilidad, no como corrupción.
      if (error instanceof Descarte && deOtraVersion) return { tipo: "descartada", motivo: "version-incompatible" };
      throw error;
    }
  } catch (error) {
    return { tipo: "descartada", motivo: error instanceof Descarte ? error.motivo : "datos" };
  }
}
