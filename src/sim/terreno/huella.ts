import { AIRE, ESCOMBRO, SOLIDO, type Mascara } from "@/sim/terreno/mascara";

export type SignoHuella = "restar" | "sumar";

export interface RectanguloSucio {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

// Contador de píxeles vivos por material (id de planeta), mutable a
// propósito: es el mismo patrón que la propia Mascara (un array que se muta
// en el sitio), y es lo que le permite a nucleo-gravedad mantener la masa de
// cada planeta sin recorrer el mundo entero en cada huella (grav-7). El
// escombro no lleva masa (sis-4) y por eso nunca entra aquí.
export type ContadoresPlanetas = Map<number, number>;

function registrarCambio(contadores: ContadoresPlanetas | undefined, anterior: number, nuevo: number): void {
  if (!contadores || anterior === nuevo) return;
  if (anterior !== AIRE && anterior !== ESCOMBRO) {
    contadores.set(anterior, (contadores.get(anterior) ?? 0) - 1);
  }
  if (nuevo !== AIRE && nuevo !== ESCOMBRO) {
    contadores.set(nuevo, (contadores.get(nuevo) ?? 0) + 1);
  }
}

// Único punto del código que escribe en la máscara fuera de la generación
// inicial (terreno-6 lo comprueba por grep): cráter, zanja, túnel o relleno
// son la misma operación con el signo cambiado -- "restar" vacía (una
// explosión), "sumar" rellena (un arma de utilidad como el Vertedero
// Portátil). El rectángulo sucio que devuelve es lo único que la cáscara
// necesita para no repintar el lienzo entero (terreno-5).
//
// `material` y `contadores` son nuevos en nucleo-gravedad y opcionales a
// propósito (terreno-2 sigue llamando con 5 argumentos sin tocarse): con
// signo "sumar", `material` decide QUÉ material queda (SOLIDO por defecto,
// el mismo de siempre); si se pasa `contadores`, esta función mantiene su
// recuento por material al mismo tiempo que escribe, píxel a píxel, en vez
// de que alguien tenga que recontar la máscara entera después.
export function aplicarHuellaCircular(
  mascara: Mascara,
  cx: number,
  cy: number,
  radio: number,
  signo: SignoHuella,
  material: number = SOLIDO,
  contadores?: ContadoresPlanetas,
): RectanguloSucio {
  const valor = signo === "restar" ? AIRE : material;
  const minX = Math.max(0, Math.floor(cx - radio));
  const maxX = Math.min(mascara.ancho - 1, Math.ceil(cx + radio));
  const minY = Math.max(0, Math.floor(cy - radio));
  const maxY = Math.min(mascara.alto - 1, Math.ceil(cy + radio));
  const radioCuadrado = radio * radio;

  for (let y = minY; y <= maxY; y++) {
    const dy = y - cy;
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= radioCuadrado) {
        const indice = y * mascara.ancho + x;
        registrarCambio(contadores, mascara.datos[indice], valor);
        mascara.datos[indice] = valor;
      }
    }
  }

  return {
    x: minX,
    y: minY,
    ancho: Math.max(0, maxX - minX + 1),
    alto: Math.max(0, maxY - minY + 1),
  };
}

// Cápsula horizontal (rectángulo con dos tapas semicirculares): la excavación
// alargada de la Zanjadora Manolita (armas-3, al menos 3 veces más ancha que
// alta). Misma técnica de distancia-al-punto-más-cercano que la circular,
// pero contra un segmento en vez de un punto: dxSegmento es 0 dentro del
// tramo recto y crece hacia los extremos, así que las tapas salen
// semicirculares sin código aparte.
//
// Mismos `material`/`contadores` opcionales que aplicarHuellaCircular, y por
// la misma razón (grav-7).
export function aplicarHuellaCapsula(
  mascara: Mascara,
  cx: number,
  cy: number,
  medioLargo: number,
  radio: number,
  signo: SignoHuella,
  material: number = SOLIDO,
  contadores?: ContadoresPlanetas,
): RectanguloSucio {
  const valor = signo === "restar" ? AIRE : material;
  const minX = Math.max(0, Math.floor(cx - medioLargo - radio));
  const maxX = Math.min(mascara.ancho - 1, Math.ceil(cx + medioLargo + radio));
  const minY = Math.max(0, Math.floor(cy - radio));
  const maxY = Math.min(mascara.alto - 1, Math.ceil(cy + radio));
  const radioCuadrado = radio * radio;

  for (let y = minY; y <= maxY; y++) {
    const dy = y - cy;
    for (let x = minX; x <= maxX; x++) {
      const dxSegmento = Math.max(0, Math.abs(x - cx) - medioLargo);
      if (dxSegmento * dxSegmento + dy * dy <= radioCuadrado) {
        const indice = y * mascara.ancho + x;
        registrarCambio(contadores, mascara.datos[indice], valor);
        mascara.datos[indice] = valor;
      }
    }
  }

  return {
    x: minX,
    y: minY,
    ancho: Math.max(0, maxX - minX + 1),
    alto: Math.max(0, maxY - minY + 1),
  };
}
