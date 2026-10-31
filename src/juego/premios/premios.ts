import type { EstadisticasAsiento } from "./estadisticas";

export interface PremioAsiento {
  readonly id: string;
  readonly nombre: string;
  readonly cifra: number;
  readonly texto: string;
}

interface DefinicionPremio {
  readonly id: string;
  readonly nombre: string;
  // Valor con el que compiten los asientos; un asiento opta solo si valor >= umbral.
  readonly valor: (e: EstadisticasAsiento) => number;
  readonly umbral: number;
  readonly texto: (e: EstadisticasAsiento, cifra: number) => string;
}

const veces = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;
// Con menos de 5 disparos el porcentaje no dice nada: no opta al premio.
const DISPAROS_MINIMOS_PUNTERIA = 5;
const porcentaje = (e: EstadisticasAsiento): number =>
  e.disparos >= DISPAROS_MINIMOS_PUNTERIA ? Math.round((100 * e.aciertos) / e.disparos) : 0;

// Banco de mérito, en el orden en que se reparten. Los nombres son propios
// (ver tests/unit/premios/premios.test.ts contra no-copiar.md) y cada texto
// lleva la cifra que lo justifica (humor-7). Los umbrales evitan que salga un
// premio por un dato anecdótico.
export const BANCO_MERITO: readonly DefinicionPremio[] = [
  {
    id: "punteria",
    nombre: "Pulso de Cirujano",
    valor: porcentaje,
    umbral: 1,
    texto: (e, c) => `Acertó ${e.aciertos} de ${veces(e.disparos, "disparo", "disparos")} (${c} %)`,
  },
  {
    id: "remate",
    nombre: "La Última Palabra",
    valor: (e) => (e.remateFinal ? 1 : 0),
    umbral: 1,
    texto: () => "Dio el golpe que cerró la partida",
  },
  {
    id: "curva",
    nombre: "Doblarrumbos",
    valor: (e) => Math.round(e.giroMaximoGrados),
    umbral: 60,
    texto: (_e, c) => `Su tiro más curvado giró ${c}° entre los pozos`,
  },
  {
    id: "danio",
    nombre: "Mano de Hierro",
    valor: (e) => e.danioHecho,
    umbral: 30,
    texto: (_e, c) => `${c} puntos de daño hechos a los demás`,
  },
  {
    id: "bajas",
    nombre: "Cosechador de Chatarra",
    valor: (e) => e.bajas,
    umbral: 1,
    texto: (_e, c) => `Dejó fuera de combate a ${veces(c, "nave", "naves")}`,
  },
  {
    id: "autoimpactos",
    nombre: "Fuego Propio de Autor",
    valor: (e) => e.autoimpactos,
    umbral: 1,
    texto: (_e, c) => `Se dio a sí mismo ${veces(c, "vez", "veces")}`,
  },
  {
    id: "pixeles",
    nombre: "Topo Espacial",
    valor: (e) => e.pixelesDestruidos,
    // Desde #383 los píxeles cuentan todo material, no solo SOLIDO: con 300
    // salía en el 100 % de las partidas. 5500 lo devuelve a ~76 % (medir:premios).
    umbral: 5500,
    texto: (_e, c) => `Arrancó ${c} píxeles de mundo`,
  },
  {
    id: "recibido",
    nombre: "Imán de Metralla",
    valor: (e) => e.danioRecibido,
    umbral: 30,
    texto: (_e, c) => `Encajó ${c} puntos de daño`,
  },
  {
    id: "perdidos",
    nombre: "Tirador al Infinito",
    valor: (e) => e.perdidos,
    umbral: 2,
    texto: (_e, c) => `${veces(c, "proyectil", "proyectiles")} se fueron a ninguna parte`,
  },
  {
    id: "vida",
    nombre: "Última Chapa en Pie",
    valor: (e) => (e.vivo ? e.integridadFinal : 0),
    umbral: 1,
    texto: (_e, c) => `Acabó con ${c} de integridad`,
  },
  {
    id: "intacto",
    nombre: "Casco sin Rascar",
    valor: (e) => (e.vivo && e.danioRecibido === 0 ? e.disparos : 0),
    umbral: 3,
    texto: (_e, c) => `${veces(c, "disparo", "disparos")} sin recibir ni un rasguño`,
  },
  {
    id: "gatillo",
    nombre: "Dedo Nervioso",
    valor: (e) => e.disparos,
    umbral: 8,
    texto: (_e, c) => `${c} disparos en una sola partida`,
  },
  {
    id: "fallos",
    nombre: "Fallón Constante",
    valor: (e) => e.disparos - e.aciertos,
    umbral: 4,
    texto: (_e, c) => `${c} disparos sin dar a nadie`,
  },
];

