// minirobot (rob-2): puente React/Phaser del contador de saltos de cada robot.
// Mismo patrón pub/sub que fantasmasStore.ts. El robot se dibuja en el lienzo,
// pero su contador vive también en el HUD para que se lea a 360 px y se pueda
// comprobar sin depender de píxeles.
export interface RobotVisible {
  readonly dueno: number;
  readonly saltos: number;
  readonly maxSaltos: number;
  readonly texto: string;
}

let robots: readonly RobotVisible[] = [];
const escuchas = new Set<() => void>();

export function obtenerRobots(): readonly RobotVisible[] {
  return robots;
}

export function suscribirRobots(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function publicarRobots(nuevos: readonly RobotVisible[]): void {
  robots = nuevos;
  for (const escucha of escuchas) escucha();
}
