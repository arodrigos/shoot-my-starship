import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import fc from "fast-check";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { crearFuenteIA } from "@/sim/ia/fuente";
import { LA_CONTABLE } from "@/sim/ia/personalidades";
import { avanzar } from "@/sim/partida/avanzar";
import { comprobarInvariante, crearPartidaInicial, jugarPartida } from "@/sim/partida/motor";
import { idsNavesVivas, siguienteTurno, type EstadoPartida, type FuenteDeTurno, type IdNave } from "@/sim/partida/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";
import { crearEstadoAleatorio } from "@/sim/aleatorio";

const MUNDO = { ancho: 1920, alto: 1080, gravedad: 1.0, deriva: 0, etiquetaDeriva: "nucleo-n-naves" };
const ALTURA_SUELO = 900;
const LIMITE_TURNOS = 200;

// Fuente determinista para el núcleo de N naves: apunta exacto (fiabilidad 1,
// sin ruido de personalidad) contra el rival vivo de menor id -- es lo
// mínimo necesario para que avanzar() tenga un objetivo real, no una
// política de combate que se esté probando aquí (eso es fuente.ts, más
// abajo). Cada nave ataca a la de menor id entre las demás vivas, lo que
// concentra el fuego de todas sobre la nave 0 hasta eliminarla y repite el
// patrón sobre el resto -- una secuencia de eliminación real, no un empate
// artificial.
function fuenteExacta(): FuenteDeTurno {
  return (estado) => {
    const tirador = estado.turno;
    const rivales = idsNavesVivas(estado).filter((id) => id !== tirador);
    const objetivoId = Math.min(...rivales);
    const naveTiradora = estado.naves[tirador];
    const naveObjetivo = estado.naves[objetivoId];
    const [solucion] = resolverSolucionesBalisticas(naveTiradora.x, ALTURA_SUELO, naveObjetivo.x, ALTURA_SUELO, estado.mundo.gravedad);
    return {
      entrada: {
        arma: "pepinazo-cortesia",
        anguloGrados: solucion?.anguloGrados ?? 45,
        potencia: solucion?.potencia ?? 70,
        objetivoId,
      },
      estado,
    };
  };
}

function jugarPartidaDe(n: number, semilla: number) {
  const mascara = crearMascaraPlana(MUNDO.ancho, MUNDO.alto, ALTURA_SUELO);
  const xNaves = Array.from({ length: n }, (_, i) => 200 + i * (1520 / (n - 1)));
  const inicial = crearPartidaInicial(MUNDO, mascara, xNaves, semilla);
  const fuentes = Array.from({ length: n }, () => fuenteExacta());
  return jugarPartida(inicial, fuentes, LIMITE_TURNOS);
}

for (const n of [3, 4]) {
  test(`nucleo-n-naves-1: una partida de ${n} naves admite de 2 a 4 naves, con orden de turno y ganador "último en pie"`, () => {
    const resultado = jugarPartidaDe(n, 1000 + n);
    assert.equal(resultado.agotada, false, `partida de ${n} no convergió en ${LIMITE_TURNOS} turnos`);
    assert.equal(resultado.estado.resultado.tipo, "terminada");
    assert.deepEqual([...resultado.estado.ordenTurno].sort(), Array.from({ length: n }, (_, i) => i));

    const problemas = comprobarInvariante(resultado.estado);
    assert.deepEqual(problemas, [], `invariantes rotos: ${problemas.join("; ")}`);

    if (resultado.estado.resultado.tipo === "terminada") {
      const { ganador } = resultado.estado.resultado;
      assert.notEqual(ganador, null, "con una sola nave viva, ganador nunca debería ser null");
      assert.equal(resultado.estado.naves[ganador as IdNave].integridad > 0, true);
      const vivas = resultado.estado.naves.filter((nave) => nave.integridad > 0);
      assert.equal(vivas.length, 1, "último en pie: debe quedar exactamente una nave viva");
    }
  });
}

test("nucleo-n-naves-2: nada en el núcleo asume dos bandos -- la IA elige objetivo entre varios rivales vivos y nunca a sí misma", () => {
  const mascara = crearMascaraPlana(MUNDO.ancho, MUNDO.alto, ALTURA_SUELO);
  const xNaves = [200, 900, 1720];
  let estado: EstadoPartida = {
    ...crearPartidaInicial(MUNDO, mascara, xNaves, 42),
    turno: 1,
  };
  const fuenteIA = crearFuenteIA(LA_CONTABLE);
  const { entrada } = fuenteIA(estado);
  assert.notEqual(entrada.objetivoId, 1, "la IA nunca se elige a sí misma como objetivo");
  assert.ok([0, 2].includes(entrada.objetivoId), "el objetivo debe ser uno de los rivales vivos");

  // Con el rival más cercano ya eliminado, el objetivo tiene que recaer en
  // el único rival que queda vivo -- nunca en el eliminado ni en sí misma.
  estado = { ...estado, naves: estado.naves.map((nave, id) => (id === 0 ? { ...nave, integridad: 0 } : nave)) };
  const { entrada: entradaTrasEliminacion } = fuenteIA(estado);
  assert.equal(entradaTrasEliminacion.objetivoId, 2);
});

