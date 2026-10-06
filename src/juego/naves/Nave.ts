import Phaser from "phaser";
import { ALTO_CASCO, ANCHO_CASCO, LARGO_CANON } from "@/sim/naves/geometriaCasco";
import { RADIO_CASCO_NAVE_PX } from "@/sim/naves/impacto";
import { OPACIDAD_NUCLEO, TECHO_OPACIDAD_FUERA_NUCLEO } from "@/juego/naves/opacidadCasco";
import { anclaTobera, hashPuntos, nivelDanio, puntosCascoConDanio, type NivelDanio } from "@/juego/naves/formaCasco";
import { DURACION_DESTELLO_DANIO_MS } from "@/juego/efectos/realceImpacto";
import { puntosSenaNave } from "@/juego/naves/senaNave";
import type { VarianteNave } from "@/sim/naves/geometriaCasco";
import { COLORES_NAVE } from "@/juego/naves/paletaNaves";
import type { IdNave } from "@/sim/partida/tipos";

const COLOR_CASCO_SOMBRA = 0x1c1e24;
const COLOR_PATAS = 0x3a3d46;
const COLOR_CANON = 0xd9dbe0;
const COLOR_CABINA = 0xd6f4ff;
const COLOR_TOBERA_SANA = 0xffb347;
const COLOR_TOBERA_CRITICA = 0x8a4a2c;
const COLOR_CICATRIZ = 0x0c0d10;
// arte-siluetas-4: blanco sobre el fuselaje coloreado -- el contraste de
// luminosidad (no de tono) es lo que hace que la seña siga leyéndose en
// escala de grises, donde dos colores saturados distintos pueden caer en
// el mismo gris.
const COLOR_SENA = 0xffffff;
// arte-siluetas-3: amarillo de aviso, igual en las cuatro naves -- el
// indicador dice "a quién le toca", no "de quién es", así que no compite
// con el color propio de cada nave ni con la seña de forma.
const COLOR_INDICADOR_ACTIVA = 0xffd23f;
// realce-impacto (rlc-2): rojo, sobre TODA la silueta -- claramente distinto
// del destello blanco de contacto honesto (solo el núcleo, intensidad fija)
// y del chispazo naranja del roce (partículas en el punto de contacto, no
// sobre la nave), para que la diferencia entre "tocó y dolió" y cualquier
// otro contacto se perciba sin leer ningún texto.
const COLOR_DESTELLO_DANIO = 0xff3b30;

// nve-1: opacidad de la tobera por tramo de daño -- la llama se apaga
// visiblemente a medida que la nave pierde integridad, sin superar nunca el
// techo de opacidad de fuera del núcleo (esc-5): es luz de motor, no
// blindaje, pero se respeta el mismo límite para no abrir una segunda
// forma de "parecer más sólida de lo que es".
const OPACIDAD_TOBERA: Readonly<Record<NivelDanio, number>> = {
  alta: TECHO_OPACIDAD_FUERA_NUCLEO,
  media: TECHO_OPACIDAD_FUERA_NUCLEO * 0.6,
  baja: TECHO_OPACIDAD_FUERA_NUCLEO * 0.25,
};

// Nave varada vectorial (silueta, patas y cañón torcido): nada de sprites
// bitmap, para que cambiar de paleta o de forma sea cambiar números, no
// encargar arte. El "torcido" es la forma del cañón (dos tramos con un
// quiebro), no su puntería -- eso lo decide anguloGrados.
const COLOR_ESCUDO = 0x7fd7ff;
// Por encima del casco dibujado (≈ 66 u de diámetro mayor) para que el anillo
// no tape la silueta.
const RADIO_ESCUDO_U = 50;

