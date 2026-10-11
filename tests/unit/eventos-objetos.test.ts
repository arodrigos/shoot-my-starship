import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { colocarNaves } from "@/sim/naves/colocacion";
import { INTEGRIDAD_MAXIMA } from "@/sim/naves/vida";
import { crearMascaraVacia } from "@/sim/terreno/mascara";
import type { EstadoNave, EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { aplicarEvento, avanzarUniverso, conUniverso } from "@/sim/universo/efectos";
import {
  avanzarObjetos,
  MAX_OBJETOS_VIVOS,
  RONDAS_DE_VIDA_OBJETO,
  rutaPrevistaObjeto,
  VENTANA_PASOS_OBJETO,
  volarObjeto,
} from "@/sim/universo/objetos";
import type { EstadoUniverso, ObjetoEvento, TipoObjeto } from "@/sim/universo/tipos";

const MUNDO: ParametrosMundo = { ancho: 800, alto: 1000, gravedad: 0, deriva: 0, etiquetaDeriva: "" };

// Mundo vacío (sin planetas) y gravedad 0: la trayectoria es una recta, así que
// cada caso se razona a mano. Los de gravedad usan MUNDO con otro valor.
function estadoVacio(naves: readonly EstadoNave[], mundo: ParametrosMundo = MUNDO): EstadoPartida {
  return conUniverso({
    version: 1,
    mundo,
    mascara: crearMascaraVacia(mundo.ancho, mundo.alto),
    naves,
    ordenTurno: naves.map((_, id) => id),
    turno: 0,
    numeroTurno: 0,
    aleatorio: crearEstadoAleatorio(7),
    resultado: { tipo: "en-curso" },
    modo: "barra-libre",
  });
}

function nave(x: number, y: number, integridad = INTEGRIDAD_MAXIMA, extra: Partial<EstadoNave> = {}): EstadoNave {
  return { x, y, integridad, ...extra };
}

function objeto(tipo: TipoObjeto, x: number, y: number, vx: number, vy: number, turnosRestantes = 9): ObjetoEvento {
  return { id: 0, tipo, x, y, vx, vy, turnosRestantes };
}

function conObjetos(estado: EstadoPartida, objetos: readonly ObjetoEvento[]): EstadoPartida {
  return { ...estado, universo: { ...(estado.universo as EstadoUniverso), objetos } };
}

// Un objeto a 100 u/s hacia +x desde (100, 500) cruza el casco de una nave en (400, 500).
const HACIA_NAVE = objeto("corazon", 100, 500, 100, 0);

// obj-1: colisión unitaria del corazón, con el tope de la vida máxima.
test("obj-1: el corazón devuelve 75 de vida, con tope en 150, y desaparece", () => {
  for (const [antes, despues] of [
    [30, 105],
    [120, INTEGRIDAD_MAXIMA],
  ]) {
    const estado = conObjetos(estadoVacio([nave(400, 500, antes), nave(700, 900)]), [HACIA_NAVE]);
    const fase = avanzarObjetos(estado, estado.naves);
    assert.equal(fase.naves[0].integridad, despues);
    assert.deepEqual(fase.universo.objetos, []);
    assert.deepEqual(fase.eventos, [{ tipo: "objeto-alcanza", objeto: "corazon", nave: 0, cambio: despues - antes }]);
  }
});

// obj-2: el escudo no bloquea la tormenta.
test("obj-2: la tormenta quita 35 de vida aunque la nave tenga el escudo activo", () => {
  const estado = conObjetos(estadoVacio([nave(400, 500, INTEGRIDAD_MAXIMA, { escudoTurnosRestantes: 2 }), nave(700, 900)]), [{ ...HACIA_NAVE, tipo: "tormenta" }]);
  const fase = avanzarObjetos(estado, estado.naves);
  assert.equal(fase.naves[0].integridad, INTEGRIDAD_MAXIMA - 35);
  assert.equal(fase.naves[0].escudoTurnosRestantes, 2);
});

test("obj-1: un objeto que toca un planeta o sale del mundo desaparece sin tocar a nadie", () => {
  const base = estadoVacio([nave(400, 500, 30), nave(700, 900)]);
  const mascara = { ...base.mascara, datos: base.mascara.datos.slice() };
  // Un sólido entre el objeto y la nave.
  for (let dy = -10; dy <= 10; dy++) mascara.datos[(500 + dy) * mascara.ancho + 250] = 1;
  const choca = conObjetos({ ...base, mascara }, [HACIA_NAVE]);
  const trasPlaneta = avanzarObjetos(choca, choca.naves);
  assert.equal(trasPlaneta.naves[0].integridad, 30);
  assert.deepEqual(trasPlaneta.universo.objetos, []);

  const sale = conObjetos(base, [objeto("corazon", 100, 500, -100, 0)]);
  const trasSalir = avanzarObjetos(sale, sale.naves);
  assert.equal(trasSalir.naves[0].integridad, 30);
  assert.deepEqual(trasSalir.universo.objetos, []);
});

test("obj-1: sin tocar nada, el objeto avanza una ventana fija y pierde un turno de vida", () => {
  const estado = conObjetos(estadoVacio([nave(100, 900), nave(700, 900)]), [objeto("tormenta", 100, 100, 50, 0, 5)]);
  const fase = avanzarObjetos(estado, estado.naves);
  const [movido] = fase.universo.objetos as ObjetoEvento[];
  assert.equal(movido.turnosRestantes, 4);
  assert.ok(Math.abs(movido.x - (100 + (50 * VENTANA_PASOS_OBJETO) / 60)) < 1e-6);
});

// Invariante 1: la ruta que se dibuja para el turno siguiente es la que se
// recorre, y si la gravedad cambia entre medias se recalcula.
test("invariante: la ruta prevista coincide con la recorrida (≤ 0,5 u) con cualquier gravedad", () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0, max: 2, noNaN: true }),
      fc.double({ min: 50, max: 140, noNaN: true }),
      fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
      fc.double({ min: -20, max: 20, noNaN: true }),
      (gravedad, rapidez, angulo, deriva) => {
        const estado = conObjetos(estadoVacio([nave(150, 880), nave(650, 880)], { ...MUNDO, gravedad, deriva }), []);
        const semilla = objeto("corazon", 400, 300, rapidez * Math.cos(angulo), rapidez * Math.sin(angulo));
        const prevista = rutaPrevistaObjeto(estado, semilla);
        const recorrido = volarObjeto(estado, semilla);
        assert.equal(prevista.length, recorrido.ruta.length);
        prevista.forEach((punto, i) => {
          assert.ok(Math.hypot(punto.x - recorrido.ruta[i].x, punto.y - recorrido.ruta[i].y) <= 0.5);
        });
        // El último punto de la ruta es donde queda el objeto si sigue vivo.
        const ultimo = prevista[prevista.length - 1];
        assert.ok(Math.hypot(ultimo.x - recorrido.final.x, ultimo.y - recorrido.final.y) <= 0.5);
        // Con otra gravedad la ruta cambia: se recalcula desde el estado, no se cachea.
        if (gravedad > 0.2) {
          const otra = rutaPrevistaObjeto({ ...estado, mundo: { ...estado.mundo, gravedad: gravedad * 2 } }, semilla);
          assert.notDeepEqual(otra[otra.length - 1], ultimo);
        }
      },
    ),
    { numRuns: 60 },
  );
});

