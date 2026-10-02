import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { avanzar } from "@/sim/partida/avanzar";
import { decidirTurnoIA } from "@/sim/ia/decidir";
import type { EstadoPartida } from "@/sim/partida/tipos";
import type { Personalidad } from "@/sim/ia/tipos";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";
import { muestra } from "../../utils/muestra";

const NUM_ENTRADAS = muestra(200);

// arma-mosca (mos-4): fixture de prueba, nunca una personalidad de
// producción -- las tres personalidades reales deliberadamente no listan
// mosca-cojonera (ni ninguna de las tres armas nuevas anteriores) en su
// orden de preferencia, una decisión de diseño de rival, no una limitación
// mecánica. Aquí se comprueba la MECÁNICA: que un rival que SÍ la prefiera
// puede elegirla y dispararla por el mismo oráculo que el disparo real,
// nunca que algún rival de producción vaya a usarla.
const PERSONALIDAD_CON_MOSCA: Personalidad = {
  id: "fixture-mos-4",
  nombre: "Fixture de prueba (mos-4)",
  descripcion: "Solo para el test: no existe en el juego real.",
  error: { anguloGrados: { minimo: -1.2, maximo: 1.2 }, potencia: { minimo: -2.4, maximo: 2.4 } },
  trayectoriaPreferida: "tenso",
  ordenPreferenciaArmas: ["mosca-cojonera", "pepinazo-cortesia", "zanjadora-manolita"],
  bancoDeFrases: ["Frase de prueba."],
};

test("mos-4: el rival elige la mosca, la busca y la dispara con el mismo simulador y la misma semilla que el disparo real, y acierta con frecuencia distinta de cero", () => {
  const armaMosca = buscarArma("mosca-cojonera");
  const lote = generarLoteDeSistemas(NUM_ENTRADAS);
  let vecesElegida = 0;
  let vecesConDanio = 0;

  for (const { semilla, sistema, naveA, naveB, aleatorio } of lote) {
    const resultado = decidirTurnoIA({
      mascara: sistema.mascara,
      origenX: naveA.x,
      origenY: naveA.y,
      objetivoX: naveB.x,
      objetivoY: naveB.y,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      personalidad: PERSONALIDAD_CON_MOSCA,
      aleatorio,
      ultimoIntento: null,
      planetas: sistema.planetas,
      naves: [naveA, naveB],
      tiradorId: 0,
      objetivoId: 1,
    });

    if (resultado.entrada.arma !== "mosca-cojonera") continue;
    vecesElegida++;

    // "El mismo simulador y la misma semilla que el disparo real": se
    // reconstruye el vuelo que la búsqueda evaluó (resolverDisparo, el único
    // oráculo, imp-8) con la MISMA semilla de partida que vio decidirTurnoIA,
    // y se compara punto a punto contra avanzar() -- la función con la que
    // el juego dispara de verdad -- sobre el mismo EstadoPartida.
    const trayectoriaDeLaBusqueda = resolverDisparo({
      mascara: sistema.mascara,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      aleatorio,
      arma: armaMosca,
      origenX: naveA.x,
      origenY: naveA.y,
      anguloGrados: resultado.entrada.anguloGrados,
      potencia: resultado.entrada.potencia,
      objetivoX: naveB.x,
      objetivoY: naveB.y,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      planetas: sistema.planetas,
      naves: [naveA, naveB],
      tiradorId: 0,
    });

    const estado: EstadoPartida = {
      version: 1,
      mundo: MUNDO_MULTIPOZO,
      mascara: sistema.mascara,
      naves: [
        { x: naveA.x, y: naveA.y, integridad: 100 },
        { x: naveB.x, y: naveB.y, integridad: 100 },
      ],
      turno: 0,
      numeroTurno: 0,
      aleatorio,
      resultado: { tipo: "en-curso" },
      ...(sistema.planetas ? { planetas: sistema.planetas } : {}),
    };
    const { eventos } = avanzar(estado, {
      arma: resultado.entrada.arma,
      anguloGrados: resultado.entrada.anguloGrados,
      potencia: resultado.entrada.potencia,
    });

    const eventosDeImpactoAlObjetivo = eventos.filter(
      (evento): evento is Extract<(typeof eventos)[number], { tipo: "impacto" }> => evento.tipo === "impacto" && evento.objetivo === 1,
    );
    const puntosDelDisparoReal = eventosDeImpactoAlObjetivo.map((evento) => ({ x: evento.x, y: evento.y }));
    const puntosDeLaBusqueda = trayectoriaDeLaBusqueda.puntosDeImpacto.map((punto) => ({ x: punto.x, y: punto.y }));
    assert.deepEqual(
      puntosDelDisparoReal,
      puntosDeLaBusqueda,
      `semilla ${semilla}: los puntos de impacto de avanzar() no coinciden con los de la búsqueda para mosca-cojonera`,
    );

    const danioAlObjetivo = eventosDeImpactoAlObjetivo.reduce((total, evento) => total + evento.danio, 0);
    assert.equal(
      danioAlObjetivo,
      trayectoriaDeLaBusqueda.danioObjetivo,
      `semilla ${semilla}: el daño real no coincide con el que predijo la búsqueda`,
    );
    if (danioAlObjetivo > 0) vecesConDanio++;
  }

  assert.ok(vecesElegida > 0, "la personalidad de prueba nunca eligió mosca-cojonera en el lote determinista -- fixture rota");
  assert.ok(vecesConDanio > 0, `mosca-cojonera nunca causó daño en ${vecesElegida} elecciones sobre el lote determinista`);
});
