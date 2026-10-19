import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { buscarArma } from "@/sim/armas/catalogo";
import { barridoRejilla, RANGO_ANGULOS_JUGADOR } from "@/sim/balistica/rejilla";
import { alcancePropulsores, volarConPropulsores } from "@/sim/equipo/propulsores";
import { colocarNaves, libreDeSolido } from "@/sim/naves/colocacion";
import { distanciaACasco } from "@/sim/naves/contacto";
import { avanzar } from "@/sim/partida/avanzar";
import type { EstadoPartida, ParametrosMundo } from "@/sim/partida/tipos";
import { crearMascaraVacia, esSolido, SOLIDO } from "@/sim/terreno/mascara";
import { esPosicionValida } from "@/sim/naves/zonaValida";
import { MUNDO_ALTO, MUNDO_ANCHO } from "../utils/sistemaGenerado";

const MUNDO: ParametrosMundo = { ancho: MUNDO_ANCHO, alto: MUNDO_ALTO, gravedad: 1, deriva: 0, etiquetaDeriva: "" };

function estadoParaSemilla(semilla: number, numNaves: 2 | 3 = 2): EstadoPartida {
  const colocacion = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), numNaves, numNaves === 2 ? [false, false] : [false, false, false]);
  return {
    version: 1,
    mundo: MUNDO,
    mascara: colocacion.sistema.mascara,
    naves: colocacion.naves,
    ordenTurno: numNaves === 2 ? [0, 1] : [0, 1, 2],
    turno: 0,
    numeroTurno: 0,
    aleatorio: colocacion.aleatorio,
    resultado: { tipo: "en-curso" },
    planetas: colocacion.sistema.planetas,
  };
}

function tiroQueAcierta(estado: EstadoPartida, armaId: string, objetivoId: number): { anguloGrados: number; potencia: number } | null {
  const candidatos = barridoRejilla({
    mascara: estado.mascara,
    ancho: MUNDO.ancho,
    alto: MUNDO.alto,
    planetas: estado.planetas,
    gravedad: MUNDO.gravedad,
    deriva: MUNDO.deriva,
    aleatorio: estado.aleatorio,
    arma: buscarArma(armaId),
    naves: estado.naves.map((nave, id) => ({ id, x: nave.x, y: nave.y as number })),
    tiradorId: 0,
    objetivoId,
    rangoAngulos: RANGO_ANGULOS_JUGADOR,
    presupuestoIntentos: 120,
  });
  return candidatos.length === 0 ? null : { anguloGrados: candidatos[0].anguloGrados, potencia: candidatos[0].potencia };
}

// El asentamiento de naves-nunca-dentro no es un desplazamiento: si la posición
// inicial ya era inválida, la nave se mueve al sitio válido más cercano y eso
// no cuenta como empuje.
function posicionSinEmpuje(inicial: EstadoPartida, eventos: readonly { tipo: string }[], id: number): { x: number; y: number } {
  const asentada = eventos.find((e) => e.tipo === "nave-asentada" && (e as { nave?: number }).nave === id) as { x: number; y: number } | undefined;
  return asentada ?? { x: inicial.naves[id].x, y: inicial.naves[id].y as number };
}

// Hasta qué semilla se busca un escenario que sirva al caso (determinista).
const SEMILLAS_BUSQUEDA = 60;

// BUG 4/8 (mov-1): el tirador no se recoloca por su propio disparo. Despedida
// le resta integridad siempre (autodaño), y antes eso bastaba para desplazarlo.
test("mov-1 (bug 4, 8): con Despedida el tirador no se desplaza y el rival dañado sí", () => {
  let comprobadas = 0;
  for (let semilla = 1; semilla <= SEMILLAS_BUSQUEDA && comprobadas < 5; semilla++) {
    const inicial = estadoParaSemilla(semilla);
    const tiro = tiroQueAcierta(inicial, "despedida", 1);
    if (tiro === null) continue;
    const { estado, eventos } = avanzar(inicial, { arma: "despedida", ...tiro, objetivoId: 1 });
    if (estado.naves[1].integridad >= inicial.naves[1].integridad) continue;
    assert.ok(estado.naves[0].integridad < inicial.naves[0].integridad, `semilla ${semilla}: Despedida se hace autodaño`);
    assert.deepEqual(
      { x: estado.naves[0].x, y: estado.naves[0].y },
      { x: inicial.naves[0].x, y: inicial.naves[0].y },
      `semilla ${semilla}: el tirador no se mueve`,
    );
    assert.equal(eventos.some((e) => e.tipo === "desplazamiento" && e.nave === 0), false, `semilla ${semilla}: sin desplazamiento del tirador`);
    assert.ok(eventos.some((e) => e.tipo === "desplazamiento" && e.nave === 1), `semilla ${semilla}: el rival dañado sí se desplaza`);
    comprobadas++;
  }
  assert.ok(comprobadas >= 1, "al menos un escenario con acierto");
});

