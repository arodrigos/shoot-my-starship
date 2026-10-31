// pre-3: frecuencia de cada premio en partidas solo de IAs de 4 asientos, con
// el simulador real y semillas fijas. Lo usa `npm run medir:premios`. También
// cuenta la medalla Mérito Geológico del parte de guerra, que depende de los
// mismos píxeles destruidos que Topo Espacial y por eso se calibra a la vez.
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { ALMIRANTE_BISAGRA, CHISPA, LA_CONTABLE } from "@/sim/ia/personalidades";
import type { Personalidad } from "@/sim/ia/tipos";
import { colocarNaves } from "@/sim/naves/colocacion";
import { avanzar } from "@/sim/partida/avanzar";
import { conMuerteSubita } from "@/sim/partida/muerteSubita";
import { estadisticasIniciales as parteInicial, generarParteDeGuerra, type EstadisticasPartida } from "@/sim/partida/parteDeGuerra";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { conUniverso } from "@/sim/universo/efectos";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { ALTURA_CANON_PX, alturaSuperficie, detenerseEnSuelo } from "@/sim/armas/resolver";
import { contarPixelesDestruidos } from "@/sim/terreno/estadisticas";
import { acumularTurno, estadisticasIniciales } from "@/juego/premios/estadisticas";
import { asignarPremios, BANCO_CONSOLACION, BANCO_MERITO } from "@/juego/premios/premios";

const MUNDO: ParametrosMundo = { ancho: 1200, alto: 1600, gravedad: 1, deriva: 0, etiquetaDeriva: "medir-premios" };
const LIMITE_TURNOS = 200;
const NAVES = 4;
const PERFILES: readonly Personalidad[] = [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA, ALMIRANTE_BISAGRA];

export interface InformePremios {
  readonly partidas: number;
  readonly frecuencias: ReadonlyMap<string, number>;
  readonly consolacion: ReadonlySet<string>;
  // Fracción de partidas cuyo parte de guerra da el Mérito Geológico; las que
  // llegan al límite de turnos sin terminar no tienen parte y cuentan como no.
  readonly meritoGeologico: number;
}

export const MEDALLA_MERITO_GEOLOGICO = "Mérito Geológico";

// Copia de Partida.actualizarEstadisticas (la escena no se puede cargar en
// Node): solo los turnos con disparo cuentan, y el daño a uno mismo no es
// daño al enemigo.
function acumularParte(
  previas: EstadisticasPartida,
  tirador: number,
  eventos: ReturnType<typeof avanzar>["eventos"],
  pixelesDestruidos: number,
): EstadisticasPartida {
  if (!eventos.some((e) => e.tipo === "disparo")) return previas;
  const danioAlEnemigo = eventos.reduce((t, e) => (e.tipo === "impacto" && e.objetivo !== tirador ? t + e.danio : t), 0);
  return {
    disparos: previas.disparos + 1,
    fallos: previas.fallos + (eventos.some((e) => e.tipo === "arma-falla") ? 1 : 0),
    autoimpactos: previas.autoimpactos + (eventos.some((e) => e.tipo === "autoimpacto") ? 1 : 0),
    danioHechoAlEnemigo: previas.danioHechoAlEnemigo + danioAlEnemigo,
    pixelesDestruidos: previas.pixelesDestruidos + pixelesDestruidos,
  };
}

// Aproximación: la trayectoria se recalcula como impacto simple con la
// gravedad de los planetas del estado de partida. Para armas de vuelo
// especial (láser, erráticas) el giro será menor que el animado, y sirve de
// cota prudente para calibrar el umbral.
function trayectoriaDelDisparo(estado: EstadoPartida, nave: number, anguloGrados: number, potencia: number) {
  const { mascara, mundo } = estado;
  const origenX = estado.naves[nave].x;
  const origenY = estado.naves[nave].y ?? alturaSuperficie(mascara, origenX) ?? mundo.alto - 1;
  const rad = (anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(potencia);
  const inicial = crearProyectil(origenX, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  const vuelo = simularVuelo(inicial, mundo.gravedad, mundo.deriva, detenerseEnSuelo(mascara, mundo.ancho, mundo.alto), {
    planetas: estado.planetas,
    grabarTrayectoria: true,
  });
  return vuelo.trayectoria ?? null;
}

export function medirPremios(partidas: number, semillaInicial = 1): InformePremios {
  const conteo = new Map<string, number>();
  let meritosGeologicos = 0;
  for (const def of [...BANCO_MERITO, ...BANCO_CONSOLACION]) conteo.set(def.id, 0);
  for (let semilla = semillaInicial; semilla < semillaInicial + partidas; semilla++) {
    const colocacion = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), NAVES, Array.from({ length: NAVES }, () => true));
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
    let acumulado = estadisticasIniciales(NAVES);
    let partes: EstadisticasPartida[] = colocacion.naves.map(() => parteInicial());
    while (estado.resultado.tipo === "en-curso" && estado.numeroTurno < LIMITE_TURNOS) {
      const asiento = estado.turno;
      const { entrada, estado: decidido } = crearFuenteIA(PERFILES[asiento], null, usos[asiento])(estado);
      usos[asiento][entrada.arma] = (usos[asiento][entrada.arma] ?? 0) + 1;
      const resultado = avanzar(decidido, entrada);
      const disparo = resultado.eventos.find((e) => e.tipo === "disparo");
      const pixelesDestruidos = contarPixelesDestruidos(decidido.mascara, resultado.estado.mascara);
      acumulado = acumularTurno(
        acumulado,
        resultado.eventos,
        disparo ? trayectoriaDelDisparo(decidido, asiento, disparo.anguloGrados, disparo.potencia) : null,
        {
          integridades: resultado.estado.naves.map((n) => n.integridad),
          pixelesDestruidos,
        },
      );
      partes = partes.map((p, id) => (id === asiento ? acumularParte(p, asiento, resultado.eventos, pixelesDestruidos) : p));
      estado = resultado.estado;
      if (estado.resultado.tipo === "terminada") {
        const parte = generarParteDeGuerra(partes[estado.resultado.ganador ?? asiento]);
        if (parte.medalla === MEDALLA_MERITO_GEOLOGICO) meritosGeologicos += 1;
      }
    }
    for (const premios of asignarPremios(acumulado)) for (const p of premios) conteo.set(p.id, (conteo.get(p.id) ?? 0) + 1);
  }
  return {
    partidas,
    frecuencias: new Map([...conteo].map(([id, n]) => [id, n / partidas])),
    consolacion: new Set(BANCO_CONSOLACION.map((d) => d.id)),
    meritoGeologico: meritosGeologicos / partidas,
  };
}
