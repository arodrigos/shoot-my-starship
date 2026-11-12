import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  armaEstaAgotada,
  armaFaltaSaldo,
  costeDeArma,
  equipoFaltaSaldo,
  equipoYaActivo,
  fijarModo,
  motivoEquipoNoDisponible,
  obtenerEstadoControl,
  publicarDisparoJugadorResuelto,
  publicarEconomia,
  publicarEscudoPropio,
  publicarJugable,
  publicarNombreRival,
  publicarPreparando,
  publicarTurno,
  publicarVueloPropulsores,
  registrarManejadorDisparo,
  reiniciarControl,
  repetirUltimoDisparo,
  seleccionarArma,
  seleccionarEquipo,
  solicitarDisparo,
  solicitarDisparoAutomatico,
  suscribirControl,
} from "@/juego/control/store";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { costeArma } from "@/sim/partida/economia";
import { buscarEquipo } from "@/sim/equipo/catalogo";
import type { EntradaDeTurno } from "@/sim/partida/tipos";

// Los ids se sacan del catálogo y no se escriben a mano: si se reprecia un
// arma, estos tests siguen eligiendo «una gratis», «una de pago» y «una de un
// solo uso» en vez de romperse por un número.
const GRATIS = CATALOGO_ARMAS.find((a) => costeArma(a) === 0 && a.usosMaximos === undefined)!;
const DE_PAGO = CATALOGO_ARMAS.filter((a) => costeArma(a) > 0 && a.usosMaximos === undefined).sort((a, b) => costeArma(b) - costeArma(a))[0];
const UN_USO = CATALOGO_ARMAS.find((a) => a.usosMaximos === 1)!;
const COSTE_ESCUDO = buscarEquipo("escudo").coste;
const COSTE_PROPULSORES = buscarEquipo("propulsores").coste;

function capturarDisparos(): EntradaDeTurno[] {
  const disparos: EntradaDeTurno[] = [];
  registrarManejadorDisparo((entrada) => disparos.push(entrada));
  return disparos;
}

beforeEach(() => {
  reiniciarControl();
  registrarManejadorDisparo(() => undefined)();
});

describe("store: costes y saldo", () => {
  it("costeDeArma da el coste del catálogo y 0 para un id desconocido", () => {
    for (const arma of CATALOGO_ARMAS) assert.equal(costeDeArma(arma.id), costeArma(arma), arma.id);
    assert.equal(costeDeArma("no-existe"), 0);
  });

  it("en barra libre nunca falta saldo, ni para armas ni para equipo", () => {
    fijarModo("barra-libre", null);
    assert.equal(armaFaltaSaldo(DE_PAGO.id), 0);
    assert.equal(equipoFaltaSaldo("escudo"), 0);
    assert.equal(motivoEquipoNoDisponible("escudo"), null);
  });

  it("con presupuesto, lo que falta es coste − saldo y nunca negativo", () => {
    fijarModo("presupuesto", 10);
    assert.equal(armaFaltaSaldo(DE_PAGO.id), costeArma(DE_PAGO) - 10);
    assert.equal(armaFaltaSaldo(GRATIS.id), 0);
    assert.equal(equipoFaltaSaldo("escudo"), COSTE_ESCUDO - 10);
    assert.equal(motivoEquipoNoDisponible("escudo"), `Te faltan ${COSTE_ESCUDO - 10} cr`);
    fijarModo("presupuesto", 10_000);
    assert.equal(armaFaltaSaldo(DE_PAGO.id), 0);
    assert.equal(motivoEquipoNoDisponible("propulsores"), null);
  });

  it("presupuesto con saldo null se trata como sin presupuesto", () => {
    fijarModo("presupuesto", null);
    assert.equal(armaFaltaSaldo(DE_PAGO.id), 0);
    assert.equal(equipoFaltaSaldo("propulsores"), 0);
  });
});

