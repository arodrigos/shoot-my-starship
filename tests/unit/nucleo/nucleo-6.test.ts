import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { crearPartidaInicial, jugarPartida, jugarTurno } from "@/sim/partida/motor";
import { deserializarEstado, serializarEstado } from "@/sim/partida/serializacion";
import type { EntradaDeTurno, EstadoPartida, FuenteDeTurno } from "@/sim/partida/tipos";
import { aplicarHuellaCircular } from "@/sim/terreno/huella";
import { contarPixelesPorMaterial, type Planeta } from "@/sim/gravedad/planetas";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const MUNDO = { ancho: 1920, alto: 1080, gravedad: 1.0, deriva: 0, etiquetaDeriva: "prueba" };
const LIMITE_TURNOS = 300;

// "Humano": en el juego real esta función espera un evento de UI; aquí
// simula la misma forma de interfaz con una cola fija de entradas. A
// jugarPartida no le importa de dónde viene la entrada, solo que la función
// tenga la forma FuenteDeTurno -- eso es justo lo que nucleo-6 comprueba.
function fuenteHumanoSimulado(cola: readonly EntradaDeTurno[]): FuenteDeTurno {
  let indice = 0;
  return (estado) => {
    const entrada = cola[indice % cola.length];
    indice++;
    return { entrada, estado };
  };
}

// "Máquina": decide en el momento a partir del estado en vez de leer una
// cola, como hará ia-personalidades más adelante. Ángulo y potencia caen a
// ~15px de la nave contraria dada la distancia entre 300 y 1620.
const fuenteMaquina: FuenteDeTurno = (estado) => ({
  entrada: { arma: "pepinazo-cortesia", anguloGrados: estado.turno === 0 ? 45 : 135, potencia: 60 },
  estado,
});

function fuenteScriptada(guion: readonly EntradaDeTurno[]): FuenteDeTurno {
  let indice = 0;
  return (estado) => {
    const entrada = guion[indice % guion.length];
    indice++;
    return { entrada, estado };
  };
}

function jugarNTurnos(
  estadoInicial: EstadoPartida,
  fuentes: readonly [FuenteDeTurno, FuenteDeTurno],
  n: number,
  recargarTrasCadaTurno: boolean,
): EstadoPartida {
  let actual = estadoInicial;
  for (let i = 0; i < n; i++) {
    if (actual.resultado.tipo !== "en-curso") break;
    actual = jugarTurno(actual, fuentes).estado;
    if (recargarTrasCadaTurno) {
      // Guarda y recarga TRAS CADA TURNO, no solo una vez a mitad de
      // partida (como nucleo-2): si el registro de planetas viviera en un
      // caché a nivel de módulo en vez de viajar dentro del propio estado,
      // esto lo delataría en la primera vuelta, no solo al final.
      actual = deserializarEstado(serializarEstado(actual));
    }
  }
  return actual;
}

function hashDeEstado(estado: EstadoPartida): string {
  return createHash("sha256").update(JSON.stringify(estado)).digest("hex");
}

