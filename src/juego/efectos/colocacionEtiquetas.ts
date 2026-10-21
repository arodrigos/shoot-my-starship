// Colocación de las etiquetas de un impacto (números de daño, «Estaba aquí»).
// Con un disparo a quemarropa salen varias casi en el mismo punto y se pisan;
// aquí solo se decide dónde va cada una, sin Phaser, para poder probarlo en
// Node. Textos, valores y duraciones no son asunto de este módulo.
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

// La separación cuenta como solape: dos etiquetas pegadas borde con borde no
// se pisan, pero el trazo negro de una se come el de la otra.
export function seSolapan(a: Rect, b: Rect, separacion = 0): boolean {
  return a.x < b.x + b.ancho + separacion && b.x < a.x + a.ancho + separacion && a.y < b.y + b.alto + separacion && b.y < a.y + a.alto + separacion;
}

function encajar(v: number, minimo: number, maximo: number): number {
  // Si la etiqueta no cabe, se pega al borde de inicio: que se lea el principio.
  return maximo < minimo ? minimo : Math.max(minimo, Math.min(maximo, v));
}

// Apilar en vertical se lee mejor que desplazar en horizontal (el número sigue
// encima de la nave), así que moverse en x cuenta el doble.
const PESO_HORIZONTAL = 2;

// Devuelve dónde dibujar `deseado` para que no pise a ninguna de `ocupadas` y
// quede dentro de `area`. Las candidatas salen de los bordes de las ocupadas
// (justo encima, debajo, a un lado) y de los del área, combinadas en x e y: si
// hay un hueco libre pegado a alguna, aparece entre ellas. Se queda la más
// cercana a la posición deseada. Si el área está llena, se devuelve la deseada
// encajada en el área, que es lo menos malo.
export function colocarEtiqueta(deseado: Rect, ocupadas: readonly Rect[], area: Rect, separacion: number): Rect {
  const { ancho, alto } = deseado;
  const xs = [deseado.x, area.x, area.x + area.ancho - ancho];
  const ys = [deseado.y, area.y, area.y + area.alto - alto];
  for (const o of ocupadas) {
    xs.push(o.x - ancho - separacion, o.x + o.ancho + separacion, o.x);
    ys.push(o.y - alto - separacion, o.y + o.alto + separacion, o.y);
  }
  const minX = area.x;
  const maxX = area.x + area.ancho - ancho;
  const minY = area.y;
  const maxY = area.y + area.alto - alto;
  let mejor: Rect | null = null;
  let mejorCoste = Infinity;
  for (const cx of xs) {
    const x = encajar(cx, minX, maxX);
    for (const cy of ys) {
      const y = encajar(cy, minY, maxY);
      const candidata = { x, y, ancho, alto };
      if (ocupadas.some((o) => seSolapan(candidata, o, separacion))) continue;
      const coste = PESO_HORIZONTAL * Math.abs(x - deseado.x) + Math.abs(y - deseado.y);
      if (coste < mejorCoste) {
        mejor = candidata;
        mejorCoste = coste;
      }
    }
  }
  return mejor ?? { x: encajar(deseado.x, minX, maxX), y: encajar(deseado.y, minY, maxY), ancho, alto };
}
