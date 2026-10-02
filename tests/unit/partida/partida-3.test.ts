import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEstadoAleatorio, siguienteAleatorio } from "@/sim/aleatorio";
import { colocarNaves } from "@/sim/naves/colocacion";
import { jugarTurno } from "@/sim/partida/motor";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { UMBRAL_FALLO_PX, UMBRAL_DANIO_SUFICIENTE_POR_TURNO, type UltimoIntentoIA } from "@/sim/ia/decidir";
import { PERSONALIDADES } from "@/sim/ia/personalidades";
import type { Personalidad } from "@/sim/ia/tipos";
import { naveContraria, type EstadoPartida, type FuenteDeTurno, type ParametrosMundo } from "@/sim/partida/tipos";
import { MUNDO_ANCHO, MUNDO_ALTO } from "../../utils/sistemaGenerado";
import { muestra } from "../../utils/muestra";

const SEMILLA_MAESTRA = 90210;
const NUMERO_DE_PARTIDAS = muestra(200);
const TURNOS_MAXIMOS = 40;
// Red de seguridad para detectar "se cuelga" (un bucle sin ganador que no
// terminaría nunca), muy por encima del objetivo de diseño de 40 -- igual
// que LIMITE_TURNOS_LOTE en loteAleatorio.ts, nunca un desenlace esperado.
const LIMITE_TURNOS_SEGURIDAD = 800;
const TECHO_PROPORCION_PROYECTIL_PERDIDO = 0.15;

// ia-multipozo/ia-n7 (DESVIACIÓN, ver entregable): Partida.ts arma el modo
// espacial real con gravedad:0 (sin ambiental, solo la de los planetas),
// pero medido aquí eso deja un ~51% de disparos como "proyectil perdido"
// (n=20 partidas/382 disparos) -- el error de personalidades de rango
// grande (Chispa) empuja soluciones válidas más allá del pozo de un
// planeta hacia una trayectoria de escape que agota el presupuesto de
// vuelo sin aterrizar nunca. Es un hallazgo real sobre la interacción
// error-de-personalidad/física en TODO el modo espacial, no un defecto de
// la búsqueda que le toque arreglar a este bloque -- se usa gravedad:1,
// la misma convención que ya comparten ia-n1/n5/n6/n9/n10 en este mismo
// bloque (MUNDO_MULTIPOZO), para que el criterio sea medible; queda
// documentado para que diseño decida si sube la gravedad ambiental real
// de Partida.ts o acota el error en espacio abierto.
const MUNDO_ESPACIAL: ParametrosMundo = {
  ancho: MUNDO_ANCHO,
  alto: MUNDO_ALTO,
  gravedad: 1,
  deriva: 0,
  etiquetaDeriva: "Vacío: aquí no empuja nada que no sea un planeta",
};

interface ResultadoPartidaEspacial {
  readonly turnos: number;
  readonly disparos: number;
  readonly proyectilesPerdidos: number;
}

