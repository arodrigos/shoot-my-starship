import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { crearRastreadorImpactoNaves } from "@/sim/naves/impacto";
import type { EstadoAleatorio } from "@/sim/aleatorio";
import { esSolido } from "@/sim/terreno/mascara";
import type { EventoSimulacion } from "@/sim/partida/eventos";
import { idsNavesVivas, type EstadoNave, type EstadoPartida, type IdNave } from "@/sim/partida/tipos";
import { sortearIndice } from "@/sim/universo/calendario";
import type { EstadoUniverso, ObjetoEvento, TipoObjeto } from "@/sim/universo/tipos";

// «Si choca con tu nave»: porcentajes sobre la vida máxima (100).
export const VIDA_CORAZON = 50;
export const VIDA_TORMENTA = 25;
export const MAX_OBJETOS_VIVOS = 2;
export const RONDAS_DE_VIDA_OBJETO = 3;
// Lo que se mueve un objeto al cerrar cada turno: ventana fija de pasos, la
// misma que recorre la ruta punteada del pronóstico.
export const VENTANA_PASOS_OBJETO = 180;
// Lento a propósito: tiene que dar tiempo a ir a por el corazón con los
// propulsores (alcance de ~1/4 de pantalla) o a apartarse de la tormenta.
const VELOCIDAD_MIN_OBJETO = 80;
const VELOCIDAD_MAX_OBJETO = 140;
// Dispersión angular alrededor de la dirección hacia el afectado.
const ABANICO_GRADOS = 30;

export type DestinoObjeto =
  | { readonly tipo: "vuela" }
  | { readonly tipo: "casco"; readonly nave: IdNave }
  | { readonly tipo: "planeta" }
  | { readonly tipo: "fuera" };

export interface VueloObjeto {
  // Posiciones paso a paso, de la inicial a la final: es lo que se dibuja y lo
  // que se recorre, calculado una sola vez por la misma función.
  readonly ruta: readonly { readonly x: number; readonly y: number }[];
  readonly final: ObjetoEvento;
  readonly destino: DestinoObjeto;
}

// Único sitio donde se integra un objeto: el pronóstico y el cierre de turno lo
// llaman con el mismo estado, así que la ruta dibujada es la recorrida y
// cualquier cambio de gravedad se refleja sin código aparte.
export function volarObjeto(estado: EstadoPartida, objeto: ObjetoEvento): VueloObjeto {
  const { mundo, mascara, planetas } = estado;
  const vivas = idsNavesVivas(estado).flatMap((id) => {
    const nave = estado.naves[id];
    return nave.y === undefined ? [] : [{ id, x: nave.x, y: nave.y, integridad: nave.integridad }];
  });
  // Ninguna nave es «propia»: el objeto no sale de ninguna, así que no hay gracia de casco.
  const rastreadorNaves = crearRastreadorImpactoNaves(vivas, -1);
  const ruta: { x: number; y: number }[] = [{ x: objeto.x, y: objeto.y }];
  let destino: DestinoObjeto = { tipo: "vuela" };
  let pasos = 0;
  const resultado = simularVuelo(
    crearProyectil(objeto.x, objeto.y, objeto.vx, objeto.vy),
    mundo.gravedad,
    mundo.deriva,
    (cuerpo) => {
      if (pasos > 0) ruta.push({ x: cuerpo.x, y: cuerpo.y });
      pasos++;
      if (cuerpo.x < 0 || cuerpo.x > mundo.ancho || cuerpo.y < 0 || cuerpo.y > mundo.alto) {
        destino = { tipo: "fuera" };
        return true;
      }
      if (esSolido(mascara, Math.round(cuerpo.x), Math.round(cuerpo.y))) {
        destino = { tipo: "planeta" };
        return true;
      }
      return pasos > VENTANA_PASOS_OBJETO;
    },
    { ...(planetas ? { planetas } : {}), presupuestoPasos: VENTANA_PASOS_OBJETO + 2, rastreadorNaves },
  );
  if (resultado.impactoNave !== null) {
    destino = { tipo: "casco", nave: resultado.impactoNave.nave };
    ruta.push({ x: resultado.impactoNave.x, y: resultado.impactoNave.y });
  }
  const p = resultado.proyectil;
  return { ruta, final: { ...objeto, x: p.x, y: p.y, vx: p.vx, vy: p.vy }, destino };
}