describe("store: selección de arma y equipo", () => {
  it("no deja seleccionar un arma de pago que el saldo no cubre", () => {
    fijarModo("presupuesto", 0);
    const antes = obtenerEstadoControl().ajuste.armaId;
    seleccionarArma(DE_PAGO.id);
    assert.equal(obtenerEstadoControl().ajuste.armaId, antes);
    seleccionarArma(GRATIS.id);
    assert.equal(obtenerEstadoControl().ajuste.armaId, GRATIS.id);
  });

  it("no deja seleccionar un arma ya agotada", () => {
    seleccionarArma(UN_USO.id);
    publicarDisparoJugadorResuelto({ ...obtenerEstadoControl().ajuste, armaId: UN_USO.id });
    assert.equal(armaEstaAgotada(UN_USO.id), true);
    seleccionarArma(GRATIS.id);
    seleccionarArma(UN_USO.id);
    assert.equal(obtenerEstadoControl().ajuste.armaId, GRATIS.id);
  });

  // B2/B6 (11/11): el caso real, con el arma agotada todavía seleccionada.
  it("tras gastar la Despedida no queda seleccionada y Disparar no la vuelve a mandar", () => {
    const enviadas: EntradaDeTurno[] = [];
    registrarManejadorDisparo((entrada) => enviadas.push(entrada));
    publicarJugable(true);
    seleccionarArma(UN_USO.id);
    publicarDisparoJugadorResuelto({ ...obtenerEstadoControl().ajuste, armaId: UN_USO.id });
    assert.notEqual(obtenerEstadoControl().ajuste.armaId, UN_USO.id, "se cambia sola a otra arma");
    solicitarDisparo();
    assert.equal(enviadas.length, 1);
    assert.notEqual(enviadas[0].arma, UN_USO.id);
  });

  it("los usos que trae el turno mandan: una partida reanudada no ofrece la Despedida gastada", () => {
    const enviadas: EntradaDeTurno[] = [];
    registrarManejadorDisparo((entrada) => enviadas.push(entrada));
    publicarJugable(true);
    seleccionarArma(UN_USO.id);
    publicarTurno(1, { [UN_USO.id]: 1 });
    assert.equal(armaEstaAgotada(UN_USO.id), true);
    solicitarDisparo();
    assert.equal(enviadas.length, 0, "el primer clic solo cambia de arma");
    assert.notEqual(obtenerEstadoControl().ajuste.armaId, UN_USO.id);
  });

  it("un arma sin tope de usos o desconocida nunca está agotada", () => {
    publicarDisparoJugadorResuelto({ ...obtenerEstadoControl().ajuste, armaId: GRATIS.id });
    assert.equal(armaEstaAgotada(GRATIS.id), false);
    assert.equal(armaEstaAgotada("no-existe"), false);
  });

  it("elegir un arma suelta el equipo elegido", () => {
    seleccionarEquipo("escudo");
    assert.equal(obtenerEstadoControl().equipoId, "escudo");
    seleccionarArma(GRATIS.id);
    assert.equal(obtenerEstadoControl().equipoId, null);
  });

  it("no deja elegir un equipo que no se puede pagar", () => {
    fijarModo("presupuesto", COSTE_PROPULSORES);
    seleccionarEquipo("escudo");
    assert.equal(obtenerEstadoControl().equipoId, COSTE_ESCUDO > COSTE_PROPULSORES ? null : "escudo");
    seleccionarEquipo("propulsores");
    assert.equal(obtenerEstadoControl().equipoId, "propulsores");
  });

  it("equipoYaActivo solo es cierto para el escudo con turnos restantes", () => {
    assert.equal(equipoYaActivo("escudo"), false);
    publicarEscudoPropio(2);
    assert.equal(obtenerEstadoControl().escudoPropioTurnos, 2);
    assert.equal(equipoYaActivo("escudo"), true);
    assert.equal(equipoYaActivo("propulsores"), false);
    assert.equal(equipoYaActivo(null), false);
  });
});

