import { aplicarHuellaCircular, type RectanguloSucio, type SignoHuella } from "@/sim/terreno/huella";
import { esSolido, type Mascara } from "@/sim/terreno/mascara";
import { calcularRectanguloDiferente } from "@/sim/terreno/diferencia";

// Lo que sabe dibujar el rectángulo sucio tras un impacto. Es una interfaz
// y no una clase Phaser concreta a propósito: terreno-5 (qué rectángulo se
// pide refrescar) se comprueba con un doble de prueba en Node, sin arrancar
// un navegador ni una GPU.
export interface SuperficieDeTerreno {
  refrescarRectangulo(mascara: Mascara, rectangulo: RectanguloSucio): void;
  // render-5: repintado completo desde la máscara actual, para la
  // recuperación tras perder el contexto WebGL -- no puede ser
  // refrescarRectangulo(mascara, rectánguloEntero) porque esa ruta solo
  // sabe de fillRect/clearRect y terreno-6 la mantiene así a propósito.
  pintarCompleta(mascara: Mascara): void;
}

// Único punto de código que modifica la máscara Y la textura visible a la
// vez (terreno-3): ninguna otra parte del juego debe llamar a
// aplicarHuellaCircular directamente, porque hacerlo dejaría la textura sin
// refrescar y es exactamente el fallo clásico del género (se ve el agujero
// pero el proyectil sigue chocando, o al revés).
export class Terreno {
  constructor(
    private mascara: Mascara,
    private readonly superficie: SuperficieDeTerreno,
  ) {}

  esSolido(x: number, y: number): boolean {
    return esSolido(this.mascara, x, y);
  }

  // Expuesta para render-5 (repintado completo tras recuperar el contexto)
  // y para que la cáscara pueda leer el estado actual sin mantener su
  // propia copia -- Terreno sigue siendo el único dueño de la máscara.
  obtenerMascara(): Mascara {
    return this.mascara;
  }

  aplicarHuella(cx: number, cy: number, radio: number, signo: SignoHuella): RectanguloSucio {
    const rectangulo = aplicarHuellaCircular(this.mascara, cx, cy, radio, signo);
    this.superficie.refrescarRectangulo(this.mascara, rectangulo);
    return rectangulo;
  }

  // Reconcilia esta máscara con la que devuelve avanzar() (autoritativa,
  // clonada y mutada dentro de resolverDisparo con la huella real del arma
  // -- circular, cápsula o ninguna) sin que este módulo tenga que conocer
  // esa forma: calcula el rectángulo que cambió y solo refresca eso, el
  // mismo contrato de "rectángulo sucio" de aplicarHuella. Devuelve null si
  // el disparo no tocó el terreno (el Gravitón, huella "ninguna").
  sincronizarDesde(mascaraNueva: Mascara): RectanguloSucio | null {
    const rectangulo = calcularRectanguloDiferente(this.mascara, mascaraNueva);
    this.mascara = mascaraNueva;
    if (rectangulo !== null) {
      this.superficie.refrescarRectangulo(this.mascara, rectangulo);
    }
    return rectangulo;
  }

  // render-5: tras RESTORE_WEBGL hay que repintar desde la máscara ACTUAL
  // (no regenerar desde la semilla, el terreno es destructible), con la
  // única función del módulo que hace una pasada completa del lienzo.
  repintarCompleta(): void {
    this.superficie.pintarCompleta(this.mascara);
  }
}
