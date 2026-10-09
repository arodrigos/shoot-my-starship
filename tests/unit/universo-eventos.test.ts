import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { calcularPrevisualizacion } from "@/sim/armas/previsualizacion";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { crearProyectil } from "@/sim/fisica/proyectil";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { ALTURA_CANON_PX, detenerseEnSuelo } from "@/sim/armas/resolver";
import { masaPlaneta, recalcularRegistro, type Planeta } from "@/sim/gravedad/planetas";
import { dibujarPozosGravedad, firmaDeHalos } from "@/juego/fondo/PozosGravedad";
import { PREMIO_LOTERIA, PRESUPUESTO_BASE } from "@/sim/economia/parametros";
import { avanzar } from "@/sim/partida/avanzar";
import { colocarNaves } from "@/sim/naves/colocacion";
import { octavoDelMundo } from "@/sim/naves/desplazamiento";
import { RADIO_ENVOLVENTE_NAVE_PX } from "@/sim/naves/geometriaCasco";
import { esPosicionValida } from "@/sim/naves/zonaValida";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { eventosDisponibles } from "@/sim/universo/catalogoEventos";
import { PROBABILIDAD_EVENTO_GRATIS } from "@/sim/universo/disparoGratis";
import { aplicarEvento, avanzarUniverso, conUniverso, factorDanio, ID_AGUJERO_NEGRO, TURNOS_EFECTO_NAVE } from "@/sim/universo/efectos";
import type { EventoProgramado, EstadoUniverso, TipoEvento } from "@/sim/universo/tipos";
import { MUNDO_ALTO, MUNDO_ANCHO } from "../utils/sistemaGenerado";
import { comprobarCalendarioDeEventos, NUM_SEMILLAS_EVT_1_RAPIDO } from "../utils/calendarioEventos";

const MUNDO: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 0, deriva: 0, etiquetaDeriva: "" };
const SEMILLA_SISTEMA = 31;
const COLOCACION = colocarNaves(SEMILLA_SISTEMA, MUNDO, crearEstadoAleatorio(SEMILLA_SISTEMA), 4, [false, false, false, false]);

function estadoBase(semilla: number, modo: "barra-libre" | "presupuesto"): EstadoPartida {
  return conUniverso({
    version: 1,
    mundo: MUNDO,
    mascara: { ...COLOCACION.sistema.mascara, datos: COLOCACION.sistema.mascara.datos.slice() },
    naves: COLOCACION.naves,
    ordenTurno: [0, 1, 2, 3],
    turno: 0,
    numeroTurno: 0,
    aleatorio: crearEstadoAleatorio(semilla),
    resultado: { tipo: "en-curso" },
    planetas: COLOCACION.sistema.planetas,
    modo,
    ...(modo === "presupuesto" ? { saldos: [PRESUPUESTO_BASE, PRESUPUESTO_BASE, PRESUPUESTO_BASE, PRESUPUESTO_BASE] } : {}),
  });
}

function universoDe(estado: EstadoPartida): EstadoUniverso {
  assert.ok(estado.universo !== undefined);
  return estado.universo;
}

// Cierra un turno solo del universo, rotando el tirador como lo haría la partida.
function cerrar(estado: EstadoPartida, tirador: number, armaGratis: boolean) {
  return avanzarUniverso(estado, { tirador, armaGratis });
}

function conProximo(estado: EstadoPartida, proximo: EventoProgramado): EstadoPartida {
  return { ...estado, universo: { ...universoDe(estado), proximo } };
}

// evt-1 (invariantes 1 y 5): para toda semilla, el hueco entre eventos de
// calendario está en [2, 5] y el evento que ocurre es exactamente el
// anunciado. Aquí corre con pocas semillas; el lote de 1000 vive en
// scripts/medir-eventos.ts (PRUEBA_LARGA), fuera del CI rápido.
test("evt-1: huecos del calendario en [2,5] y el pronóstico siempre acierta", () => {
  comprobarCalendarioDeEventos(NUM_SEMILLAS_EVT_1_RAPIDO);
});