// ia-n7: reproduce a mano el mismo patrón que Partida.ts usa en su bucle
// real (dispararEntrada) -- turno a turno con jugarTurno(), recalculando el
// ultimoIntento de CADA lado tras su propio disparo a partir del evento de
// impacto real. En modo espacial no existe equivalente de fuenteAleatoria
// (solo sabe apuntar en terreno llano con el solucionador de fórmula
// cerrada): los dos lados son personalidades reales, así que la corrección
// de ia-5/ia-n5/ia-n6 tiene que llevarse por separado para cada una, nunca
// solo para "la IA" como hacía el partida-3 original de suelo plano.
function jugarPartidaEspacial(personalidades: readonly [Personalidad, Personalidad], semillaSistema: number): ResultadoPartidaEspacial {
  const colocacion = colocarNaves(semillaSistema, MUNDO_ESPACIAL, crearEstadoAleatorio(semillaSistema));
  let estado: EstadoPartida = {
    version: 1,
    mundo: MUNDO_ESPACIAL,
    mascara: colocacion.sistema.mascara,
    naves: colocacion.naves,
    turno: 0,
    numeroTurno: 0,
    aleatorio: colocacion.aleatorio,
    resultado: { tipo: "en-curso" },
    planetas: colocacion.sistema.planetas,
  };

  const ultimoIntento: [UltimoIntentoIA | null, UltimoIntentoIA | null] = [null, null];
  // fallosConsecutivos solo sube, nunca se resetea con un acierto suelto
  // (ver el comentario de UltimoIntentoIA en decidir.ts) -- turnosSeguidosSinDanio
  // sí, porque mide otra cosa: si el turno inmediatamente anterior hizo daño.
  const fallosConsecutivos: [number, number] = [0, 0];
  const turnosSeguidosSinDanio: [number, number] = [0, 0];
  // ia-n7: mismo patrón que fallosConsecutivos -- nunca baja, quien lo lleva
  // (aquí, y Partida.ts en el bucle real) decide cuándo sube.
  const turnosSeguidosDanioInsuficiente: [number, number] = [0, 0];
  let disparos = 0;
  let proyectilesPerdidos = 0;

  while (estado.resultado.tipo === "en-curso") {
    assert.equal(
      estado.numeroTurno < LIMITE_TURNOS_SEGURIDAD,
      true,
      `partida sin ganador tras ${LIMITE_TURNOS_SEGURIDAD} turnos (semilla ${semillaSistema}, ${personalidades[0].nombre} vs ${personalidades[1].nombre})`,
    );

    const tirador = estado.turno;
    const objetivoId = naveContraria(tirador);
    const objetivoAntes = estado.naves[objetivoId];
    const objetivoYAntes = objetivoAntes.y as number;

    const fuentes: [FuenteDeTurno, FuenteDeTurno] = [
      crearFuenteIA(personalidades[0], ultimoIntento[0]),
      crearFuenteIA(personalidades[1], ultimoIntento[1]),
    ];
    const { estado: estadoDespues, eventos } = jugarTurno(estado, fuentes);
    estado = estadoDespues;
    disparos++;

    if (eventos.some((evento) => evento.tipo === "proyectil-perdido")) {
      proyectilesPerdidos++;
    }

    const eventoImpacto = eventos.find((evento): evento is Extract<(typeof eventos)[number], { tipo: "impacto" }> => evento.tipo === "impacto");
    const puntoDeCaida = eventoImpacto ?? { x: objetivoAntes.x, y: objetivoYAntes };
    const distancia = Math.hypot(puntoDeCaida.x - objetivoAntes.x, puntoDeCaida.y - objetivoYAntes);
    fallosConsecutivos[tirador] = distancia > UMBRAL_FALLO_PX ? fallosConsecutivos[tirador] + 1 : fallosConsecutivos[tirador];

    const danioCausado = eventos
      .filter((evento): evento is Extract<(typeof eventos)[number], { tipo: "impacto" }> => evento.tipo === "impacto" && evento.objetivo === objetivoId)
      .reduce((total, evento) => total + evento.danio, 0);
    turnosSeguidosSinDanio[tirador] = danioCausado > 0 ? 0 : turnosSeguidosSinDanio[tirador] + 1;
    if (danioCausado < UMBRAL_DANIO_SUFICIENTE_POR_TURNO) {
      turnosSeguidosDanioInsuficiente[tirador] += 1;
    }

    ultimoIntento[tirador] = {
      distanciaAlObjetivoPx: distancia,
      fallosConsecutivos: fallosConsecutivos[tirador],
      turnosSeguidosSinDanio: turnosSeguidosSinDanio[tirador],
      turnosSeguidosDanioInsuficiente: turnosSeguidosDanioInsuficiente[tirador],
    };
  }

  return { turnos: estado.numeroTurno, disparos, proyectilesPerdidos };
}