// Invariante: para cualquier disparo, ningún desplazamiento es del tirador, y
// toda otra nave que pierde integridad se desplaza exactamente una vez.
test("mov-1/mov-6 invariante: el tirador nunca se desplaza y toda otra nave dañada tiene un desplazamiento", () => {
  const armas = ["pepinazo-cortesia", "despedida", "racimo-de-tuppers", "pelota-de-chatarra"];
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 40 }),
      fc.constantFrom(...armas),
      fc.integer({ min: 0, max: 180 }),
      fc.integer({ min: 20, max: 100 }),
      fc.constantFrom<2 | 3>(2, 3),
      (semilla, arma, anguloGrados, potencia, numNaves) => {
        const inicial = estadoParaSemilla(semilla, numNaves);
        const { estado, eventos } = avanzar(inicial, { arma, anguloGrados, potencia, objetivoId: 1 });
        assert.equal(eventos.some((e) => e.tipo === "desplazamiento" && e.nave === 0), false, "el tirador no se desplaza");
        estado.naves.forEach((nave, id) => {
          if (id === 0 || inicial.naves[id].integridad <= nave.integridad || nave.integridad <= 0) return;
          const cuantos = eventos.filter((e) => e.tipo === "desplazamiento" && e.nave === id).length;
          assert.equal(cuantos, 1, `nave ${id} dañada → un desplazamiento`);
        });
      },
    ),
    { numRuns: 25 },
  );
});

// BUG 9 (mov-2, mov-7): el Gravitón solo empuja si alcanza. Mundo vacío y sin
// gravedad: el tiro recto a 0° da al rival y los demás ángulos pasan lejos.
function estadoRecto(): EstadoPartida {
  // Un suelo lejos del rival: el Gravitón que cae ahí detona en un sólido,
  // que es justo el caso en que antes empujaba sin alcanzar a nadie.
  const mascara = crearMascaraVacia(MUNDO.ancho, MUNDO.alto);
  mascara.datos.fill(SOLIDO, 850 * MUNDO.ancho);
  return {
    version: 1,
    mundo: { ...MUNDO, gravedad: 0 },
    mascara,
    naves: [
      { x: 300, y: 500, integridad: 100 },
      { x: 800, y: 500, integridad: 100 },
    ],
    ordenTurno: [0, 1],
    turno: 0,
    numeroTurno: 0,
    aleatorio: crearEstadoAleatorio(3),
    resultado: { tipo: "en-curso" },
  };
}

test("mov-7 (bug 9): un Gravitón que pasa lejos del rival no lo mueve", () => {
  for (const anguloGrados of [-30, -45, -60]) {
    const inicial = estadoRecto();
    const { estado, eventos } = avanzar(inicial, { arma: "graviton-segunda-mano", anguloGrados, potencia: 100, objetivoId: 1 });
    const impacto = eventos.find((e) => e.tipo === "impacto");
    assert.equal(impacto?.tipo, "impacto", `${anguloGrados}°: detona contra el suelo`);
    if (impacto?.tipo === "impacto") {
      assert.ok(distanciaACasco(impacto.x, impacto.y, { id: 1, x: 800, y: 500, integridad: 100 }) > 50, "el tiro cae lejos del casco");
      assert.equal(impacto.desplazamientoPx, undefined);
    }
    assert.deepEqual({ x: estado.naves[1].x, y: estado.naves[1].y }, { x: 800, y: 500 }, `${anguloGrados}°: el rival no se mueve`);
    assert.equal(eventos.some((e) => e.tipo === "desplazamiento"), false);
  }
});