// evt-3: vitaminas ×2 durante exactamente 3 turnos propios y luego desaparece;
// los turnos restantes nunca son negativos (invariante 3).
test("evt-3: vitaminas y virus duran 3 turnos del afectado y desaparecen al agotarse", () => {
  for (const tipo of ["vitaminas", "virus"] as const) {
    let estado = estadoBase(7, "barra-libre");
    estado = aplicarEvento(estado, { enTurnos: 0, tipo, afectado: 0 }, "calendario").estado;
    assert.deepEqual(universoDe(estado).efectos, [{ tipo, nave: 0, turnosRestantes: TURNOS_EFECTO_NAVE }]);
    assert.equal(factorDanio(estado, 0), tipo === "vitaminas" ? 2 : 0.5);
    assert.equal(factorDanio(estado, 1), 1);
    // Un evento de calendario lejano no interfiere: se pospone para aislar el efecto.
    estado = conProximo(estado, { enTurnos: 99, tipo: "loteria", afectado: 0 });
    for (let propio = 1; propio <= TURNOS_EFECTO_NAVE; propio++) {
      // Turnos ajenos no gastan el efecto.
      estado = cerrar(estado, 1, false).estado;
      assert.equal(universoDe(estado).efectos.length, 1);
      estado = cerrar(estado, 0, false).estado;
      const restantes = universoDe(estado).efectos[0]?.turnosRestantes ?? 0;
      assert.equal(restantes, TURNOS_EFECTO_NAVE - propio);
    }
    assert.equal(universoDe(estado).efectos.length, 0);
    assert.equal(factorDanio(estado, 0), 1);
  }
});

test("evt-3: la lotería suma exactamente PREMIO_LOTERIA al afectado y a nadie más", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 2000 }), (afectado, saldoExtra) => {
      const base = estadoBase(3, "presupuesto");
      const saldos = [0, 1, 2, 3].map((id) => PRESUPUESTO_BASE + saldoExtra * (id + 1));
      const estado = { ...base, saldos };
      const { estado: despues } = aplicarEvento(estado, { enTurnos: 0, tipo: "loteria", afectado }, "calendario");
      despues.saldos?.forEach((saldo, id) => assert.equal(saldo, saldos[id] + (id === afectado ? PREMIO_LOTERIA : 0)));
    }),
    { numRuns: 100 },
  );
});

test("evt-3: sin lotería en barra libre y sin eventos curativos en muerte súbita", () => {
  assert.ok(!eventosDisponibles("barra-libre", "normal").some((evento) => evento.tipo === "loteria"));
  assert.ok(eventosDisponibles("presupuesto", "normal").some((evento) => evento.tipo === "loteria"));
  assert.ok(!eventosDisponibles("presupuesto", "muerte-subita").some((evento) => evento.curativo));
});

test("evt-3: el terremoto lleva cada nave a [OCTAVO, 2·OCTAVO] de donde estaba, en posición válida", () => {
  const octavo = octavoDelMundo(MUNDO);
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 0x7fffffff }), (semilla) => {
      const antes = estadoBase(semilla, "barra-libre");
      const { estado } = aplicarEvento(antes, { enTurnos: 0, tipo: "terremoto", afectado: 0 }, "calendario");
      estado.naves.forEach((nave, id) => {
        const origen = antes.naves[id];
        const distancia = Math.hypot(nave.x - origen.x, (nave.y as number) - (origen.y as number));
        const otras = estado.naves.flatMap((otra, idOtra) => (idOtra !== id ? [{ x: otra.x, y: otra.y as number }] : []));
        if (distancia === 0) return; // sin hueco válido en 64 candidatos: se queda donde estaba
        assert.ok(distancia >= octavo - 1e-6 && distancia <= 2 * octavo + 1e-6, `distancia ${distancia}`);
        assert.ok(esPosicionValida({ x: nave.x, y: nave.y as number }, MUNDO, antes.mascara, otras));
      });
    }),
    { numRuns: 40 },
  );
});