// Invariante 2: tope de 2 objetos y de 3 rondas, vengan de donde vengan.
test("invariante: nunca más de 2 objetos vivos ni más de 3 rondas, con calendario y armas gratis", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 0x7fffffff }), fc.array(fc.boolean(), { minLength: 12, maxLength: 30 }), (semilla, gratis) => {
      let estado: EstadoPartida = { ...estadoVacio([nave(150, 900), nave(650, 900), nave(150, 100), nave(650, 100)]), modo: "presupuesto", saldos: [1, 1, 1, 1] };
      estado = { ...estado, aleatorio: crearEstadoAleatorio(semilla) };
      const vivas = estado.naves.length;
      const nacidoEn = new Map<number, number>();
      gratis.forEach((armaGratis, turno) => {
        // Se fuerza un objeto en el calendario cada cierre para apretar el tope.
        const universo = estado.universo as EstadoUniverso;
        estado = { ...estado, universo: { ...universo, proximo: { enTurnos: 1, tipo: turno % 2 === 0 ? "corazon" : "tormenta", afectado: turno % vivas } } };
        // Mismo orden que el cierre real: primero vuelan los objetos, luego el universo.
        const fase = avanzarObjetos(estado, estado.naves);
        estado = avanzarUniverso({ ...estado, naves: fase.naves, universo: fase.universo }, { tirador: turno % vivas, armaGratis }).estado;
        const objetos = (estado.universo as EstadoUniverso).objetos ?? [];
        assert.ok(objetos.length <= MAX_OBJETOS_VIVOS);
        for (const vivo of objetos) {
          assert.ok(vivo.turnosRestantes <= RONDAS_DE_VIDA_OBJETO * vivas);
          if (!nacidoEn.has(vivo.id)) nacidoEn.set(vivo.id, turno);
          assert.ok(turno - (nacidoEn.get(vivo.id) as number) < RONDAS_DE_VIDA_OBJETO * vivas);
        }
      });
    }),
    { numRuns: 40 },
  );
});

