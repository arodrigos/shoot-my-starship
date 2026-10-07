// cal-1..cal-4: un solo cálculo de la calibración de la economía para el script
// `calibrar:economia` (que escribe docs/calibracion-economia.md) y para los
// tests que vigilan que parametros.ts, los costes y el informe no discrepen.
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { FACILIDAD_MEDIDA_PCT } from "@/sim/armas/facilidadMedida";
import { curvaPrecio } from "@/sim/armas/precio";
import type { Arma } from "@/sim/armas/tipos";
import { PREMIO_LOTERIA, PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { CATALOGO_EQUIPO } from "@/sim/equipo/catalogo";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE } from "@/sim/ia/personalidades";
import type { Personalidad } from "@/sim/ia/tipos";
import { colocarNaves } from "@/sim/naves/colocacion";
import { avanzar } from "@/sim/partida/avanzar";
import { costeArma } from "@/sim/partida/economia";
import { conMuerteSubita } from "@/sim/partida/muerteSubita";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { conUniverso } from "@/sim/universo/efectos";

export function redondeaA50(valor: number): number {
  return Math.round(valor / 50) * 50;
}

export function redondeaA5(valor: number): number {
  return Math.round(valor / 5) * 5;
}

export interface FilaPrecio {
  readonly id: string;
  readonly nombre: string;
  readonly coste: number;
  readonly danioMaximo: number;
  readonly facilidad: number;
  readonly curva: number;
  readonly desviacion: number;
  // Daño esperado por crédito, relativo a la mediana del catálogo.
  readonly valorRelativo: number;
}

// Desviaciones de la curva o de la banda de valor que se declaran en el informe
// en vez de esconderse: el motivo viaja con el dato.
export const DESVIACIONES_DECLARADAS: Readonly<Record<string, string>> = {
  "rayo-laser":
    "Haz instantáneo inmune a la gravedad: la facilidad medida (1,2 %) subestima lo que paga el que no tiene que calcular la curva, así que el precio se queda cerca del máximo y su daño por crédito cae por debajo de la banda.",
};

export const BANDA_VALOR: readonly [number, number] = [0.6, 1.6];
export const TOLERANCIA_CURVA = 0.15;

function danioDe(arma: Arma): number {
  return arma.efecto.tipo === "empuje" ? 0 : arma.efecto.danioMaximo;
}

export function armasDePagoConDanio(catalogo: readonly Arma[] = CATALOGO_ARMAS): readonly Arma[] {
  return catalogo.filter((arma) => costeArma(arma) > 0 && arma.utilitaria !== true && danioDe(arma) > 0);
}

export function mediana(valores: readonly number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 0 ? (orden[medio - 1] + orden[medio]) / 2 : orden[medio];
}

export function tablaDePrecios(catalogo: readonly Arma[] = CATALOGO_ARMAS): readonly FilaPrecio[] {
  const armas = armasDePagoConDanio(catalogo);
  const facilidadDe = (arma: Arma): number => (FACILIDAD_MEDIDA_PCT[arma.id] ?? 0) / 100;
  const valores = armas.map((arma) => (danioDe(arma) * facilidadDe(arma)) / costeArma(arma));
  const valorMediano = mediana(valores);
  return armas.map((arma, indice) => {
    const curva = curvaPrecio(danioDe(arma), facilidadDe(arma));
    return {
      id: arma.id,
      nombre: arma.nombre,
      coste: costeArma(arma),
      danioMaximo: danioDe(arma),
      facilidad: facilidadDe(arma),
      curva,
      desviacion: Math.abs(costeArma(arma) - curva) / curva,
      valorRelativo: valores[indice] / valorMediano,
    };
  });
}

export interface ParametrosCalibrados {
  readonly medianaPrecios: number;
  readonly presupuestoBase: number;
  readonly premioLoteria: number;
}

export function calcularParametros(catalogo: readonly Arma[] = CATALOGO_ARMAS): ParametrosCalibrados {
  const medianaPrecios = mediana(armasDePagoConDanio(catalogo).map(costeArma));
  // La base ya no sale de la mediana: es fija (600) y los precios se calibran
  // contra ella (bloque calibrado-600).
  return { medianaPrecios, presupuestoBase: PRESUPUESTO_BASE, premioLoteria: PREMIO_LOTERIA };
}

export type EstrategiaCompra = "medio" | "caro" | "barato";

