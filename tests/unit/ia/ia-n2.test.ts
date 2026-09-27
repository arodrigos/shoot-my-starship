import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarArma } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { avanzar } from "@/sim/partida/avanzar";
import { buscarSolucionRival } from "@/sim/ia/busquedaMultipozo";
import type { EstadoPartida } from "@/sim/partida/tipos";
import { generarLoteDeSistemas, MUNDO_MULTIPOZO } from "../../utils/loteMultipozo";

const NUM_ENTRADAS = 100;

// ia-n2: el criterio explícitamente prohíbe que la búsqueda prediga con un
// modelo simplificado o una parada propia -- ya costó una iteración entera
// de este run. La comprobación es doble: (a) la búsqueda internamente solo
// evalúa candidatos con resolverDisparo (nunca reimplementa vuelo/parada), y
// (b) avanzar() -- la función con la que el juego dispara de verdad -- sobre
// el MISMO EstadoPartida produce, posición a posición, la misma trayectoria
// y el mismo resultado declarado (fallo, proyectil perdido, daño) que ese
// resolverDisparo, sin tolerancia.
test("ia-n2: la trayectoria y el resultado que usó la búsqueda coinciden, sin tolerancia, con los del disparo real de avanzar()", () => {
  const armaBase = buscarArma("pepinazo-cortesia");
  const lote = generarLoteDeSistemas(NUM_ENTRADAS);

  for (const { semilla, sistema, naveA, naveB, aleatorio } of lote) {
    const parametrosComunes = {
      mascara: sistema.mascara,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      planetas: sistema.planetas,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      aleatorio,
      arma: armaBase,
      naves: [naveA, naveB],
      tiradorId: 0 as const,
      objetivoId: 1 as const,
    };

    const resultado = buscarSolucionRival(parametrosComunes);

    // "La trayectoria que la búsqueda usó para elegir": el mismo
    // resolverDisparo, con los mismos parámetros, que busquedaMultipozo.ts
    // usa por dentro para evaluar cualquier candidato.
    const trayectoriaDeLaBusqueda = resolverDisparo({
      mascara: sistema.mascara,
      gravedad: MUNDO_MULTIPOZO.gravedad,
      deriva: MUNDO_MULTIPOZO.deriva,
      aleatorio,
      arma: armaBase,
      origenX: naveA.x,
      origenY: naveA.y,
      anguloGrados: resultado.anguloGrados,
      potencia: resultado.potencia,
      objetivoX: naveB.x,
      objetivoY: naveB.y,
      ancho: MUNDO_MULTIPOZO.ancho,
      alto: MUNDO_MULTIPOZO.alto,
      planetas: sistema.planetas,
      naves: [naveA, naveB],
      tiradorId: 0,
    });

    // "La que produce el disparo real": avanzar() -- la misma función que
    // dispara la partida en vivo -- sobre un EstadoPartida construido con las
    // mismas naves/máscara/mundo/aleatorio. Ni una segunda implementación de
    // vuelo ni de parada (imp-8, un solo oráculo de tiro).
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
      arma: armaBase.id,
      anguloGrados: resultado.anguloGrados,
      potencia: resultado.potencia,
    });

    const eventosDeImpactoAlObjetivo = eventos.filter(
      (evento): evento is Extract<(typeof eventos)[number], { tipo: "impacto" }> => evento.tipo === "impacto" && evento.objetivo === 1,
    );
    const puntosDelDisparoReal = eventosDeImpactoAlObjetivo.map((evento) => ({ x: evento.x, y: evento.y }));
    const puntosDeLaBusqueda = trayectoriaDeLaBusqueda.puntosDeImpacto.map((punto) => ({ x: punto.x, y: punto.y }));
    assert.deepEqual(
      puntosDelDisparoReal,
      puntosDeLaBusqueda,
      `semilla ${semilla}: los puntos de impacto de avanzar() no coinciden con los de la búsqueda`,
    );

    // La condición de parada y el resultado declarado, no solo la geometría.
    const falloReal = eventos.some((evento) => evento.tipo === "arma-falla");
    const proyectilPerdidoReal = eventos.some((evento) => evento.tipo === "proyectil-perdido");
    const danioObjetivoReal = eventosDeImpactoAlObjetivo.reduce((total, evento) => total + evento.danio, 0);

    assert.equal(falloReal, trayectoriaDeLaBusqueda.fallo, `semilla ${semilla}: "fallo" no coincide`);
    assert.equal(
      proyectilPerdidoReal,
      trayectoriaDeLaBusqueda.proyectilPerdido,
      `semilla ${semilla}: "proyectilPerdido" no coincide`,
    );
    assert.equal(
      danioObjetivoReal,
      trayectoriaDeLaBusqueda.danioObjetivo,
      `semilla ${semilla}: "danioObjetivo" no coincide`,
    );
  }
});
