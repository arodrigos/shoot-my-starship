import "../../entorno-phaser.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import type Phaser from "phaser";
import { AnimadorProyectil } from "@/juego/vuelo/AnimadorProyectil";
import { detenerseEnSuelo, ALTURA_CANON_PX } from "@/sim/armas/resolver";
import { simularVuelo } from "@/sim/fisica/vuelo";
import { pasosDeMecha, esComportamientoAdherente } from "@/sim/fisica/comportamientoExtendido";
import { crearProyectil, type EstadoProyectil } from "@/sim/fisica/proyectil";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { velocidadDesdePotencia } from "@/sim/balistica/potencia";
import { buscarArma } from "@/sim/armas/catalogo";
import { crearPartidaInicial } from "@/sim/partida/motor";
import { avanzar } from "@/sim/partida/avanzar";
import { crearMascaraPlana } from "../../utils/terrenoPlano";
import type { ParametrosMundo } from "@/sim/partida/tipos";

// Mismo doble de escena que gra-4.test.ts: AnimadorProyectil solo necesita
// que this.add.graphics() devuelva algo encadenable con los métodos que de
// verdad llama.
function crearEscenaDeMentira(): Phaser.Scene {
  const grafico = {
    clear: () => grafico,
    fillStyle: () => grafico,
    fillPoints: () => grafico,
    setVisible: () => grafico,
    setDepth: () => grafico,
    setPosition: () => grafico,
    setRotation: () => grafico,
  };
  return { add: { graphics: () => grafico } } as unknown as Phaser.Scene;
}

const ANCHO = 1920;
const ALTO = 1080;
const ALTURA_SUELO = 900;
const GRAVEDAD = 1;
const MINA = buscarArma("gancho-pegajoso");
if (!esComportamientoAdherente(MINA.comportamiento)) {
  throw new Error("min-4: el fixture asume que gancho-pegajoso es adherente-con-mecha");
}
const PASOS_HASTA_DETONAR =
  MINA.comportamiento.tipo === "adherente-con-mecha" ? pasosDeMecha(MINA.comportamiento.segundosHastaDetonar) : 0;

function inicialLofted(): EstadoProyectil {
  const [solucion] = resolverSolucionesBalisticas(300, ALTURA_SUELO, 900, ALTURA_SUELO, GRAVEDAD);
  const rad = (solucion.anguloGrados * Math.PI) / 180;
  const v = velocidadDesdePotencia(solucion.potencia);
  return crearProyectil(300, ALTURA_SUELO - ALTURA_CANON_PX, v * Math.cos(rad), -v * Math.sin(rad));
}

// Corre el animador hasta que detona (o agota un tope generoso de
// fotogramas), avanzando `deltaMs` por llamada -- deltaMs distinto simula
// una animación más rápida o más lenta/entrecortada sin tocar el núcleo.
function animarHastaDetonar(deltaMs: number): EstadoProyectil {
  const inicial = inicialLofted();
  const detenerse = detenerseEnSuelo(crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO), ANCHO, ALTO);
  const animador = new AnimadorProyectil(crearEscenaDeMentira());
  let final: EstadoProyectil | null = null;
  animador.iniciar(
    inicial,
    GRAVEDAD,
    0,
    detenerse,
    (f) => (final = f),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    PASOS_HASTA_DETONAR,
  );
  for (let i = 0; i < 200_000 && animador.enVuelo(); i++) {
    animador.actualizar(deltaMs);
  }
  assert.ok(final !== null, `la animación con deltaMs=${deltaMs} no terminó`);
  return final!;
}

// min-4 (camino crítico): el tiempo de la mina es del núcleo -- resolviendo
// el mismo disparo SIN ninguna animación (resolverDisparo directamente)
// tiene que dar el mismo punto de adherencia que la animación del cliente, a
// cualquier velocidad de fotograma.
test("min-4: el punto de adherencia animado coincide con el resuelto por el núcleo sin animación", () => {
  // La rama "adherente-con-mecha" del resolver (ver resolver.ts) es,
  // físicamente, la MISMA parada que impacto-simple: simularVuelo con
  // detenerseEnSuelo, sin más. Se compara contra eso directamente (en vez de
  // contra resolverDisparo, que recalcula origenY con alturaSuperficie() y
  // puede diferir en 1px del ALTURA_SUELO fijo de este fixture) -- mismo
  // patrón que gra-4.test.ts para la granada.
  const inicial = inicialLofted();
  const detenerse = detenerseEnSuelo(crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO), ANCHO, ALTO);
  const resuelto = simularVuelo(inicial, GRAVEDAD, 0, detenerse);

  const animado60fps = animarHastaDetonar(1000 / 60);
  assert.equal(animado60fps.x, resuelto.proyectil.x);
  assert.equal(animado60fps.y, resuelto.proyectil.y);
});