// Cráteres fabricados sobre cada planeta: así hay algo que reparar.
function conCrateres(estado: EstadoPartida): EstadoPartida {
  const datos = estado.mascara.datos.slice();
  const ancho = estado.mascara.ancho;
  for (const planeta of estado.planetas ?? []) {
    for (let y = Math.floor(planeta.cy - planeta.radio); y <= planeta.cy + planeta.radio; y++) {
      for (let x = Math.floor(planeta.cx - planeta.radio); x <= planeta.cx + planeta.radio; x++) {
        if (x < 0 || y < 0 || x >= ancho || y >= estado.mascara.alto) continue;
        if (x > planeta.cx && datos[y * ancho + x] === planeta.id) datos[y * ancho + x] = 0;
      }
    }
  }
  return { ...estado, mascara: { ...estado.mascara, datos } };
}

test("evt-3: la reparación devuelve ~50 % de los píxeles destruidos sin pisar cascos y sin pasar de la masa original", () => {
  const roto = conCrateres(estadoBase(5, "barra-libre"));
  const inicial = universoDe(roto).mascaraInicial;
  const planetas = roto.planetas ?? [];
  const { estado } = aplicarEvento(roto, { enTurnos: 0, tipo: "reparacion", afectado: 0 }, "calendario");
  planetas.forEach((planeta, indice) => {
    const perdidosAntes = contar(inicial.datos, planeta.id) - contar(roto.mascara.datos, planeta.id);
    const recuperados = contar(estado.mascara.datos, planeta.id) - contar(roto.mascara.datos, planeta.id);
    if (perdidosAntes > 200) {
      const proporcion = recuperados / perdidosAntes;
      assert.ok(proporcion >= 0.4 && proporcion <= 0.5 + 1e-9, `planeta ${planeta.id}: ${proporcion}`);
    }
    const original = contar(inicial.datos, planeta.id) * planeta.densidad;
    assert.ok(masaPlaneta((estado.planetas ?? [])[indice]) <= original + 1e-9);
  });
  const ancho = estado.mascara.ancho;
  estado.mascara.datos.forEach((material, indice) => {
    if (material === roto.mascara.datos[indice]) return;
    const x = indice % ancho;
    const y = Math.floor(indice / ancho);
    estado.naves.forEach((nave) => assert.ok(Math.hypot(nave.x - x, (nave.y as number) - y) > RADIO_ENVOLVENTE_NAVE_PX, "píxel restaurado bajo un casco"));
  });
});

function contar(datos: Uint8Array, material: number): number {
  let total = 0;
  for (const valor of datos) if (valor === material) total++;
  return total;
}