export class Nave {
  private readonly contenedor: Phaser.GameObjects.Container;
  private readonly casco: Phaser.GameObjects.Graphics;
  private readonly canon: Phaser.GameObjects.Graphics;
  private readonly indicadorActiva: Phaser.GameObjects.Graphics;
  private anguloActualGrados: number;
  private readonly colorCasco: number;
  private readonly direccion: 1 | -1;
  private readonly variante: VarianteNave;
  private activa = false;
  // con-4: si el núcleo real (RADIO_CASCO_NAVE_PX) lleva su anillo de
  // realce encima -- lo activa ControlHUD mientras el jugador apunta a
  // esta nave, para que la mentira visual de escala-legible no esconda
  // dónde colisiona de verdad justo cuando más importa saberlo.
  private nucleoRealzado = false;
  // nve-1: tramo de daño actual y hash de la silueta que le corresponde --
  // se recalculan solo cuando actualizarIntegridad cruza de tramo, nunca en
  // cada fotograma, porque dibujarCasco no es gratis.
  // escudo-y-propulsores: anillo e insignia con los turnos que quedan; viven
  // en el contenedor para seguir a la nave (también durante un deslizamiento).
  private readonly anilloEscudo: Phaser.GameObjects.Graphics;
  private readonly insigniaEscudo: Phaser.GameObjects.Text;
  private escudoTurnos = 0;
  private nivelDanioActual: NivelDanio = "alta";
  private hashSiluetaActual = 0;