test("mov-2: un Gravitón que da en el casco del rival sí lo empuja", () => {
  // -3°: la boca del cañón sale algo por encima del centro de la nave.
  const { estado, eventos } = avanzar(estadoRecto(), { arma: "graviton-segunda-mano", anguloGrados: -3, potencia: 100, objetivoId: 1 });
  const impacto = eventos.find((e) => e.tipo === "impacto");
  assert.ok(impacto?.tipo === "impacto" && impacto.desplazamientoPx !== undefined && impacto.desplazamientoPx !== 0, "el impacto declara empuje");
  assert.notEqual(estado.naves[1].x, 800);
});

// Invariante de mov-2: aunque el tiro sea cualquiera, si el punto de impacto
// queda lejos del casco del rival no hay empuje.
test("mov-2 invariante: un Gravitón solo declara empuje si su punto de impacto alcanza el casco", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 0, max: 180 }), fc.integer({ min: 20, max: 100 }), (semilla, anguloGrados, potencia) => {
      const inicial = estadoParaSemilla(semilla);
      const { estado, eventos } = avanzar(inicial, { arma: "graviton-segunda-mano", anguloGrados, potencia, objetivoId: 1 });
      const impacto = eventos.find((e) => e.tipo === "impacto");
      const empuja = impacto?.tipo === "impacto" && impacto.desplazamientoPx !== undefined && impacto.desplazamientoPx !== 0;
      if (!empuja) {
        assert.equal(estado.naves[1].x, posicionSinEmpuje(inicial, eventos, 1).x, "sin alcance, el rival conserva su x");
        return;
      }
      if (impacto?.tipo === "impacto") {
        const distancia = distanciaACasco(impacto.x, impacto.y, { id: 1, x: inicial.naves[1].x, y: inicial.naves[1].y as number, integridad: inicial.naves[1].integridad });
        assert.ok(distancia <= 1 || impacto.impactoNave === 1, `empuja con distancia ${distancia}`);
      }
    }),
    { numRuns: 25 },
  );
});

// mov-6: minirobot ajeno desplaza, minirobot propio no.
function estadoConRobot(dueno: 0 | 1, objetivoId: 0 | 1): EstadoPartida {
  return {
    version: 1,
    mundo: MUNDO,
    mascara: crearMascaraVacia(MUNDO.ancho, MUNDO.alto),
    naves: [
      { x: 600, y: 700, integridad: 100 },
      { x: 660, y: 700, integridad: 100 },
    ],
    ordenTurno: [0, 1],
    turno: dueno === 0 ? 1 : 0,
    numeroTurno: 0,
    aleatorio: crearEstadoAleatorio(7),
    resultado: { tipo: "en-curso" },
    robots: [{ dueno, objetivoId, armaId: "minirobot-saltaplanetas", planetaId: 0, x: 630, y: 700, saltos: 0 }],
  };
}

test("mov-6: la nave dañada por un minirobot de otro jugador se desplaza; por el propio, no", () => {
  // El robot de 0 detona al empezar el turno de 0 (tras disparar 1) sobre la nave 1.
  const ajeno = avanzar(estadoConRobot(0, 1), { arma: "pepinazo-cortesia", anguloGrados: 90, potencia: 100, objetivoId: 0 });
  assert.ok(ajeno.estado.naves[1].integridad < 100, "el robot de 0 daña a la 1");
  assert.ok(ajeno.eventos.some((e) => e.tipo === "desplazamiento" && e.nave === 1), "daño de robot ajeno → desplazamiento");

  // El robot de 1 detona sobre la nave 0 y el área alcanza a su propia dueña.
  const propio = avanzar(estadoConRobot(1, 0), { arma: "pepinazo-cortesia", anguloGrados: 90, potencia: 100, objetivoId: 1 });
  assert.ok(propio.estado.naves[1].integridad < 100, "la dueña también recibe el área de su robot");
  assert.equal(propio.eventos.some((e) => e.tipo === "desplazamiento" && e.nave === 1), false, "su propio robot no la desplaza");
  assert.ok(propio.eventos.some((e) => e.tipo === "desplazamiento" && e.nave === 0), "la nave objetivo del robot sí");
});

