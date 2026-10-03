// arte-siluetas-3: cuatro naves distinguibles por FORMA, no solo por color.
// Cambiar la silueta base (puntosCasco, src/sim/naves/geometriaCasco.ts)
// habría tocado también src/sim/naves/contacto.ts, que usa esa misma
// función para clasificar roce/impacto -- cambiarla por variante habría
// significado mantener el hit-test en sincronía con una silueta que varía
// por jugador, un riesgo que este bloque (puramente de arte) no necesita
// correr. En su lugar, la seña es una insignia geométrica AÑADIDA sobre el
// casco (en src/juego, nunca en src/sim), con una forma propia por
// variante: lo que decide si dos naves se distinguen es esa forma, no el
// color con el que se rellena.
import type { PuntoCasco, VarianteNave } from "@/sim/naves/geometriaCasco";

export type { VarianteNave };

// Tamaño en fracción de ANCHO_CASCO/ALTO_CASCO: pequeño y centrado sobre la
// cabina, para no competir con la silueta del fuselaje ni con las patas.
const RADIO_SENA = 0.16;

function escalar(puntos: readonly PuntoCasco[], anchoCasco: number, altoCasco: number, dir: 1 | -1): PuntoCasco[] {
  return puntos.map((p) => ({ x: p.x * anchoCasco * dir, y: p.y * altoCasco }));
}

// Cuatro formas con topología distinta entre sí (triángulo, rombo, estrella
// de cuatro puntas, cruz): la diferencia de silueta sobrevive a pasar a
// escala de grises (arte-siluetas-4), porque no depende de ningún color
// concreto, solo del contorno.
function puntosCrudos(variante: VarianteNave): readonly PuntoCasco[] {
  const r = RADIO_SENA;
  switch (variante) {
    case 0:
      // Triángulo: morro hacia +x, igual que el resto de la nave.
      return [
        { x: r * 1.3, y: 0 },
        { x: -r * 0.8, y: r },
        { x: -r * 0.8, y: -r },
      ];
    case 1:
      // Rombo.
      return [
        { x: r * 1.2, y: 0 },
        { x: 0, y: r * 1.2 },
        { x: -r * 1.2, y: 0 },
        { x: 0, y: -r * 1.2 },
      ];
    case 2: {
      // Estrella de cuatro puntas (ocho vértices, radio alterno).
      const puntos: PuntoCasco[] = [];
      for (let i = 0; i < 8; i++) {
        const angulo = (i / 8) * Math.PI * 2;
        const radio = i % 2 === 0 ? r * 1.3 : r * 0.5;
        puntos.push({ x: Math.cos(angulo) * radio, y: Math.sin(angulo) * radio });
      }
      return puntos;
    }
    case 3: {
      // Cruz (doce vértices): la única de las cuatro con huecos entrantes
      // reales, no solo un polígono convexo distinto.
      const b = r * 0.4;
      const l = r * 1.2;
      return [
        { x: -b, y: -l },
        { x: b, y: -l },
        { x: b, y: -b },
        { x: l, y: -b },
        { x: l, y: b },
        { x: b, y: b },
        { x: b, y: l },
        { x: -b, y: l },
        { x: -b, y: b },
        { x: -l, y: b },
        { x: -l, y: -b },
        { x: -b, y: -b },
      ];
    }
  }
}

// Posición local (relativa al centro del contenedor de la nave) y forma de
// la seña, ya a escala de dibujo -- lista para pasarla a fillPoints tal
// cual. `cxFraccion`/`cyFraccion` sitúan la insignia sobre el lomo del
// fuselaje, lejos de la cabina (que ya tiene su propio color) y de las
// patas.
export function puntosSenaNave(
  variante: VarianteNave,
  dir: 1 | -1,
  anchoCasco: number,
  altoCasco: number,
): readonly PuntoCasco[] {
  const crudos = escalar(puntosCrudos(variante), anchoCasco, altoCasco, dir);
  const centroX = -0.08 * anchoCasco * dir;
  const centroY = 0.12 * altoCasco;
  return crudos.map((p) => ({ x: p.x + centroX, y: p.y + centroY }));
}