// evt-2 (invariante 2): con gravedad ×2, ÷2 o viento solar activos, lo que
// dibuja la previsualización es lo que vuela, porque los efectos viven en el
// mismo estado que leen las dos; y devolver el estado lo deja como estaba.
function trayectoria(estado: EstadoPartida, pasos: number) {
  const nave = estado.naves[0];
  const rad = (60 * Math.PI) / 180;
  const v = velocidadDesdePotencia(55);
  const origenY = nave.y as number;
  const inicial = crearProyectil(nave.x, origenY - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
  const previa = calcularPrevisualizacion({
    mascara: estado.mascara,
    gravedad: estado.mundo.gravedad,
    deriva: estado.mundo.deriva,
    ancho: estado.mundo.ancho,
    alto: estado.mundo.alto,
    planetas: estado.planetas,
    origenX: nave.x,
    origenY,
    anguloGrados: 60,
    potencia: 55,
    comportamiento: { tipo: "impacto-simple" },
    longitudFija: pasos,
  });
  const real = simularVuelo(inicial, estado.mundo.gravedad, estado.mundo.deriva, detenerseEnSuelo(estado.mascara, estado.mundo.ancho, estado.mundo.alto), {
    planetas: estado.planetas,
    grabarTrayectoria: true,
  });
  return { previa, real: (real.trayectoria ?? []).slice(0, previa.length) };
}

test("evt-2: la previsualización coincide con el vuelo con cualquier efecto global y vuelve a la normal al expirar", () => {
  const sin = estadoBase(11, "barra-libre");
  const referencia = trayectoria(sin, 120);
  assert.ok(referencia.previa.length > 20);
  const tipos: TipoEvento[] = ["gravedad-x2", "gravedad-mitad", "viento-solar", "agujero-negro"];
  for (const tipo of tipos) {
    const con = aplicarEvento(conProximo(sin, { enTurnos: 99, tipo: "loteria", afectado: 0 }), { enTurnos: 0, tipo, afectado: 0 }, "calendario").estado;
    const { previa, real } = trayectoria(con, 120);
    previa.forEach((punto, indice) => {
      assert.ok(Math.hypot(punto.x - real[indice].x, punto.y - real[indice].y) <= 0.5, `${tipo}: desvío en el paso ${indice}`);
    });
    const lejos = Math.hypot(previa[previa.length - 1].x - referencia.previa[referencia.previa.length - 1].x, previa[previa.length - 1].y - referencia.previa[referencia.previa.length - 1].y);
    // Con ×2 el caso pide más de 20 u: un cambio de 1 u no demuestra que la gravedad se note.
    assert.ok(lejos > (tipo === "gravedad-x2" ? 20 : 1), `${tipo} no cambia la trayectoria lo bastante (${lejos.toFixed(1)} u)`);
    // Una ronda de 4 naves vivas: tras 4 cierres, todo vuelve a la normalidad.
    let tras = con;
    for (let turno = 0; turno < 4; turno++) tras = cerrar(tras, turno, false).estado;
    assert.equal(universoDe(tras).efectos.length, 0);
    assert.equal(tras.mundo.gravedad, sin.mundo.gravedad);
    assert.equal(tras.mundo.deriva, sin.mundo.deriva);
    assert.deepEqual(tras.planetas, sin.planetas);
    const vuelta = trayectoria(tras, 120);
    vuelta.previa.forEach((punto, indice) => assert.ok(Math.hypot(punto.x - referencia.previa[indice].x, punto.y - referencia.previa[indice].y) <= 0.5));
  }
});

// evt-2/evt-3: el agujero negro es un pozo de masa explícita que sobrevive al
// recálculo del registro y se retira al acabar su ronda.
test("evt-3: el agujero negro añade un pozo con masa propia, recalcularRegistro la respeta y desaparece tras una ronda", () => {
  const sin = estadoBase(11, "barra-libre");
  const con = aplicarEvento(conProximo(sin, { enTurnos: 99, tipo: "loteria", afectado: 0 }), { enTurnos: 0, tipo: "agujero-negro", afectado: 0 }, "calendario").estado;
  const pozo = con.planetas?.find((planeta) => planeta.id === ID_AGUJERO_NEGRO);
  assert.ok(pozo !== undefined, "el pozo está en el registro");
  assert.equal(con.planetas?.length, (sin.planetas?.length ?? 0) + 1);
  assert.ok(masaPlaneta(pozo) > 0);
  const recalculado = recalcularRegistro(con.planetas ?? [], con.mascara).find((planeta) => planeta.id === ID_AGUJERO_NEGRO);
  assert.equal(masaPlaneta(recalculado as Planeta), masaPlaneta(pozo), "recalcularRegistro no anula la masa");
  assert.ok(pozo.cx > 0 && pozo.cx < con.mundo.ancho && pozo.cy > 0 && pozo.cy < con.mundo.alto);
  // Un segundo agujero negro sustituye al primero en vez de acumularse.
  const doble = aplicarEvento(con, { enTurnos: 0, tipo: "agujero-negro", afectado: 0 }, "calendario").estado;
  assert.equal(doble.planetas?.filter((planeta) => planeta.id === ID_AGUJERO_NEGRO).length, 1);
  // Convive con la gravedad ×2 y su expiración no le toca la masa.
  const x2 = aplicarEvento(con, { enTurnos: 0, tipo: "gravedad-x2", afectado: 0 }, "calendario").estado;
  assert.equal(masaPlaneta(x2.planetas?.find((planeta) => planeta.id === ID_AGUJERO_NEGRO) as Planeta), masaPlaneta(pozo));
  let tras = con;
  for (let turno = 0; turno < 4; turno++) tras = cerrar(tras, turno, false).estado;
  assert.equal(tras.planetas?.some((planeta) => planeta.id === ID_AGUJERO_NEGRO), false);
  assert.deepEqual(tras.planetas, sin.planetas);
});

// evt-2: los halos de gravedad que se pintan salen de la física del registro,
// así que con ×2 (o con el agujero negro) no pueden ser los mismos que sin evento.
test("evt-2: los halos de los pozos cambian con gravedad ×2, ÷2 y agujero negro, y vuelven al expirar", () => {
  const sin = estadoBase(11, "barra-libre");
  const halos = (estado: EstadoPartida) => {
    const radios: number[] = [];
    // Cada banda es un strokeCircle de grosor `ancho`: su borde exterior es el radio del anillo.
    let ancho = 0;
    const lienzo = {
      lineStyle: (grosor: number) => void (ancho = grosor),
      strokeCircle: (_x: number, _y: number, radio: number) => void radios.push(radio + ancho / 2),
    };
    dibujarPozosGravedad(lienzo as unknown as Phaser.GameObjects.Graphics, estado.planetas ?? [], referencias, 1920, 1080);
    return radios;
  };
  const referencias = new Map((sin.planetas ?? []).map((planeta) => [planeta.id, masaPlaneta(planeta)]));
  const base = halos(sin);
  assert.ok(base.length > 0);
  const con = (tipo: TipoEvento) => aplicarEvento(conProximo(sin, { enTurnos: 99, tipo: "loteria", afectado: 0 }), { enTurnos: 0, tipo, afectado: 0 }, "calendario").estado;
  const x2 = halos(con("gravedad-x2"));
  const mitad = halos(con("gravedad-mitad"));
  assert.notDeepEqual(x2, base);
  assert.notDeepEqual(mitad, base);
  assert.ok(x2.reduce((a, b) => a + b, 0) > base.reduce((a, b) => a + b, 0), "×2 agranda los halos");
  assert.ok(mitad.reduce((a, b) => a + b, 0) < base.reduce((a, b) => a + b, 0), "÷2 los encoge");
  assert.ok(halos(con("agujero-negro")).length > base.length, "el agujero negro tiene su propio halo");
  assert.notEqual(firmaDeHalos(con("gravedad-x2").planetas ?? []), firmaDeHalos(sin.planetas ?? []));
  let tras = con("gravedad-x2");
  for (let turno = 0; turno < 4; turno++) tras = cerrar(tras, turno, false).estado;
  assert.deepEqual(halos(tras), base);
});

// evt-4: estadística de las armas gratis con el cierre real del universo.
test("evt-4: un disparo gratis provoca evento ~25 %, cualquiera nave, sin tocar el calendario; en barra libre, nunca", () => {
  let eventos = 0;
  const afectadas = [0, 0, 0, 0];
  let buenos = 0;
  let malos = 0;
  const DISPAROS = 2000;
  for (let semilla = 1; semilla <= DISPAROS; semilla++) {
    const estado = conProximo(estadoBase(semilla * 7919, "presupuesto"), { enTurnos: 99, tipo: "virus", afectado: 0 });
    const { estado: despues, eventos: salida } = cerrar(estado, 0, true);
    const provocados = salida.filter((evento) => evento.tipo === "evento-universo" && evento.origen === "arma-gratis");
    assert.deepEqual(universoDe(despues).proximo.enTurnos, 98, "el calendario solo avanza su cuenta atrás");
    assert.ok(provocados.length <= 1);
    for (const evento of provocados) {
      if (evento.tipo !== "evento-universo") continue;
      eventos++;
      afectadas[evento.nave]++;
      assert.ok(eventosDisponibles("presupuesto", "normal").some((disponible) => disponible.tipo === evento.evento));
      if (evento.evento === "loteria" || evento.evento === "vitaminas" || evento.evento === "reparacion") buenos++;
      else malos++;
    }
    const libre = cerrar(conProximo(estadoBase(semilla * 7919, "barra-libre"), { enTurnos: 99, tipo: "virus", afectado: 0 }), 0, true);
    assert.equal(libre.eventos.filter((evento) => evento.tipo === "evento-universo").length, 0);
  }
  const frecuencia = eventos / DISPAROS;
  assert.ok(frecuencia >= 0.22 && frecuencia <= 0.28, `frecuencia ${frecuencia} (esperada ${PROBABILIDAD_EVENTO_GRATIS})`);
  assert.ok(buenos > 0 && malos > 0);
  afectadas.forEach((cuantos, id) => {
    const parte = cuantos / eventos;
    assert.ok(parte >= 0.18 && parte <= 0.32, `la nave ${id} es afectada el ${parte}`);
  });
});

test("evt-3: un evento cuyo afectado murió antes se anuncia como perdido y no cambia nada", () => {
  const estado = estadoBase(9, "presupuesto");
  const muerta = { ...estado, naves: estado.naves.map((nave, id) => (id === 2 ? { ...nave, integridad: 0 } : nave)) };
  const { estado: despues, eventos } = aplicarEvento(muerta, { enTurnos: 0, tipo: "loteria", afectado: 2 }, "calendario");
  assert.deepEqual(despues, muerta);
  assert.equal(eventos[0].tipo === "evento-universo" && eventos[0].perdido, true);
});

test("determinismo: misma semilla y mismas entradas, mismo universo serializado", () => {
  const correr = (): string => {
    let estado = estadoBase(42, "presupuesto");
    for (let turno = 0; turno < 30; turno++) estado = cerrar(estado, turno % 4, turno % 3 === 0).estado;
    return JSON.stringify({ ...estado, mascara: undefined, universo: { ...universoDe(estado), mascaraInicial: undefined } });
  };
  assert.equal(correr(), correr());
});

// evt-1: con vitaminas el mismo disparo hace el doble de daño (y con virus la
// mitad), pasando por avanzar() real y no por el multiplicador a solas.
test("evt-1: vitaminas doblan y virus reducen a la mitad el daño de un disparo real", () => {
  const dos = colocarNaves(SEMILLA_SISTEMA, MUNDO, crearEstadoAleatorio(SEMILLA_SISTEMA), 2, [false, false]);
  const base: EstadoPartida = conProximo(
    conUniverso({
      version: 1,
      mundo: MUNDO,
      mascara: dos.sistema.mascara,
      naves: dos.naves,
      ordenTurno: [0, 1],
      turno: 0,
      numeroTurno: 0,
      aleatorio: dos.aleatorio,
      resultado: { tipo: "en-curso" },
      planetas: dos.sistema.planetas,
    }),
    { enTurnos: 99, tipo: "virus", afectado: 1 },
  );
  const disparar = (estado: EstadoPartida, anguloGrados: number, potencia: number): number =>
    100 - avanzar(estado, { arma: "pepinazo-cortesia", anguloGrados, potencia, objetivoId: 1 }).estado.naves[1].integridad;
  let encontrado: { angulo: number; potencia: number; danio: number } | null = null;
  for (let angulo = 0; angulo < 360 && encontrado === null; angulo += 2) {
    for (const potencia of [30, 45, 60, 75, 90]) {
      const danio = disparar(base, angulo, potencia);
      if (danio > 0) {
        encontrado = { angulo, potencia, danio };
        break;
      }
    }
  }
  assert.ok(encontrado !== null, "ninguna combinación de la rejilla acierta: cambia de semilla");
  assert.ok(encontrado.danio <= 50, "el escenario tiene que dejar margen para doblar sin topar con 100");
  const conEfecto = (tipo: "vitaminas" | "virus"): EstadoPartida => aplicarEvento(base, { enTurnos: 0, tipo, afectado: 0 }, "calendario").estado;
  // El daño se redondea a entero por disparo, de ahí la tolerancia de ±1.
  assert.ok(Math.abs(disparar(conEfecto("vitaminas"), encontrado.angulo, encontrado.potencia) - 2 * encontrado.danio) <= 1);
  const conVirus = disparar(conEfecto("virus"), encontrado.angulo, encontrado.potencia);
  assert.ok(Math.abs(conVirus - encontrado.danio / 2) <= 1, `virus: ${conVirus} frente a ${encontrado.danio}`);
});