// Compradores deterministas sobre el catálogo: cuántas compras de arma de pago
// aguanta un saldo antes de quedarse solo con las gratis. Despedida se paga una
// sola vez por partida, como en el juego.
export function comprasHastaAgotar(estrategia: EstrategiaCompra, saldoInicial: number, extraGasto = 0): number {
  const armas = armasDePagoConDanio();
  const mediano = mediana(armas.map(costeArma));
  // El medio tiene una sola arma objetivo: la de precio más cercano a M. Si no
  // le llega para esa, no compra otra distinta.
  const objetivoMedio = armas.reduce((a, b) => (Math.abs(costeArma(b) - mediano) < Math.abs(costeArma(a) - mediano) ? b : a));
  let saldo = saldoInicial - extraGasto;
  let compras = 0;
  let despedidaUsada = false;
  for (;;) {
    const asequibles = armas.filter((arma) => costeArma(arma) <= saldo && !(arma.id === "despedida" && despedidaUsada));
    if (asequibles.length === 0) return compras;
    const elegida =
      estrategia === "caro"
        ? asequibles.reduce((a, b) => (costeArma(b) > costeArma(a) ? b : a))
        : estrategia === "barato"
          ? asequibles.reduce((a, b) => (costeArma(b) < costeArma(a) ? b : a))
          : objetivoMedio;
    if (costeArma(elegida) > saldo) return compras;
    saldo -= costeArma(elegida);
    compras += 1;
    if (elegida.id === "despedida") despedidaUsada = true;
  }
}

export interface ResultadoPerfil {
  readonly perfil: string;
  readonly partidas: number;
  readonly victorias: number;
  readonly empates: number;
  // Partidas en las que el perfil llegó a su 8.º turno propio, y en cuántas no
  // podía pagar ni el arma de pago más barata.
  readonly llegaronAlOctavo: number;
  readonly sinSaldoEnOctavo: number;
  readonly llegaronARonda10: number;
  readonly pagoEnRonda10: number;
  // Media del turno propio en que el saldo cae por debajo del arma más barata.
  readonly turnoMedioSinSaldo: number | null;
}

const MUNDO: ParametrosMundo = { ancho: 1200, alto: 1600, gravedad: 0, deriva: 0, etiquetaDeriva: "calibrar-economia" };
const LIMITE_TURNOS = 200;

// Misma puntería para los tres asientos (la de Almirante Bisagra): lo único que
// cambia entre perfiles es cómo gastan, así que una diferencia de victorias es
// de la economía y no de quién apunta mejor.
function perfilDeGasto(base: Personalidad): Personalidad {
  return { ...ALMIRANTE_BISAGRA, id: base.id, ordenPreferenciaArmas: base.ordenPreferenciaArmas };
}

const PERFILES: readonly Personalidad[] = [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA].map(perfilDeGasto);
export const NOMBRES_PERFIL: Readonly<Record<string, string>> = { "almirante-bisagra": "agresivo", "la-contable": "ahorrador", chispa: "mixto" };