// BUG 6 (mov-4): una nave posada sale hacia fuera de la superficie.
test("mov-4 (bug 6): una nave posada en un planeta que apunta fuera de la superficie se mueve ≥ 40 u", () => {
  let medidos = 0;
  for (let semilla = 1; semilla <= 25; semilla++) {
    const colocacion = colocarNaves(semilla, MUNDO, crearEstadoAleatorio(semilla), 2, [false, false]);
    for (const planeta of colocacion.sistema.planetas) {
      for (const grados of [0, 90, 180, 270]) {
        const t = (grados * Math.PI) / 180;
        let punto: { x: number; y: number } | null = null;
        for (let d = planeta.radio; d < planeta.radio + 80; d += 0.5) {
          const q = { x: planeta.cx + d * Math.cos(t), y: planeta.cy + d * Math.sin(t) };
          if (esPosicionValida(q, MUNDO, colocacion.sistema.mascara, [])) {
            punto = q;
            break;
          }
        }
        // Lejos de los bordes: ahí el margen del mundo también corta, y no es la superficie.
        if (punto === null || punto.x < 150 || punto.x > MUNDO.ancho - 150 || punto.y < 150 || punto.y > MUNDO.alto - 500) continue;
        // Solo superficies regulares: si el sólido del entorno no está a la espalda
        // del radio (otro cuerpo cerca, cráter), el rumbo radial no es «hacia fuera».
        let sx = 0;
        let sy = 0;
        for (let dy = -60; dy <= 60; dy++) {
          for (let dx = -60; dx <= 60; dx++) {
            if (dx * dx + dy * dy <= 3600 && esSolido(colocacion.sistema.mascara, Math.round(punto.x) + dx, Math.round(punto.y) + dy)) {
              sx += dx;
              sy += dy;
            }
          }
        }
        const largo = Math.hypot(sx, sy);
        if (largo === 0 || (-sx / largo) * Math.cos(t) + (-sy / largo) * Math.sin(t) < Math.cos((20 * Math.PI) / 180)) continue;
        // Y sin otro cuerpo en la trayectoria inmediata: eso es un obstáculo de verdad.
        let despejado = true;
        for (let avance = 4; avance <= 120; avance += 4) {
          if (!libreDeSolido(colocacion.sistema.mascara, punto.x + avance * Math.cos(t), punto.y + avance * Math.sin(t), 10)) despejado = false;
        }
        if (!despejado) continue;
        const angulo = (Math.atan2(-Math.sin(t), Math.cos(t)) * 180) / Math.PI;
        const vuelo = volarConPropulsores({ desde: punto, anguloGrados: angulo, potencia: 60, mundo: MUNDO, mascara: colocacion.sistema.mascara, planetas: colocacion.sistema.planetas, otras: [] });
        medidos++;
        // Salida (no caída): se exige que la ruta pase de los primeros pasos y salga de la franja de contacto.
        const maxima = Math.max(...vuelo.ruta.map((p) => Math.hypot(p.x - punto.x, p.y - punto.y)));
        assert.ok(vuelo.ruta.length > 8 || maxima >= 40, `semilla ${semilla} planeta ${planeta.id} ${grados}°: ruta de ${vuelo.ruta.length} puntos, alejamiento máximo ${maxima.toFixed(1)}`);
      }
    }
  }
  assert.ok(medidos > 100, `muestra suficiente (${medidos})`);
});

test("mov-4: en pleno espacio vuela hasta el alcance", () => {
  const vuelo = volarConPropulsores({ desde: { x: 400, y: 400 }, anguloGrados: 0, potencia: 60, mundo: { ...MUNDO, gravedad: 0 }, mascara: crearMascaraVacia(MUNDO.ancho, MUNDO.alto), otras: [] });
  assert.equal(vuelo.motivo, "alcance");
  assert.ok(Math.abs(Math.hypot(vuelo.destino.x - 400, vuelo.destino.y - 400) - alcancePropulsores(MUNDO)) < 1);
});