  constructor(
    private readonly escena: Phaser.Scene,
    private readonly idNave: IdNave,
    x: number,
    groundY: number,
    private readonly mirarHaciaMasX: boolean,
    anguloInicialGrados: number,
  ) {
    this.anguloActualGrados = anguloInicialGrados;
    this.contenedor = escena.add.container(x, groundY);

    this.colorCasco = COLORES_NAVE[idNave];
    this.direccion = mirarHaciaMasX ? 1 : -1;
    // La variante (forma) coincide con el asiento: de 0 a 3, las cuatro que
    // ya existen en senaNave.ts. El núcleo acota a 4 naves.
    this.variante = idNave as VarianteNave;

    // Patas: dos apoyos asimétricos, como si la nave hubiese aterrizado mal
    // -- "varada", no aparcada. Nacen en el borde inferior real del casco
    // (0.32 * ALTO_CASCO, ver geometriaCasco.puntosCasco), no en el origen
    // del contenedor -- desde impacto-naves el origen es el CENTRO del
    // casco, no sus patas.
    const yBordeInferiorCasco = 0.32 * ALTO_CASCO;
    const patas = escena.add.graphics();
    patas.lineStyle(4, COLOR_PATAS, 1);
    patas.lineBetween(-ANCHO_CASCO * 0.3, yBordeInferiorCasco, -ANCHO_CASCO * 0.4, yBordeInferiorCasco + 10);
    patas.lineBetween(ANCHO_CASCO * 0.25, yBordeInferiorCasco, ANCHO_CASCO * 0.15, yBordeInferiorCasco + 12);
    this.contenedor.add(patas);

    // Casco: silueta poligonal simple (fuselaje + aleta), con una sombra
    // desplazada para que se lea como volumen sin usar ninguna textura.
    this.casco = escena.add.graphics();
    this.dibujarCasco();
    this.contenedor.add(this.casco);

    // Cañón: dos tramos con un quiebro a mitad de camino -- el "cañón
    // torcido" del diseño. Se redibuja cada vez que cambia el ángulo.
    this.canon = escena.add.graphics();
    this.contenedor.add(this.canon);
    this.apuntar(anguloInicialGrados);

    // arte-siluetas-3: triángulo invertido sobre la nave, oculto hasta que
    // marcarActiva(true) lo active -- nunca se redibuja por turno, solo se
    // muestra u oculta, así que no compite con el presupuesto de render.
    this.indicadorActiva = escena.add.graphics();
    this.indicadorActiva.fillStyle(COLOR_INDICADOR_ACTIVA, 1);
    const yIndicador = -ALTO_CASCO * 0.72;
    this.indicadorActiva.fillTriangle(
      -ANCHO_CASCO * 0.1,
      yIndicador - ALTO_CASCO * 0.18,
      ANCHO_CASCO * 0.1,
      yIndicador - ALTO_CASCO * 0.18,
      0,
      yIndicador,
    );
    this.indicadorActiva.setVisible(false);
    this.contenedor.add(this.indicadorActiva);

    this.anilloEscudo = escena.add.graphics();
    this.anilloEscudo.lineStyle(7, COLOR_ESCUDO, 0.95).strokeCircle(0, 0, RADIO_ESCUDO_U);
    this.anilloEscudo.fillStyle(COLOR_ESCUDO, 0.14).fillCircle(0, 0, RADIO_ESCUDO_U);
    this.anilloEscudo.setVisible(false);
    this.insigniaEscudo = escena
      .add.text(RADIO_ESCUDO_U * 0.72, -RADIO_ESCUDO_U * 0.72, "", {
        fontSize: "40px",
        fontStyle: "bold",
        color: "#0b1a2b",
        backgroundColor: "#7fd7ff",
        padding: { x: 9, y: 2 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.contenedor.add([this.anilloEscudo, this.insigniaEscudo]);
  }

  // Los turnos que le quedan al escudo (0 lo oculta). Solo redibuja al cambiar
  // el texto de la insignia: el anillo se pinta una vez, en el constructor.
  mostrarEscudo(turnos: number): void {
    if (turnos === this.escudoTurnos) return;
    this.escudoTurnos = turnos;
    this.anilloEscudo.setVisible(turnos > 0);
    this.insigniaEscudo.setVisible(turnos > 0).setText(String(turnos));
  }

  obtenerEscudoTurnos(): number {
    return this.escudoTurnos;
  }

  // esc-5: el dibujo miente (opción B) y esto lo hace honesto en la
  // jerarquía visual -- la silueta grande se pinta por debajo del techo de
  // opacidad declarado (TECHO_OPACIDAD_FUERA_NUCLEO) para que no se lea
  // como blindaje, y el núcleo de casco (el círculo de RADIO_CASCO_NAVE_PX
  // que de verdad colisiona) se pinta siempre opaco, encima de todo.
  //
  // nve-1: la silueta fuera del núcleo ahora depende de nivelDanioActual --
  // puntosCascoConDanio inserta abolladuras deterministas por tramo, así
  // que "alta"/"media"/"baja" no son solo tres alfas distintas, son tres
  // polígonos distintos (comprobable por hash, ver hashSiluetaActual).
  private dibujarCasco(): void {
    this.casco.clear();
    const puntosDanio = puntosCascoConDanio(this.direccion, this.nivelDanioActual, this.variante);
    this.hashSiluetaActual = hashPuntos(puntosDanio);
    const puntos = puntosDanio.map((p) => new Phaser.Math.Vector2(p.x, p.y));

    // Tobera: se dibuja ANTES que el fuselaje para que el fuselaje la tape
    // parcialmente, como un motor semi-embutido en la chapa, no una llama
    // suelta detrás de la nave.
    const tobera = anclaTobera(this.direccion);
    const colorTobera = this.nivelDanioActual === "baja" ? COLOR_TOBERA_CRITICA : COLOR_TOBERA_SANA;
    this.casco.fillStyle(colorTobera, OPACIDAD_TOBERA[this.nivelDanioActual]);
    this.casco.fillEllipse(tobera.x, tobera.y, ANCHO_CASCO * 0.16, ALTO_CASCO * 0.22);

    this.casco.fillStyle(COLOR_CASCO_SOMBRA, TECHO_OPACIDAD_FUERA_NUCLEO);
    this.casco.fillPoints(
      puntos.map((p) => new Phaser.Math.Vector2(p.x + 2, p.y + 2)),
      true,
    );
    this.casco.fillStyle(this.colorCasco, TECHO_OPACIDAD_FUERA_NUCLEO);
    this.casco.fillPoints(puntos, true);

    // Cabina: un cristal distinguible por color (nunca por más opacidad que
    // el resto del fuselaje, para no prometer blindaje donde no lo hay).
    this.casco.fillStyle(COLOR_CABINA, TECHO_OPACIDAD_FUERA_NUCLEO);
    this.casco.fillEllipse(0.05 * ANCHO_CASCO * this.direccion, -0.18 * ALTO_CASCO, ANCHO_CASCO * 0.14, ALTO_CASCO * 0.14);

    // Cicatriz de la abolladura de cola: solo en el tramo crítico, marca
    // oscura sobre el punto de la segunda abolladura -- "deterioro visible"
    // además del cambio de silueta, no en su lugar.
    if (this.nivelDanioActual === "baja") {
      const puntoCicatriz = puntosDanio[puntosDanio.length - 2];
      this.casco.fillStyle(COLOR_CICATRIZ, TECHO_OPACIDAD_FUERA_NUCLEO * 0.8);
      this.casco.fillCircle(puntoCicatriz.x, puntoCicatriz.y, ANCHO_CASCO * 0.06);
    }

    // arte-siluetas-3/4: insignia de FORMA (no solo color) sobre el lomo
    // del fuselaje -- es lo que distingue a las naves cuando el color no
    // sirve (escala de grises, daltonismo).
    const sena = puntosSenaNave(this.variante, this.direccion, ANCHO_CASCO, ALTO_CASCO).map(
      (p) => new Phaser.Math.Vector2(p.x, p.y),
    );
    this.casco.fillStyle(COLOR_SENA, TECHO_OPACIDAD_FUERA_NUCLEO);
    this.casco.fillPoints(sena, true);

    this.casco.fillStyle(this.colorCasco, OPACIDAD_NUCLEO);
    this.casco.fillCircle(0, 0, RADIO_CASCO_NAVE_PX);
    if (this.nucleoRealzado) {
      this.casco.lineStyle(3, 0xffffff, 0.9);
      this.casco.strokeCircle(0, 0, RADIO_CASCO_NAVE_PX + 3);
    }
  }

  // con-4: activa/desactiva el anillo de realce sobre el núcleo real --
  // idempotente y sin efecto visible si ya estaba en ese estado, para que
  // ControlHUD pueda llamarlo en cada fotograma de apuntado sin coste.
  realzarNucleo(activo: boolean): void {
    if (this.nucleoRealzado === activo) return;
    this.nucleoRealzado = activo;
    this.dibujarCasco();
  }

  // con-2: el destello del impacto real -- un círculo blanco superpuesto al
  // núcleo (no un efecto de partículas: registroEfectos.ts es para
  // partículas, esto es geometría, así que no compite por su techo) que se
  // desvanece en un tween corto. Objeto transitorio propio, no toca
  // this.casco, para no interferir con actualizarIntegridad (que sí anima
  // su alfa).
  destellarNucleo(): void {
    const destello = this.escena.add.graphics();
    destello.fillStyle(0xffffff, 0.85);
    destello.fillCircle(0, 0, RADIO_CASCO_NAVE_PX);
    this.contenedor.add(destello);
    this.escena.tweens.add({
      targets: destello,
      alpha: 0,
      duration: 180,
      onComplete: () => destello.destroy(),
    });
  }

  // realce-impacto (rlc-1, rlc-2): destello de daño proporcional, sobre toda
  // la silueta dibujada (no solo el núcleo, a diferencia de destellarNucleo)
  // -- geometría transitoria propia, igual que destellarNucleo, así que
  // tampoco compite por el techo de partículas de registroEfectos.ts.
  // intensidad ya viene acotada por intensidadDestelloDanio: aquí solo se
  // consume.
  destellarDanio(intensidad: number): void {
    const destello = this.escena.add.graphics();
    destello.fillStyle(COLOR_DESTELLO_DANIO, intensidad);
    destello.fillCircle(0, 0, Math.max(ANCHO_CASCO, ALTO_CASCO) * 0.6);
    this.contenedor.add(destello);
    this.escena.tweens.add({
      targets: destello,
      alpha: 0,
      duration: DURACION_DESTELLO_DANIO_MS,
      onComplete: () => destello.destroy(),
    });
  }

  // Dibuja el cañón con un quiebro visual apuntando a anguloGrados (misma
  // convención que EntradaDeTurno: 0 = +x, 90 = vertical, 180 = -x). El
  // vector se calcula directamente en vez de usar `.rotation` de Phaser
  // para no tener que razonar sobre su signo de giro en cada lectura.
  apuntar(anguloGrados: number): void {
    this.anguloActualGrados = anguloGrados;
    const rad = (anguloGrados * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = -Math.sin(rad);
    const origenX = 0;
    // 0.3 (antes 0.6 sobre el ALTO_CASCO de antes de impacto-naves, la
    // mitad al doblarse ALTO_CASCO): mismo punto de montaje absoluto del
    // cañón respecto al casco, ahora que el origen del contenedor es su
    // centro y no su base.
    const origenY = -ALTO_CASCO * 0.3;
    const quiebroX = origenX + dx * LARGO_CANON * 0.55;
    const quiebroY = origenY + dy * LARGO_CANON * 0.55;
    // El quiebro se desplaza perpendicular al eje del cañón, siempre el
    // mismo lado relativo: es lo que lo hace leerse como "torcido" y no
    // como temblor aleatorio.
    const perpX = -dy * 4;
    const perpY = dx * 4;
    const puntaX = origenX + dx * LARGO_CANON;
    const puntaY = origenY + dy * LARGO_CANON;

    this.canon.clear();
    this.canon.lineStyle(6, COLOR_CANON, 1);
    this.canon.beginPath();
    this.canon.moveTo(origenX, origenY);
    this.canon.lineTo(quiebroX + perpX, quiebroY + perpY);
    this.canon.lineTo(puntaX, puntaY);
    this.canon.strokePath();
  }

  obtenerAnguloActual(): number {
    return this.anguloActualGrados;
  }

  // Punto del mundo desde el que sale el proyectil: mismo criterio que
  // ALTURA_CANON_PX en el núcleo (origenY - ALTURA_CANON_PX), para que la
  // animación arranque exactamente donde arranca la física real.
  obtenerPosicionCanon(): { x: number; y: number } {
    const rad = (this.anguloActualGrados * Math.PI) / 180;
    const origenY = -ALTO_CASCO * 0.3;
    return {
      x: this.contenedor.x + Math.cos(rad) * LARGO_CANON,
      y: this.contenedor.y + origenY - Math.sin(rad) * LARGO_CANON,
    };
  }

  posicionarEn(x: number, groundY: number): void {
    this.contenedor.setPosition(x, groundY);
  }

  // Atenúa el casco con la integridad restante (en 0 se ve claramente fuera
  // de combate) y, si la integridad cruza a un tramo de daño distinto
  // (nve-1), redibuja la silueta con sus abolladuras -- el cambio de forma
  // solo cuesta un dibujarCasco por cruce de tramo, no por fotograma.
  actualizarIntegridad(integridad: number): void {
    const alfa = 0.35 + (0.65 * Math.max(0, Math.min(100, integridad))) / 100;
    this.casco.setAlpha(alfa);

    const nivel = nivelDanio(integridad);
    if (nivel !== this.nivelDanioActual) {
      this.nivelDanioActual = nivel;
      this.dibujarCasco();
    }
  }

  // nve-1: el tramo de daño y el hash de la silueta que le corresponde --
  // el e2e fuerza los tres tramos con window.__debug.forzarIntegridad y
  // compara estos hashes en vez de leer píxeles del canvas.
  obtenerNivelDanio(): NivelDanio {
    return this.nivelDanioActual;
  }

  obtenerHashSilueta(): number {
    return this.hashSiluetaActual;
  }

  // arte-siluetas-3: idempotente -- no redibuja nada, solo cambia la
  // visibilidad del triángulo ya construido en el constructor, para que
  // llamarlo cada fotograma (como hace refrescarNaves) no cueste nada.
  marcarActiva(activa: boolean): void {
    if (this.activa === activa) return;
    this.activa = activa;
    this.indicadorActiva.setVisible(activa);
  }

  estaActiva(): boolean {
    return this.activa;
  }

  obtenerVariante(): VarianteNave {
    return this.variante;
  }

  obtenerId(): IdNave {
    return this.idNave;
  }
}