export function simularPerfiles(semillas: number): readonly ResultadoPerfil[] {
  const precioMinimo = Math.min(...armasDePagoConDanio().map(costeArma));
  const acumulado = PERFILES.map(() => ({
    victorias: 0,
    empates: 0,
    partidas: 0,
    llegaronAlOctavo: 0,
    sinSaldoEnOctavo: 0,
    llegaronARonda10: 0,
    pagoEnRonda10: 0,
    sumaTurnoSinSaldo: 0,
    conTurnoSinSaldo: 0,
  }));
  for (let semilla = 1; semilla <= semillas; semilla++) {
    // Rotar los asientos reparte la ventaja de jugar primero entre perfiles.
    const rotacion = semilla % PERFILES.length;
    const perfilDeAsiento = [0, 1, 2].map((asiento) => (asiento + rotacion) % PERFILES.length);
    const colocacion = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), 3, [true, true, true]);
    let estado: EstadoPartida = conMuerteSubita(
      conUniverso({
        version: 1,
        mundo: MUNDO,
        mascara: colocacion.sistema.mascara,
        naves: colocacion.naves,
        ordenTurno: colocacion.naves.map((_, id) => id),
        turno: 0,
        numeroTurno: 0,
        aleatorio: colocacion.aleatorio,
        resultado: { tipo: "en-curso" },
        planetas: colocacion.sistema.planetas,
        modo: "presupuesto",
        saldos: colocacion.naves.map(() => PRESUPUESTO_BASE),
      }),
    );
    const usos: Record<string, number>[] = colocacion.naves.map(() => ({}));
    const turnosPropios = [0, 0, 0];
    const visto = acumulado.map(() => ({ octavo: false, sinSaldoEnOctavo: false, ronda10: false, pagoEnRonda10: false, turnoSinSaldo: null as number | null }));
    while (estado.resultado.tipo === "en-curso" && estado.numeroTurno < LIMITE_TURNOS) {
      const asiento = estado.turno;
      const perfil = perfilDeAsiento[asiento];
      const saldo = estado.saldos?.[asiento] ?? 0;
      turnosPropios[asiento] += 1;
      const v = visto[perfil];
      if (saldo < precioMinimo && v.turnoSinSaldo === null) v.turnoSinSaldo = turnosPropios[asiento];
      if (turnosPropios[asiento] === 8) {
        v.octavo = true;
        v.sinSaldoEnOctavo = saldo < precioMinimo;
      }
      const { entrada, estado: decidido } = crearFuenteIA(PERFILES[perfil], null, usos[asiento])(estado);
      usos[asiento][entrada.arma] = (usos[asiento][entrada.arma] ?? 0) + 1;
      if ((estado.ronda ?? 1) === 10) {
        v.ronda10 = true;
        const arma = CATALOGO_ARMAS.find((candidata) => candidata.id === entrada.arma);
        if (arma !== undefined && costeArma(arma) > 0) v.pagoEnRonda10 = true;
      }
      estado = avanzar(decidido, entrada).estado;
    }
    const ganador = estado.resultado.tipo === "terminada" ? estado.resultado.ganador : undefined;
    visto.forEach((v, perfil) => {
      const a = acumulado[perfil];
      a.partidas += 1;
      if (v.octavo) a.llegaronAlOctavo += 1;
      if (v.sinSaldoEnOctavo) a.sinSaldoEnOctavo += 1;
      if (v.ronda10) a.llegaronARonda10 += 1;
      if (v.pagoEnRonda10) a.pagoEnRonda10 += 1;
      if (v.turnoSinSaldo !== null) {
        a.sumaTurnoSinSaldo += v.turnoSinSaldo;
        a.conTurnoSinSaldo += 1;
      }
    });
    if (ganador === null) acumulado.forEach((a) => (a.empates += 1));
    else if (ganador !== undefined) acumulado[perfilDeAsiento[ganador]].victorias += 1;
  }
  return PERFILES.map((personalidad, indice) => {
    const a = acumulado[indice];
    return {
      perfil: NOMBRES_PERFIL[personalidad.id],
      partidas: a.partidas,
      victorias: a.victorias,
      empates: a.empates,
      llegaronAlOctavo: a.llegaronAlOctavo,
      sinSaldoEnOctavo: a.sinSaldoEnOctavo,
      llegaronARonda10: a.llegaronARonda10,
      pagoEnRonda10: a.pagoEnRonda10,
      turnoMedioSinSaldo: a.conTurnoSinSaldo > 0 ? a.sumaTurnoSinSaldo / a.conTurnoSinSaldo : null,
    };
  });
}

// Las tres bandas de cal-3. Una sola definición para el script (que decide el
// código de salida con PRUEBA_LARGA=1) y para el informe (que las enseña).
export function evaluarBandas(resultados: readonly ResultadoPerfil[]): readonly { readonly texto: string; readonly cumple: boolean }[] {
  const bandas: { texto: string; cumple: boolean }[] = [];
  for (const r of resultados) {
    const conGanador = r.partidas - r.empates;
    const tasa = conGanador === 0 ? 0 : r.victorias / conGanador;
    bandas.push({ texto: `${r.perfil}: gana entre el 20 % y el 50 % de las partidas con ganador (${(100 * tasa).toFixed(0)} %)`, cumple: tasa >= 0.2 && tasa <= 0.5 });
    if (r.perfil === "agresivo") {
      const parte = r.llegaronAlOctavo === 0 ? 0 : r.sinSaldoEnOctavo / r.llegaronAlOctavo;
      bandas.push({ texto: `agresivo: sin saldo para la más barata en su 8.º turno propio en ≥ 80 % de las partidas que llegan (${(100 * parte).toFixed(0)} %)`, cumple: parte >= 0.8 });
    }
    if (r.perfil === "ahorrador") {
      const parte = r.llegaronARonda10 === 0 ? 0 : r.pagoEnRonda10 / r.llegaronARonda10;
      bandas.push({ texto: `ahorrador: dispara de pago en la ronda 10 en ≥ 70 % de las partidas que llegan (${(100 * parte).toFixed(0)} %)`, cumple: parte >= 0.7 });
    }
  }
  return bandas;
}

function pct(parte: number, total: number): string {
  return total === 0 ? "n/a" : `${((100 * parte) / total).toFixed(0)} %`;
}

