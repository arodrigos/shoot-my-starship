// Conversión pantalla↔mundo con la cámara real y el rectángulo del lienzo
// (con Scale.FIT puede haber bandas). Es el único sitio que conoce esa cuenta:
// con una escala fija, cualquier zoom o desplazamiento de cámara dejaba la
// flecha y los avisos en el sitio equivocado.
export interface Punto {
  readonly x: number;
  readonly y: number;
}

// Subconjunto de Phaser.Scene que se usa, para poder probarlo en Node.
export interface EscenaConCamara {
  readonly cameras: {
    readonly main: { readonly width: number; readonly height: number; readonly zoom: number; readonly scrollX: number; readonly scrollY: number };
  };
  readonly game: { readonly canvas: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } } };
}

// Se deriva del scroll y el zoom, no de worldView: en el primer frame
// worldView todavía no está poblado.
function vistaDeMundo(escena: EscenaConCamara): { x: number; y: number; ancho: number; alto: number } {
  const c = escena.cameras.main;
  const ancho = c.width / c.zoom;
  const alto = c.height / c.zoom;
  return { x: c.scrollX + c.width / 2 - ancho / 2, y: c.scrollY + c.height / 2 - alto / 2, ancho, alto };
}

export function mundoAPantallaCss(escena: EscenaConCamara, p: Punto): Punto {
  const v = vistaDeMundo(escena);
  const r = escena.game.canvas.getBoundingClientRect();
  return { x: r.left + ((p.x - v.x) / v.ancho) * r.width, y: r.top + ((p.y - v.y) / v.alto) * r.height };
}

export function pantallaCssAMundo(escena: EscenaConCamara, p: Punto): Punto {
  const v = vistaDeMundo(escena);
  const r = escena.game.canvas.getBoundingClientRect();
  return { x: v.x + ((p.x - r.left) / r.width) * v.ancho, y: v.y + ((p.y - r.top) / r.height) * v.alto };
}