// Consolación: umbral 0, siempre disponibles. Hay cuatro para que cuatro
// asientos sin mérito reciban premios distintos (ningún premio va a dos).
export const BANCO_CONSOLACION: readonly DefinicionPremio[] = [
  {
    id: "constancia",
    nombre: "La Constancia",
    valor: (e) => e.disparos,
    umbral: 0,
    texto: (_e, c) => `Disparó ${veces(c, "vez", "veces")} sin rendirse`,
  },
  {
    id: "aguante",
    nombre: "Chatarra con Honor",
    valor: (e) => e.danioRecibido,
    umbral: 0,
    texto: (_e, c) => `Aguantó ${c} puntos de daño`,
  },
  {
    id: "cortesia",
    nombre: "Vuelo de Cortesía",
    valor: (e) => e.perdidos + e.aciertos,
    umbral: 0,
    texto: (_e, c) => `${veces(c, "proyectil", "proyectiles")} dieron una vuelta por el cosmos`,
  },
  {
    id: "presencia",
    nombre: "Piloto Honorario",
    valor: (e) => Math.round(e.integridadFinal),
    umbral: 0,
    texto: (_e, c) => `Terminó con ${c} de integridad y la cabeza alta`,
  },
];

function premioDe(def: DefinicionPremio, e: EstadisticasAsiento): PremioAsiento {
  const cifra = def.valor(e);
  return { id: def.id, nombre: def.nombre, cifra, texto: def.texto(e, cifra) };
}

// Reparto determinista e independiente del orden de entrada: se trabaja
// siempre ordenado por asiento. Primero cada premio de mérito a quien más
// vale entre quienes aún no tienen ninguno, después un segundo premio como
// máximo, y por último la consolación para quien siguiera sin nada. Empate:
// gana el asiento menor.
export function asignarPremios(estadisticas: readonly EstadisticasAsiento[]): PremioAsiento[][] {
  const ordenadas = [...estadisticas].sort((a, b) => a.asiento - b.asiento);
  const recibidos = new Map<number, PremioAsiento[]>(ordenadas.map((e) => [e.asiento, []]));

  const repartir = (def: DefinicionPremio, tope: number): boolean => {
    let mejor: EstadisticasAsiento | null = null;
    let mejorValor = -Infinity;
    for (const e of ordenadas) {
      if (recibidos.get(e.asiento)!.length >= tope) continue;
      const v = def.valor(e);
      if (v >= def.umbral && v > mejorValor) {
        mejor = e;
        mejorValor = v;
      }
    }
    if (!mejor) return false;
    recibidos.get(mejor.asiento)!.push(premioDe(def, mejor));
    return true;
  };

  const sinRepartir = BANCO_MERITO.filter((def) => !repartir(def, 1));
  for (const def of sinRepartir) repartir(def, 2);

  const consolaciones = [...BANCO_CONSOLACION];
  for (const e of ordenadas) {
    const lista = recibidos.get(e.asiento)!;
    if (lista.length > 0) continue;
    const def = consolaciones.shift();
    if (def) lista.push(premioDe(def, e));
  }
  return estadisticas.map((e) => recibidos.get(e.asiento)!);
}
