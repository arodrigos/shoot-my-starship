import type Phaser from "phaser";
import { REGISTRO_EFECTOS, type IdEfectoVisual } from "@/juego/efectos/registroEfectos";

// presupuesto-render (pre-1): ÚNICO punto del cliente por el que se puede
// crear un emisor de partículas. scripts/comprobar-presupuesto-render.mjs
// falla si aparece un `.add.particles(` fuera de este fichero -- así un
// efecto nuevo no puede colarse sin antes tener una fila en
// REGISTRO_EFECTOS, y el techo declarado se comprueba aquí mismo en vez de
// confiar en que quien escriba el efecto se acuerde de respetarlo.
export function crearEmisorRegistrado(
  escena: Phaser.Scene,
  idEfecto: IdEfectoVisual,
  x: number,
  y: number,
  textura: string,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const efecto = REGISTRO_EFECTOS[idEfecto];
  if (!efecto) {
    throw new Error(`crearEmisorRegistrado: "${idEfecto}" no está en REGISTRO_EFECTOS (pre-1)`);
  }

  const maxParticles = typeof config.maxParticles === "number" ? config.maxParticles : undefined;
  if (maxParticles !== undefined && maxParticles > efecto.techoParticulas) {
    throw new Error(
      `crearEmisorRegistrado: "${idEfecto}" declara maxParticles=${maxParticles}, por encima de su techo de ${efecto.techoParticulas} (pre-1)`,
    );
  }
  if (efecto.reutilizaPool && maxParticles === undefined) {
    throw new Error(
      `crearEmisorRegistrado: "${idEfecto}" declara reutilizaPool=true pero no fija maxParticles en su config (pre-1)`,
    );
  }

  return escena.add.particles(x, y, textura, config);
}

// pre-1: las explosiones no fijan maxParticles (viven y mueren de golpe con
// `.explode(cantidad, ...)`), así que su techo se vigila en el punto donde
// SÍ se conoce la cantidad real: aquí, contra el registro, no en el emisor.
export function comprobarCantidadDentroDelTecho(idEfecto: IdEfectoVisual, cantidad: number): void {
  const efecto = REGISTRO_EFECTOS[idEfecto];
  if (!efecto) {
    throw new Error(`comprobarCantidadDentroDelTecho: "${idEfecto}" no está en REGISTRO_EFECTOS (pre-1)`);
  }
  if (cantidad > efecto.techoParticulas) {
    throw new Error(
      `comprobarCantidadDentroDelTecho: "${idEfecto}" explota ${cantidad} partículas, por encima de su techo de ${efecto.techoParticulas} (pre-1)`,
    );
  }
}
