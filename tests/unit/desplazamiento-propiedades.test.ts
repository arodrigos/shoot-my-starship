import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { colocarNaves } from "@/sim/naves/colocacion";
import { distanciaMinimaDesplazamiento, octavoDelMundo, recolocarTrasImpacto } from "@/sim/naves/desplazamiento";
import { esPosicionValida } from "@/sim/naves/zonaValida";
import { avanzar } from "@/sim/partida/avanzar";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { MUNDO_ALTO, MUNDO_ANCHO } from "../utils/sistemaGenerado";

const MUNDO: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "" };
const EPS = 1e-6;
const SEMILLA_SISTEMA = 31;
const COLOCACION = colocarNaves(SEMILLA_SISTEMA, MUNDO, crearEstadoAleatorio(SEMILLA_SISTEMA), 2, [false, false]);
const ESTADO: EstadoPartida = {
  version: 1,
  mundo: MUNDO,
  mascara: COLOCACION.sistema.mascara,
  naves: COLOCACION.naves,
  ordenTurno: [0, 1],
  turno: 0,
  numeroTurno: 0,
  aleatorio: COLOCACION.aleatorio,
  resultado: { tipo: "en-curso" },
  planetas: COLOCACION.sistema.planetas,
};

// des-2 (invariantes 1 y 3): para toda semilla, radio y posición de partida, el
// destino es válido y está en [d_min, OCTAVO], salvo la reserva declarada, y
// la misma entrada da siempre el mismo destino.
test("des-2: el destino es válido, está en [d_min, octavo] y es determinista", () => {
  const otra = COLOCACION.naves[1];
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 0x7fffffff }),
      fc.double({ min: 0, max: 400, noNaN: true }),
      fc.constantFrom(0, 1),
      (semilla, radioEfectoU, indice) => {
        const yo = COLOCACION.naves[indice];
        const resto = [COLOCACION.naves[1 - indice]].map((nave) => ({ x: nave.x, y: nave.y as number }));
        const parametros = {
          desde: { x: yo.x, y: yo.y as number },
          mundo: MUNDO,
          mascara: ESTADO.mascara,
          otras: resto,
          radioEfectoU,
          aleatorio: crearEstadoAleatorio(semilla),
        };
        const a = recolocarTrasImpacto(parametros);
        assert.deepEqual(a, recolocarTrasImpacto(parametros), "misma entrada, mismo destino");

        const distancia = Math.hypot(a.x - parametros.desde.x, a.y - parametros.desde.y);
        const minima = distanciaMinimaDesplazamiento(MUNDO, radioEfectoU);
        if (a.reserva === "se-queda") {
          assert.equal(distancia, 0);
          return;
        }
        assert.ok(esPosicionValida(a, MUNDO, ESTADO.mascara, resto), "posición válida según zonaValida");
        assert.ok(distancia <= octavoDelMundo(MUNDO) + EPS, "nunca más lejos del octavo");
        if (a.reserva === "ninguna") assert.ok(distancia >= minima - EPS, "destino normal a ≥ d_min");
        assert.ok(otra !== undefined);
      },
    ),
    { numRuns: 500 },
  );
});

// des-2 (invariante 2): sin daño aplicado la nave no se mueve; con daño, el
// evento de desplazamiento es el único que cambia su posición.
test("des-2: solo se mueven las naves que pierden integridad", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...CATALOGO_ARMAS.map((arma) => arma.id)),
      fc.integer({ min: 1, max: 0x7fffffff }),
      fc.double({ min: 0, max: 360, noNaN: true }),
      fc.double({ min: 10, max: 100, noNaN: true }),
      (armaId, semilla, anguloGrados, potencia) => {
        const antes = { ...ESTADO, aleatorio: crearEstadoAleatorio(semilla) };
        // El Gravitón empuja por su propio efecto sin dañar: su movimiento no
        // es un desplazamiento por impacto y queda fuera de esta propiedad.
        if (CATALOGO_ARMAS.find((arma) => arma.id === armaId)?.efecto.tipo === "empuje") return;
        let despues;
        try {
          despues = avanzar(antes, { arma: armaId, anguloGrados, potencia, objetivoId: 1 });
        } catch {
          return; // arma de pago sin saldo u otra entrada que el núcleo rechaza
        }
        const movidas = new Set(despues.eventos.flatMap((e) => (e.tipo === "desplazamiento" ? [e.nave] : [])));
        despues.estado.naves.forEach((nave, id) => {
          const previa = antes.naves[id];
          if (nave.integridad >= previa.integridad) {
            assert.deepEqual({ x: nave.x, y: nave.y }, { x: previa.x, y: previa.y }, `la nave ${id} sin daño no se mueve`);
          }
          if (!movidas.has(id)) assert.deepEqual({ x: nave.x, y: nave.y }, { x: previa.x, y: previa.y });
        });
      },
    ),
    { numRuns: 300 },
  );
});