describe("store: publicarEconomia", () => {
  it("si el arma elegida deja de ser pagable salta a la primera gratis", () => {
    fijarModo("presupuesto", 10_000);
    seleccionarArma(DE_PAGO.id);
    publicarEconomia(0);
    const primeraGratis = CATALOGO_ARMAS.find((a) => costeArma(a) === 0)!;
    assert.equal(obtenerEstadoControl().ajuste.armaId, primeraGratis.id);
    assert.equal(obtenerEstadoControl().saldo, 0);
  });

  it("si el arma sigue siendo pagable la conserva", () => {
    fijarModo("presupuesto", 10_000);
    seleccionarArma(DE_PAGO.id);
    publicarEconomia(costeArma(DE_PAGO));
    assert.equal(obtenerEstadoControl().ajuste.armaId, DE_PAGO.id);
  });

  it("suelta el equipo que ya no se puede pagar y conserva el que sí", () => {
    fijarModo("presupuesto", 10_000);
    seleccionarEquipo("escudo");
    publicarEconomia(COSTE_ESCUDO);
    assert.equal(obtenerEstadoControl().equipoId, "escudo");
    publicarEconomia(COSTE_ESCUDO - 1);
    assert.equal(obtenerEstadoControl().equipoId, null);
  });

  it("con saldo null (barra libre) no toca ni arma ni equipo", () => {
    seleccionarArma(DE_PAGO.id);
    seleccionarEquipo("propulsores");
    publicarEconomia(null);
    assert.equal(obtenerEstadoControl().ajuste.armaId, DE_PAGO.id);
    assert.equal(obtenerEstadoControl().equipoId, "propulsores");
  });
});

describe("store: repetirUltimoDisparo", () => {
  it("sin último disparo no hace nada", () => {
    const antes = obtenerEstadoControl().ajuste;
    repetirUltimoDisparo();
    assert.deepEqual(obtenerEstadoControl().ajuste, antes);
  });

  it("precarga ángulo, potencia y arma del último disparo resuelto", () => {
    publicarDisparoJugadorResuelto({ anguloGrados: 33, potencia: 0.42, armaId: GRATIS.id });
    seleccionarArma(DE_PAGO.id);
    repetirUltimoDisparo();
    assert.deepEqual(obtenerEstadoControl().ajuste, { anguloGrados: 33, potencia: 0.42, armaId: GRATIS.id });
  });

  it("no repite un disparo con un arma ya agotada ni con una que no se puede pagar", () => {
    publicarDisparoJugadorResuelto({ anguloGrados: 20, potencia: 0.3, armaId: UN_USO.id });
    seleccionarArma(GRATIS.id);
    repetirUltimoDisparo();
    assert.equal(obtenerEstadoControl().ajuste.armaId, GRATIS.id, "agotada");

    reiniciarControl();
    publicarDisparoJugadorResuelto({ anguloGrados: 20, potencia: 0.3, armaId: DE_PAGO.id });
    fijarModo("presupuesto", 0);
    repetirUltimoDisparo();
    assert.notEqual(obtenerEstadoControl().ajuste.armaId, DE_PAGO.id, "sin saldo");
  });

  it("publicarDisparoJugadorResuelto cuenta los usos por arma", () => {
    publicarDisparoJugadorResuelto({ anguloGrados: 10, potencia: 0.5, armaId: GRATIS.id });
    publicarDisparoJugadorResuelto({ anguloGrados: 10, potencia: 0.5, armaId: GRATIS.id });
    assert.equal(obtenerEstadoControl().usosPorArma[GRATIS.id], 2);
  });
});