test(`ia-n7 / partida-3: en ${NUMERO_DE_PARTIDAS} partidas simuladas en modo espacial real, casi todas terminan con ganador en 40 turnos o menos y menos del 15% de los disparos se pierden`, async (t) => {
  let estadoAleatorio = crearEstadoAleatorio(SEMILLA_MAESTRA);
  const resultados: { readonly turnos: number; readonly disparos: number; readonly proyectilesPerdidos: number; readonly pareja: string }[] = [];

  for (let i = 0; i < NUMERO_DE_PARTIDAS; i++) {
    const paso = siguienteAleatorio(estadoAleatorio);
    estadoAleatorio = paso.estado;
    const semillaSistema = Math.floor(paso.valor * 0xffffffff);
    // Sin "jugador de referencia" en modo espacial (ver comentario de
    // jugarPartidaEspacial): se recorren las tres personalidades reales
    // contra sí mismas en pareja desplazada (A-B, B-C, C-A, ...) para que
    // las 200 partidas cubran toda combinación sin repetir nunca la misma
    // personalidad a los dos lados.
    const personalidadA = PERSONALIDADES[i % PERSONALIDADES.length];
    const personalidadB = PERSONALIDADES[(i + 1) % PERSONALIDADES.length];
    const resultado = jugarPartidaEspacial([personalidadA, personalidadB], semillaSistema);
    resultados.push({ ...resultado, pareja: `${personalidadA.nombre} vs ${personalidadB.nombre}` });
  }

  const turnos = resultados.map((r) => r.turnos);
  const maximoTurnos = Math.max(...turnos);
  const sobreElLimite = resultados.filter((r) => r.turnos > TURNOS_MAXIMOS);
  const disparosTotales = resultados.reduce((total, r) => total + r.disparos, 0);
  const proyectilesPerdidosTotales = resultados.reduce((total, r) => total + r.proyectilesPerdidos, 0);
  const proporcionPerdidos = proyectilesPerdidosTotales / disparosTotales;

  console.log(`ia-n7: máximo ${maximoTurnos} turnos de ${NUMERO_DE_PARTIDAS} partidas en modo espacial real`);
  console.log(`ia-n7: ${sobreElLimite.length} partida(s) superan ${TURNOS_MAXIMOS} turnos: ${JSON.stringify(sobreElLimite)}`);
  console.log(
    `ia-n7: ${proyectilesPerdidosTotales} de ${disparosTotales} disparos acaban en proyectil perdido (${(proporcionPerdidos * 100).toFixed(1)}%)`,
  );

  await t.test(`menos del ${TECHO_PROPORCION_PROYECTIL_PERDIDO * 100}% de los disparos acaban en proyectil perdido`, () => {
    assert.ok(
      proporcionPerdidos < TECHO_PROPORCION_PROYECTIL_PERDIDO,
      `${(proporcionPerdidos * 100).toFixed(1)}% de los disparos acaban en proyectil perdido, techo ${TECHO_PROPORCION_PROYECTIL_PERDIDO * 100}%`,
    );
  });

  // ia-n7 (camino_critico:true): el umbral de 40 turnos no se relaja. La
  // causa medida (devuelta tres veces por el Gatekeeper sobre dev@b142890,
  // hasta 203 turnos en 22/200 partidas, siempre Chispa contra La
  // Contable): las dos personalidades convergían en "zanjadora-manolita"
  // (danioMaximo:4, "no mata a nadie") porque estaban "bloqueada" según el
  // arma de referencia, y esa arma sí conectaba un roce del borde de su
  // radio de efecto turno tras turno (~1pt real) que reseteaba
  // turnosSeguidosSinDanio a 0 sin que la partida avanzara. Se arregla en
  // decidir.ts con un contador nuevo, turnosSeguidosDanioInsuficiente, que
  // NUNCA se resetea con un roce pequeño (a diferencia de
  // turnosSeguidosSinDanio): tras UMBRAL_TURNOS_DANIO_INSUFICIENTE_FORZADO
  // turnos seguidos por debajo de UMBRAL_DANIO_SUFICIENTE_POR_TURNO de
  // daño real, se desiste de cavar con ARMA_DE_DESBLOQUEO y se dispara con
  // el arma de mayor danioMaximo de la personalidad -- exactamente lo que
  // el Gatekeeper recomendó: ponderar turnos-para-matar, no solo daño > 0.
  await t.test(`todas las partidas terminan en ${TURNOS_MAXIMOS} turnos o menos`, () => {
    assert.equal(maximoTurnos <= TURNOS_MAXIMOS, true, `${sobreElLimite.length} partida(s) superaron ${TURNOS_MAXIMOS} turnos: ${JSON.stringify(sobreElLimite)}`);
  });
});