export function renderizarInforme(semillas: number, resultados: readonly ResultadoPerfil[] | null): string {
  const p = calcularParametros();
  const filas = tablaDePrecios();
  const lineasPrecio = filas
    .map((f) => `| ${f.nombre} | ${f.coste} | ${f.danioMaximo} | ${(f.facilidad * 100).toFixed(1)} % | ${f.curva} | ${(f.desviacion * 100).toFixed(0)} % | ${f.valorRelativo.toFixed(2)} |`)
    .join("\n");
  const desviaciones = filas.filter((f) => DESVIACIONES_DECLARADAS[f.id] !== undefined);
  const lineasDesviacion = desviaciones.length > 0 ? desviaciones.map((f) => `- **${f.nombre}** (\`${f.id}\`): ${DESVIACIONES_DECLARADAS[f.id]}`).join("\n") : "Ninguna.";
  const equipo = CATALOGO_EQUIPO.map((e) => `${e.nombre} ${e.coste} cr`).join(", ");
  const compras = (estrategia: EstrategiaCompra, saldo: number, extra = 0): number => comprasHastaAgotar(estrategia, saldo, extra);
  const lineasPerfil = resultados
    ? resultados
        .map(
          (r) =>
            `| ${r.perfil} | ${r.victorias}/${r.partidas - r.empates} (${pct(r.victorias, r.partidas - r.empates)}) | ${r.turnoMedioSinSaldo === null ? "no se queda sin saldo" : r.turnoMedioSinSaldo.toFixed(1)} | ${r.sinSaldoEnOctavo}/${r.llegaronAlOctavo} (${pct(r.sinSaldoEnOctavo, r.llegaronAlOctavo)}) | ${r.pagoEnRonda10}/${r.llegaronARonda10} (${pct(r.pagoEnRonda10, r.llegaronARonda10)}) |`,
        )
        .join("\n")
    : "";
  return `# Calibración de la economía

Regenerado por \`npm run calibrar:economia\`. No a mano: los números salen de
\`tests/utils/calibrarEconomia.ts\`, el mismo cálculo que vigilan
\`tests/unit/economia/calibrado.test.ts\` y \`parametros.ts\`.

## Parámetros

- Mediana de los precios de las armas de pago con daño (M): **${p.medianaPrecios} cr**
- \`PRESUPUESTO_BASE\` fijo, sin arrastre entre partidas: **${p.presupuestoBase} cr**
- \`PREMIO_LOTERIA\` fijo: **${p.premioLoteria} cr**
- Equipo (sin cambios por la calibración): ${equipo}

## Precios frente a la curva daño × facilidad

La facilidad es la de \`docs/facilidad-armas.md\`. «Valor» es el daño esperado
por crédito (daño máximo × facilidad / coste) dividido por su mediana: la banda
sana es [${BANDA_VALOR[0]}; ${BANDA_VALOR[1]}].

| Arma | Coste | Daño máx. | Facilidad | Curva | Desviación | Valor |
| --- | --- | --- | --- | --- | --- | --- |
${lineasPrecio}

### Desviaciones declaradas

${lineasDesviacion}

## Compras por estrategia (saldo inicial ${p.presupuestoBase} cr, sin lotería)

| Comprador | Compras de arma de pago |
| --- | --- |
| Medio (la de precio más cercano a M) | ${compras("medio", p.presupuestoBase)} |
| Caro (la más cara asequible, Despedida una vez) | ${compras("caro", p.presupuestoBase)} |
| Barato (la de pago más barata) | ${compras("barato", p.presupuestoBase)} |
| Medio con dos escudos pagados | ${compras("medio", p.presupuestoBase, 2 * (CATALOGO_EQUIPO.find((e) => e.id === "escudo")?.coste ?? 0))} |

## Partidas de 3 IAs con la misma puntería (${resultados ? semillas : "no ejecutado en esta pasada"} semillas)

${
  resultados
    ? `Cada perfil de gasto juega con la puntería de Almirante Bisagra, los asientos
rotan por semilla y están activos el universo, la muerte súbita y el equipo.

| Perfil | Victorias (partidas con ganador) | Turno propio medio en que no llega ni a la más barata | Sin saldo en su 8.º turno | Paga en la ronda 10 |
| --- | --- | --- | --- | --- |
${lineasPerfil}

### Bandas de cal-3 con estas semillas

${evaluarBandas(resultados)
  .map((b) => `- ${b.cumple ? "CUMPLE" : "FUERA DE BANDA"}: ${b.texto}`)
  .join("\n")}

Con pocas semillas el intervalo de cada tasa es ancho: la comprobación que
manda es la de \`PRUEBA_LARGA=1 npm run calibrar:economia -- --semillas 60\`.`
    : "Se omite la simulación con `--sin-simulacion`."
}
`;
}