// min-4 (camino crítico): cambiar la velocidad de animación (fotogramas
// grandes que agrupan muchos pasos fijos por llamada, o pequeños que dan uno
// cada vez) no puede cambiar el punto de adherencia -- si cambiara, el reloj
// de la mina dependería del framerate, justo lo que este criterio prohíbe.
// Mismo patrón que gra-4 para la espoleta de la granada.
test("min-4: acelerar o pausar la animación (deltaMs distinto) no cambia el punto de adherencia", () => {
  const rapida = animarHastaDetonar(1000 / 6); // ~10 pasos fijos agrupados por llamada
  const lenta = animarHastaDetonar(1000 / 240); // menos de un paso fijo por llamada
  const normal = animarHastaDetonar(1000 / 60); // un paso fijo por llamada

  assert.equal(rapida.x, normal.x);
  assert.equal(rapida.y, normal.y);
  assert.equal(lenta.x, normal.x);
  assert.equal(lenta.y, normal.y);
});

// min-4 (camino crítico): "al terminar el turno no queda ninguna mina viva
// en el estado de partida" -- EstadoPartida (tipos.ts) no declara NINGÚN
// campo de proyectiles o minas en vuelo: avanzar() resuelve el disparo
// entero (vuelo, adherencia y detonación) en la misma llamada síncrona que
// cualquier otra arma, así que no hay ningún estado intermedio que limpiar
// ni que pueda filtrarse al turno siguiente. Se demuestra disparando la
// mina DOS turnos seguidos sin ningún paso de limpieza entre medias: si
// quedara algo vivo, el segundo avanzar() lo heredaría o fallaría.
test("min-4: avanzar() resuelve la mina de un turno a otro sin dejar ningún estado de proyectil suelto entre medias", () => {
  const mundo: ParametrosMundo = { ancho: ANCHO, alto: ALTO, gravedad: GRAVEDAD, deriva: 0, etiquetaDeriva: "min-4" };
  const mascara = crearMascaraPlana(ANCHO, ALTO, ALTURA_SUELO);
  const naveX0 = 300;
  const naveX1 = 900;
  const estadoInicial = crearPartidaInicial(mundo, mascara, [naveX0, naveX1], 7);

  const [solucion0] = resolverSolucionesBalisticas(naveX0, ALTURA_SUELO, naveX1, ALTURA_SUELO, GRAVEDAD);
  const primerTurno = avanzar(estadoInicial, {
    arma: MINA.id,
    anguloGrados: solucion0.anguloGrados,
    potencia: solucion0.potencia,
    objetivoId: 1,
  });

  // El único estado que EstadoPartida permite persistir entre turnos son
  // naves/mascara/turno/numeroTurno/aleatorio/resultado(/planetas/modo/saldo)
  // -- ninguno de ellos es "un proyectil en vuelo" o "una mina pendiente".
  assert.equal(primerTurno.estado.numeroTurno, estadoInicial.numeroTurno + 1);
  assert.equal(primerTurno.estado.turno, 1, "el turno pasa a la otra nave, la mina ya quedó resuelta del todo");

  // Segundo turno, disparado por la otra nave, inmediatamente después y sin
  // ningún paso de limpieza: si algo de la mina anterior hubiera quedado
  // vivo, este segundo avanzar() heredaría un estado inconsistente o
  // lanzaría.
  const [solucion1] = resolverSolucionesBalisticas(naveX1, ALTURA_SUELO, naveX0, ALTURA_SUELO, GRAVEDAD);
  assert.doesNotThrow(() => {
    const segundoTurno = avanzar(primerTurno.estado, {
      arma: MINA.id,
      anguloGrados: solucion1.anguloGrados,
      potencia: solucion1.potencia,
      objetivoId: 0,
    });
    assert.equal(segundoTurno.estado.numeroTurno, primerTurno.estado.numeroTurno + 1);
  });
});