test("obj-1: con 2 objetos vivos, un evento de objeto se anuncia perdido y no crea otro", () => {
  const dos = conObjetos(estadoVacio([nave(100, 900), nave(700, 900)]), [objeto("corazon", 100, 100, 1, 0), objeto("tormenta", 700, 100, 1, 0)]);
  const resultado = aplicarEvento(dos, { enTurnos: 0, tipo: "corazon", afectado: 0 }, "arma-gratis");
  assert.equal((resultado.estado.universo as EstadoUniverso).objetos?.length, 2);
  assert.deepEqual(resultado.eventos.map((evento) => evento.tipo === "evento-universo" && evento.perdido), [true]);
});

// Invariante 3: una colisión aplica el efecto una sola vez, aunque la ruta
// cruce dos veces el casco o haya dos naves en el camino.
test("invariante: el efecto de un choque se aplica una vez y el objeto desaparece en ese paso", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 1, max: INTEGRIDAD_MAXIMA }), fc.boolean(), (desvio, integridad, esCorazon) => {
      // La nave 0 es la silueta de caza: su ala sobresale 32 u del eje. Los
      // desvíos justo en el filo (32 u) se descartan; es el caso límite que
      // cubre casco-poligono.test.ts.
      fc.pre(desvio !== 32);
      const estado = conObjetos(estadoVacio([nave(400, 500 + desvio, integridad), nave(700, 900)]), [objeto(esCorazon ? "corazon" : "tormenta", 100, 500, 100, 0)]);
      const fase = avanzarObjetos(estado, estado.naves);
      const alcanzado = desvio < 32;
      assert.deepEqual(fase.universo.objetos, alcanzado ? [] : (fase.universo.objetos as ObjetoEvento[]));
      const esperado = alcanzado ? Math.min(INTEGRIDAD_MAXIMA, Math.max(0, integridad + (esCorazon ? 75 : -35))) : integridad;
      assert.equal(fase.naves[0].integridad, esperado);
      assert.equal(fase.eventos.length, alcanzado ? 1 : 0);
    }),
  );
});

test("obj-1: avanzar con el calendario crea el objeto con el tipo anunciado", () => {
  const estado = conObjetos(estadoVacio([nave(150, 900), nave(650, 900)]), []);
  const programado = { ...estado, universo: { ...(estado.universo as EstadoUniverso), proximo: { enTurnos: 1, tipo: "tormenta" as const, afectado: 1 } } };
  const resultado = avanzarUniverso(programado, { tirador: 0, armaGratis: false });
  const objetos = (resultado.estado.universo as EstadoUniverso).objetos ?? [];
  assert.equal(objetos.length, 1);
  assert.equal(objetos[0].tipo, "tormenta");
  assert.equal(objetos[0].turnosRestantes, RONDAS_DE_VIDA_OBJETO * 2);
});

test("la colocación de naves del sistema real no se ve afectada por el catálogo ampliado", () => {
  const { naves } = colocarNaves(31, MUNDO, crearEstadoAleatorio(31), 2, [false, false]);
  assert.equal(naves.length, 2);
});
