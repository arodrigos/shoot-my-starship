import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import fc from "fast-check";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { FACILIDAD_MEDIDA_PCT } from "@/sim/armas/facilidadMedida";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { avanzar } from "@/sim/partida/avanzar";
import {
  PRESUPUESTO_BASE,
  armasGratis,
  elegirArma,
  idsDisponibles,
  quitarArma,
  saldoDeRonda,
  seleccionInicial,
  type SeleccionArmas,
} from "@/sim/partida/economia";
import { crearPartidaInicial } from "@/sim/partida/motor";
import type { EstadoPartida } from "@/sim/partida/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";
import { medirCatalogo } from "../../utils/medirArmas";
import {
  abrirSeleccion,
  alternarArmaEnSeleccion,
  confirmarSeleccion,
  identificarJugadorSeleccion,
  obtenerSeleccion,
  registrarManejadorSeleccion,
  reiniciarSeleccion,
} from "@/juego/control/seleccionStore";

const MUNDO = { ancho: 1920, alto: 1080, gravedad: 1.0, deriva: 0, etiquetaDeriva: "economia-loadout" };
const ALTURA_SUELO = 900;
const IDS = CATALOGO_ARMAS.map((arma) => arma.id);

type Accion = { readonly tipo: "elegir" | "quitar"; readonly indice: number };

const accionArbitraria: fc.Arbitrary<Accion> = fc.record({
  tipo: fc.constantFrom("elegir" as const, "quitar" as const),
  indice: fc.integer({ min: 0, max: CATALOGO_ARMAS.length - 1 }),
});

function aplicar(seleccion: SeleccionArmas, accion: Accion): SeleccionArmas {
  const arma = CATALOGO_ARMAS[accion.indice];
  if (accion.tipo === "quitar") return quitarArma(seleccion, arma);
  const resultado = elegirArma(seleccion, arma);
  return resultado.ok ? resultado.seleccion : seleccion;
}

// economia-loadout-1
test("economia-loadout-1 (propiedad): para cualquier secuencia de selecciones el saldo nunca es negativo ni supera dos presupuestos base", () => {
  fc.assert(
    fc.property(fc.array(accionArbitraria, { maxLength: 60 }), (acciones) => {
      let seleccion = seleccionInicial();
      for (const accion of acciones) {
        seleccion = aplicar(seleccion, accion);
        assert.ok(seleccion.saldo >= 0, `saldo negativo: ${seleccion.saldo}`);
        assert.ok(seleccion.saldo <= 2 * PRESUPUESTO_BASE);
        // El saldo restante y lo gastado en lo elegido suman siempre el presupuesto.
        const gastado = seleccion.armas.reduce((suma, id) => suma + (CATALOGO_ARMAS.find((arma) => arma.id === id)?.coste ?? 0), 0);
        assert.equal(seleccion.saldo + gastado, PRESUPUESTO_BASE);
      }
      // El saldo de la ronda siguiente respeta el tope de arrastre.
      const siguiente = saldoDeRonda(seleccion.saldo);
      assert.ok(siguiente >= PRESUPUESTO_BASE && siguiente <= 2 * PRESUPUESTO_BASE);
    }),
    { numRuns: 300 },
  );
});

test("economia-loadout-1: el no gastado se arrastra hasta un presupuesto base y no más, y nunca resta", () => {
  assert.equal(saldoDeRonda(0), PRESUPUESTO_BASE);
  assert.equal(saldoDeRonda(300), PRESUPUESTO_BASE + 300);
  assert.equal(saldoDeRonda(PRESUPUESTO_BASE), 2 * PRESUPUESTO_BASE);
  assert.equal(saldoDeRonda(5 * PRESUPUESTO_BASE), 2 * PRESUPUESTO_BASE);
  assert.equal(saldoDeRonda(-50), PRESUPUESTO_BASE);
});