test("nucleo-n-naves-3: saldo y loadout son campos por nave: disparar consume solo el arma del tirador y no mueve ningún saldo", () => {
  const mascara = crearMascaraPlana(MUNDO.ancho, MUNDO.alto, ALTURA_SUELO);
  const xNaves = [200, 900, 1720, 1720 - 100];
  const base = crearPartidaInicial(MUNDO, mascara, xNaves, 7);
  const estado: EstadoPartida = {
    ...base,
    modo: "presupuesto",
    saldos: [1000, 500, 1000, 1000],
    loadouts: [["pepinazo-cortesia", "despedida"], ["despedida"], undefined, []],
  };

  const [solucion] = resolverSolucionesBalisticas(estado.naves[0].x, ALTURA_SUELO, estado.naves[1].x, ALTURA_SUELO, estado.mundo.gravedad);
  const { estado: tras } = avanzar(estado, {
    arma: "pepinazo-cortesia",
    anguloGrados: solucion.anguloGrados,
    potencia: solucion.potencia,
    objetivoId: 1,
  });

  assert.deepEqual(tras.loadouts?.[0], ["despedida"], "el arma disparada sale del loadout de la nave 0");
  assert.deepEqual(tras.loadouts?.[1], ["despedida"], "el loadout de otra nave no cambia por el disparo de la primera");
  assert.equal(tras.loadouts?.[2], undefined);
  assert.deepEqual(tras.loadouts?.[3], []);
  assert.deepEqual(tras.saldos, [1000, 500, 1000, 1000], "ningún saldo se mueve al disparar: se paga al elegir y no hay ingreso por daño");
});

test("nucleo-n-naves-6: invariantes del modelo de turnos (fast-check)", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 2, max: 4 }),
      fc.array(fc.boolean(), { minLength: 2, maxLength: 4 }),
      fc.integer({ min: 0, max: 3 }),
      (n, vivasCrudas, desdeCrudo) => {
        const vivas = vivasCrudas.slice(0, n);
        // Al menos una nave viva, o la propiedad no tiene sentido (no hay
        // turno posible que dar).
        if (!vivas.some(Boolean)) vivas[0] = true;
        const ordenTurno = Array.from({ length: n }, (_, i) => i);
        const naves = ordenTurno.map((id) => ({ x: 0, integridad: vivas[id] ? 100 : 0 }));
        const desde = desdeCrudo % n;
        const estado: EstadoPartida = {
          version: 1,
          mundo: MUNDO,
          mascara: crearMascaraPlana(10, 10, 5),
          naves,
          ordenTurno,
          turno: desde,
          numeroTurno: 0,
          aleatorio: crearEstadoAleatorio(1),
          resultado: { tipo: "en-curso" },
        };

        const siguiente = siguienteTurno(estado, desde);
        const haySoloUnaViva = vivas.filter(Boolean).length === 1;
        if (haySoloUnaViva && naves[desde].integridad > 0) {
          // La única nave viva es la propia `desde`: no hay a quién pasar el
          // turno más que a sí misma.
          assert.equal(siguiente, desde);
        } else {
          // Invariante nucleo-n-naves-6: nunca se da turno a una nave
          // eliminada.
          assert.equal(naves[siguiente].integridad > 0, true, `siguienteTurno devolvió una nave eliminada (${siguiente})`);
        }
      },
    ),
    { numRuns: 200 },
  );
});

async function ficherosTypeScript(directorio: string): Promise<string[]> {
  const entradas = await readdir(directorio, { withFileTypes: true }).catch(() => []);
  const resultados: string[] = [];
  for (const entrada of entradas) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      resultados.push(...(await ficherosTypeScript(ruta)));
    } else if (entrada.name.endsWith(".ts") || entrada.name.endsWith(".tsx")) {
      resultados.push(ruta);
    }
  }
  return resultados;
}

test('nucleo-n-naves-2: "naveContraria" no queda en src/sim ni en src/juego -- de 2 a 4 naves ya no tiene "la otra"', async () => {
  const ficheros = [...(await ficherosTypeScript("src/sim")), ...(await ficherosTypeScript("src/juego")), ...(await ficherosTypeScript("src/debug"))];
  for (const fichero of ficheros) {
    const contenido = await readFile(fichero, "utf8");
    assert.equal(contenido.includes("naveContraria"), false, `${fichero} todavía referencia naveContraria`);
  }
});