// Ruta que dibuja el pronóstico del turno siguiente: la misma función de vuelo.
export function rutaPrevistaObjeto(estado: EstadoPartida, objeto: ObjetoEvento): readonly { readonly x: number; readonly y: number }[] {
  return volarObjeto(estado, objeto).ruta;
}

function conVida(nave: EstadoNave, cambio: number): { nave: EstadoNave; aplicado: number } {
  const integridad = Math.min(100, Math.max(0, nave.integridad + cambio));
  return { nave: { ...nave, integridad }, aplicado: integridad - nave.integridad };
}

// Cierre de turno de los objetos: cada uno vuela su ventana; si toca un casco
// aplica su efecto una sola vez y desaparece en ese mismo paso. La tormenta
// ignora el escudo a propósito: es el riesgo que los propulsores sí esquivan.
export function avanzarObjetos(estado: EstadoPartida, naves: readonly EstadoNave[]): { naves: EstadoNave[]; universo: EstadoUniverso; eventos: EventoSimulacion[] } {
  const universo = estado.universo as EstadoUniverso;
  const objetos = universo.objetos ?? [];
  if (objetos.length === 0) return { naves: [...naves], universo, eventos: [] };
  const eventos: EventoSimulacion[] = [];
  const actuales = [...naves];
  const vivos: ObjetoEvento[] = [];
  for (const objeto of objetos) {
    const vuelo = volarObjeto({ ...estado, naves: actuales }, objeto);
    if (vuelo.destino.tipo === "casco") {
      const id = vuelo.destino.nave;
      const efecto = conVida(actuales[id], objeto.tipo === "corazon" ? VIDA_CORAZON : -VIDA_TORMENTA);
      actuales[id] = efecto.nave;
      eventos.push({ tipo: "objeto-alcanza", objeto: objeto.tipo, nave: id, cambio: efecto.aplicado });
      continue;
    }
    const turnosRestantes = objeto.turnosRestantes - 1;
    if (vuelo.destino.tipo === "vuela" && turnosRestantes > 0) vivos.push({ ...vuelo.final, turnosRestantes });
  }
  return { naves: actuales, universo: { ...universo, objetos: vivos }, eventos };
}

// Nace en el borde del mundo (izquierdo, derecho o superior: abajo está la consola), apuntando hacia el afectado con un abanico, para
// que «cae a favor de cualquier nave» sea cierto sin que el tiro sea seguro.
export function crearObjeto(
  estado: EstadoPartida,
  tipo: TipoObjeto,
  afectado: IdNave,
  aleatorioInicial: EstadoAleatorio,
): { objeto: ObjetoEvento; aleatorio: EstadoAleatorio } {
  const universo = estado.universo as EstadoUniverso;
  const { ancho, alto } = estado.mundo;
  const lado = sortearIndice(aleatorioInicial, 3);
  const posicion = sortearIndice(lado.aleatorio, 1001);
  const desvio = sortearIndice(posicion.aleatorio, 1001);
  const rapidez = sortearIndice(desvio.aleatorio, 1001);
  const fraccion = 0.1 + 0.8 * (posicion.indice / 1000);
  const x = lado.indice === 0 ? 1 : lado.indice === 1 ? ancho - 1 : ancho * fraccion;
  const y = lado.indice === 2 ? 1 : alto * fraccion * 0.7;
  const nave = estado.naves[afectado];
  const destinoY = nave.y ?? alto / 2;
  const hacia = Math.atan2(destinoY - y, nave.x - x) + ((desvio.indice / 1000 - 0.5) * 2 * ABANICO_GRADOS * Math.PI) / 180;
  const velocidad = VELOCIDAD_MIN_OBJETO + (rapidez.indice / 1000) * (VELOCIDAD_MAX_OBJETO - VELOCIDAD_MIN_OBJETO);
  const contador = universo.contadorObjetos ?? 0;
  const turnosRestantes = RONDAS_DE_VIDA_OBJETO * Math.max(1, idsNavesVivas(estado).length);
  return {
    objeto: { id: contador, tipo, x, y, vx: velocidad * Math.cos(hacia), vy: velocidad * Math.sin(hacia), turnosRestantes },
    aleatorio: rapidez.aleatorio,
  };
}