test("economia-loadout-1/7: un arma que no se puede pagar dice cuánto falta y no toca la selección", () => {
  const despedida = CATALOGO_ARMAS.find((arma) => arma.id === "despedida")!;
  const resultado = elegirArma(seleccionInicial(100), despedida);
  assert.equal(resultado.ok, false);
  if (!resultado.ok && resultado.motivo === "saldo-insuficiente") assert.equal(resultado.faltan, (despedida.coste ?? 0) - 100);
  assert.equal(elegirArma({ saldo: 500, armas: ["despedida"] }, despedida).ok, false, "una misma arma no se elige dos veces");
});

// economia-loadout-2
test("economia-loadout-2: sin saldo ni armas elegidas la lista disponible es exactamente las 3 gratis, de daño bajo", () => {
  const gratis = armasGratis();
  assert.equal(gratis.length, 3);
  assert.deepEqual([...idsDisponibles([])].sort(), gratis.map((arma) => arma.id).sort());
  const maxDanioNoGratis = Math.max(...CATALOGO_ARMAS.filter((arma) => (arma.coste ?? 0) > 0).map((arma) => (arma.efecto.tipo === "empuje" ? 0 : arma.efecto.danioMaximo)));
  for (const arma of gratis) {
    assert.ok((arma.efecto.tipo === "empuje" ? 0 : arma.efecto.danioMaximo) < maxDanioNoGratis / 2, `${arma.nombre} no es de daño bajo`);
  }
});

function estadoConLoadouts(loadouts: readonly (readonly string[] | undefined)[]): EstadoPartida {
  const mascara = crearMascaraPlana(MUNDO.ancho, MUNDO.alto, ALTURA_SUELO);
  const base = crearPartidaInicial(MUNDO, mascara, [200, 1700], 11);
  return { ...base, modo: "presupuesto", saldos: [400, undefined], loadouts };
}

function disparo(estado: EstadoPartida, arma: string) {
  const [solucion] = resolverSolucionesBalisticas(estado.naves[0].x, ALTURA_SUELO, estado.naves[1].x, ALTURA_SUELO, estado.mundo.gravedad);
  return avanzar(estado, { arma, anguloGrados: solucion.anguloGrados, potencia: solucion.potencia, objetivoId: 1 });
}

test("economia-loadout-2/3: disparar consume el arma, lo no elegido se rechaza y con el loadout vacío siguen las 3 gratis", () => {
  const estado = estadoConLoadouts([["tostadora-orbital"], undefined]);
  assert.throws(() => disparo(estado, "despedida"), /no está en el loadout/);

  const tras = disparo(estado, "tostadora-orbital").estado;
  assert.deepEqual(tras.loadouts?.[0], [], "el arma disparada sale del loadout");
  // Con el loadout agotado la nave no se queda sin jugar: las gratis valen y no se consumen.
  assert.throws(() => disparo({ ...tras, turno: 0 }, "tostadora-orbital"), /no está en el loadout/);
  const conGratis = disparo({ ...tras, turno: 0 }, "zanjadora-manolita").estado;
  assert.deepEqual(conGratis.loadouts?.[0], []);
});

// economia-loadout-4
test("economia-loadout-4: el saldo tras un disparo con impacto no cambia: se paga al elegir y no hay ingreso por daño", () => {
  const estado = estadoConLoadouts([["tostadora-orbital", "despedida"], undefined]);
  const { estado: tras, eventos } = disparo(estado, "tostadora-orbital");
  assert.ok(eventos.some((evento) => evento.tipo === "impacto" && evento.danio > 0), "el escenario tiene que causar daño real");
  assert.deepEqual(tras.saldos, estado.saldos);
});

async function ficheros(directorio: string): Promise<string[]> {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const lotes = await Promise.all(
    entradas.map((entrada) =>
      entrada.isDirectory() ? ficheros(path.join(directorio, entrada.name)) : Promise.resolve([path.join(directorio, entrada.name)]),
    ),
  );
  return lotes.flat();
}

test("economia-loadout-4: ninguna ruta del código fuente concede crédito por daño", async () => {
  for (const fichero of (await ficheros(path.resolve(process.cwd(), "src"))).filter((f) => /\.(ts|tsx)$/.test(f))) {
    const contenido = await readFile(fichero, "utf8");
    assert.ok(!/ingresoPorDanio|TASA_INGRESO_POR_DANIO/.test(contenido), `${fichero} aún referencia el ingreso por daño`);
  }
});