test("nucleo-6: FuenteDeTurno soporta humano-vs-máquina, máquina-vs-máquina y dos scriptadas sin tocar el núcleo", () => {
  // Raíces "de lobo alto" del solucionador balístico exacto para 300->1620
  // sobre suelo plano (no las de trayectoria rasante: esas rozan el suelo
  // cerca del cañón y su alcance real es muy sensible al desfase de altura
  // del cañón, así que "exactas" en la fórmula no significa precisas aquí).
  // Con daño real en cada impacto, cada nave cráteriza el suelo bajo la
  // otra -- y por tanto bajo sí misma la próxima vez que dispare desde ahí,
  // porque origenY se lee de su propia posición en el momento del disparo.
  // Un guion fijo con ángulos "razonables a ojo" converge en la práctica a
  // un punto muerto (cada nave falla sistemáticamente su propio blanco en
  // cuanto el cráter le cambia la altura de lanzamiento). Estas dos raíces
  // caen a menos de 1px del centro exacto, lo que da mucho más margen antes
  // de que la deriva del terreno las saque del radio de daño.
  const colaHumano: EntradaDeTurno[] = [
    { arma: "pepinazo-cortesia", anguloGrados: 76.0, potencia: 100 },
    { arma: "pepinazo-cortesia", anguloGrados: 69.3, potencia: 80 },
  ];
  // Espejo de colaHumano (180 - ángulo) para disparar desde x=1620 hacia
  // x=300: el mismo guion no sirve para las dos naves porque no apuntan al
  // mismo sitio, no porque FuenteDeTurno lo exija.
  const colaHumanoEspejo: EntradaDeTurno[] = colaHumano.map((entrada) => ({
    ...entrada,
    anguloGrados: 180 - entrada.anguloGrados,
  }));

  const combinaciones: [string, [FuenteDeTurno, FuenteDeTurno]][] = [
    ["humano-vs-máquina", [fuenteHumanoSimulado(colaHumano), fuenteMaquina]],
    ["máquina-vs-máquina", [fuenteMaquina, fuenteMaquina]],
    ["dos scriptadas", [fuenteScriptada(colaHumano), fuenteScriptada(colaHumanoEspejo)]],
  ];

  const mascara = crearMascaraPlana(MUNDO.ancho, MUNDO.alto, 900);
  for (const [nombre, fuentes] of combinaciones) {
    const inicial = crearPartidaInicial(MUNDO, mascara, 300, 1620, 4242);
    const { estado, agotada } = jugarPartida(inicial, fuentes, LIMITE_TURNOS);
    assert.equal(agotada, false, `${nombre}: la partida no convergió en ${LIMITE_TURNOS} turnos`);
    assert.equal(estado.resultado.tipo, "terminada", `${nombre}: no terminó con un ganador`);
  }
});

test("grav-9: una partida de 30 turnos con planetas da la misma secuencia de estados guardando y recargando en cada turno", () => {
  // El planeta se planta bajo el centro del campo, cubriendo terreno que
  // varios disparos de un guion "en abanico" van a cruzar tarde o temprano
  // -- el punto es que su masa CAMBIE entre turnos, no que quede intacto:
  // un caché a nivel de módulo que congelara pixelesVivos pasaría
  // desapercibido con un planeta que nunca recibe un impacto.
  const mascara = crearMascaraPlana(MUNDO.ancho, MUNDO.alto, 900);
  aplicarHuellaCircular(mascara, 960, 850, 150, "sumar", 2);
  const pixelesVivosIniciales = contarPixelesPorMaterial(mascara).get(2) ?? 0;
  const planetaInicial: Planeta = { id: 2, cx: 960, cy: 850, radio: 150, densidad: 1, pixelesVivos: pixelesVivosIniciales };

  // 15 entradas por nave (30 turnos / 2 naves), en abanico de ángulo y
  // potencia para que las caídas se repartan por todo el campo en vez de
  // converger siempre al mismo punto muerto.
  const GUION_A: EntradaDeTurno[] = Array.from({ length: 15 }, (_, i) => ({
    arma: "pepinazo-cortesia",
    anguloGrados: 30 + (i % 7) * 6,
    potencia: 60 + (i % 5) * 8,
  }));
  const GUION_B: EntradaDeTurno[] = GUION_A.map((entrada) => ({ ...entrada, anguloGrados: 180 - entrada.anguloGrados }));

  const inicialA = crearPartidaInicial(MUNDO, mascara, 300, 1620, 24680, [planetaInicial]);
  const finalIninterrumpido = jugarNTurnos(inicialA, [fuenteScriptada(GUION_A), fuenteScriptada(GUION_B)], 30, false);

  const inicialB = crearPartidaInicial(MUNDO, mascara, 300, 1620, 24680, [planetaInicial]);
  const finalConRecarga = jugarNTurnos(inicialB, [fuenteScriptada(GUION_A), fuenteScriptada(GUION_B)], 30, true);

  assert.equal(hashDeEstado(finalConRecarga), hashDeEstado(finalIninterrumpido));
  assert.ok(finalIninterrumpido.planetas, "el registro de planetas debe seguir presente tras 30 turnos");
  assert.ok(
    finalIninterrumpido.planetas![0].pixelesVivos < planetaInicial.pixelesVivos,
    "algún disparo de los 30 turnos debió erosionar el planeta -- si no, este test no comprueba nada sobre su masa",
  );
});