describe("store: publicadores idempotentes", () => {
  it("no avisan a los suscriptores si el valor no cambia", () => {
    let avisos = 0;
    const baja = suscribirControl(() => avisos++);
    try {
      publicarJugable(false);
      publicarEscudoPropio(0);
      publicarNombreRival("Rival");
      publicarVueloPropulsores("normal");
      assert.equal(avisos, 0);
      publicarJugable(true);
      publicarJugable(true);
      assert.equal(avisos, 1);
      publicarNombreRival("Otro");
      assert.equal(obtenerEstadoControl().nombreRival, "Otro");
      publicarPreparando(!obtenerEstadoControl().preparando);
      assert.equal(avisos, 3);
    } finally {
      baja();
    }
  });

  it("publicarVueloPropulsores distingue bloqueado y vuelo corto", () => {
    publicarVueloPropulsores("bloqueado");
    assert.equal(obtenerEstadoControl().propulsoresBloqueados, true);
    assert.equal(obtenerEstadoControl().propulsoresVueloCorto, false);
    publicarVueloPropulsores("corto");
    assert.equal(obtenerEstadoControl().propulsoresBloqueados, false);
    assert.equal(obtenerEstadoControl().propulsoresVueloCorto, true);
  });
});

describe("store: solicitarDisparo", () => {
  it("sin poder disparar o sin manejador no sale nada", () => {
    const disparos = capturarDisparos();
    solicitarDisparo();
    assert.equal(disparos.length, 0);
    registrarManejadorDisparo(() => undefined)();
    publicarJugable(true);
    solicitarDisparo();
    assert.equal(disparos.length, 0);
  });

  it("con un arma, entrega el ajuste actual contra la nave 1", () => {
    const disparos = capturarDisparos();
    publicarJugable(true);
    seleccionarArma(GRATIS.id);
    const { anguloGrados, potencia } = obtenerEstadoControl().ajuste;
    solicitarDisparo();
    assert.deepEqual(disparos, [{ arma: GRATIS.id, anguloGrados, potencia, objetivoId: 1 }]);
  });

  it("con equipo, entrega la acción del equipo y lo suelta", () => {
    const disparos = capturarDisparos();
    publicarJugable(true);
    seleccionarEquipo("propulsores");
    solicitarDisparo();
    assert.equal(disparos.length, 1);
    assert.equal(disparos[0].accion, "propulsores");
    assert.equal(disparos[0].arma, "propulsores");
    assert.equal(obtenerEstadoControl().equipoId, null);
  });

  it("no activa un escudo que ya está puesto ni enciende propulsores bloqueados", () => {
    const disparos = capturarDisparos();
    publicarJugable(true);
    seleccionarEquipo("escudo");
    publicarEscudoPropio(1);
    solicitarDisparo();
    seleccionarEquipo("propulsores");
    publicarVueloPropulsores("bloqueado");
    solicitarDisparo();
    assert.equal(disparos.length, 0);
  });

  it("el manejador anterior no se da de baja al registrar uno nuevo", () => {
    const primeros: EntradaDeTurno[] = [];
    const bajaPrimero = registrarManejadorDisparo((e) => primeros.push(e));
    const segundos = capturarDisparos();
    bajaPrimero();
    publicarJugable(true);
    solicitarDisparo();
    assert.equal(primeros.length, 0);
    assert.equal(segundos.length, 1);
  });
});

describe("store: solicitarDisparoAutomatico", () => {
  it("sin poder disparar no sale nada", () => {
    const disparos = capturarDisparos();
    solicitarDisparoAutomatico();
    assert.equal(disparos.length, 0);
  });

  it("con un arma pagable sale esa arma con el ajuste actual", () => {
    const disparos = capturarDisparos();
    publicarJugable(true);
    seleccionarArma(GRATIS.id);
    solicitarDisparoAutomatico();
    assert.equal(disparos.length, 1);
    assert.equal(disparos[0].arma, GRATIS.id);
    assert.equal(disparos[0].objetivoId, 1);
  });

  it("con equipo elegido sale un arma gratuita, nunca el equipo", () => {
    const disparos = capturarDisparos();
    publicarJugable(true);
    seleccionarEquipo("escudo");
    solicitarDisparoAutomatico();
    assert.equal(disparos.length, 1);
    assert.equal(disparos[0].accion, undefined);
    assert.equal(costeDeArma(disparos[0].arma), 0);
  });
});