// economia-loadout-5/6/7: el puente de la pantalla de selección
test("economia-loadout-7: confirmar sin armas avisa primero y solo a la segunda pulsación confirma", () => {
  reiniciarSeleccion();
  let confirmada: SeleccionArmas | null = null;
  const cancelar = registrarManejadorSeleccion((seleccion) => {
    confirmada = seleccion;
  });
  abrirSeleccion("Ana", PRESUPUESTO_BASE, false);
  confirmarSeleccion();
  assert.equal(obtenerSeleccion().avisoVacio, true);
  assert.equal(confirmada, null);
  confirmarSeleccion();
  assert.deepEqual(confirmada, { saldo: PRESUPUESTO_BASE, armas: [] });
  cancelar();
  reiniciarSeleccion();
});

test("economia-loadout-5/7: con varios humanos no se confirma hasta identificarse, y un arma impagable explica la diferencia", () => {
  reiniciarSeleccion();
  let confirmaciones = 0;
  const cancelar = registrarManejadorSeleccion(() => {
    confirmaciones += 1;
  });
  abrirSeleccion("Luis", 100, true);
  confirmarSeleccion();
  assert.equal(confirmaciones, 0, "sin identificarse no se puede confirmar");
  identificarJugadorSeleccion();
  alternarArmaEnSeleccion("despedida");
  assert.match(obtenerSeleccion().error ?? "", /Despedida cuesta 20 créditos más/);
  assert.deepEqual(obtenerSeleccion().seleccion, { saldo: 100, armas: [] });
  alternarArmaEnSeleccion("vertedero-portatil");
  assert.equal(obtenerSeleccion().seleccion.saldo, 85);
  alternarArmaEnSeleccion("vertedero-portatil");
  assert.equal(obtenerSeleccion().seleccion.saldo, 100, "pulsar otra vez una elegida la devuelve");
  cancelar();
  reiniciarSeleccion();
});

// economia-loadout-6: la facilidad que enseña la pantalla es la medida de verdad
test("economia-loadout-6: la facilidad estática de la pantalla de selección coincide con la medición viva", () => {
  assert.deepEqual(Object.keys(FACILIDAD_MEDIDA_PCT).sort(), [...IDS].sort());
  for (const metrica of medirCatalogo()) {
    const id = CATALOGO_ARMAS.find((arma) => arma.nombre === metrica.nombre)!.id;
    assert.equal(FACILIDAD_MEDIDA_PCT[id], Math.round(metrica.facilidad * 1000) / 10, `${metrica.nombre}: la tabla estática se ha quedado vieja`);
  }
});

// economia-loadout-8
test("economia-loadout-8: el README cita el número real de armas y el precio y el papel de cada una", async () => {
  const readme = await readFile(path.resolve(process.cwd(), "README.md"), "utf8");
  const filas = readme.split("\n").filter((linea) => /^\| .+ \| \d+ \| .+ \|$/.test(linea));
  assert.equal(filas.length, CATALOGO_ARMAS.length, "el README tiene que tabular todas las armas del catálogo");
  for (const arma of CATALOGO_ARMAS) {
    assert.ok(
      filas.some((fila) => fila.startsWith(`| ${arma.nombre} | ${arma.coste} | ${arma.rol} |`)),
      `el README no recoge el precio y el papel actuales de ${arma.nombre}`,
    );
  }
  const numeros = ["dieciséis", String(CATALOGO_ARMAS.length)];
  assert.ok(numeros.some((n) => readme.includes(n)));
  assert.equal(CATALOGO_ARMAS.length, 16, "si el catálogo cambia, el texto 'dieciséis armas' del README hay que revisarlo");
  for (const tema of [/360°/, /relevo/i, /de 1 a 4 humanos|2 a 4 naves/, /recalibrada/, /dispersión/, /No hay ingreso por daño/]) {
    assert.match(readme, tema);
  }
});
