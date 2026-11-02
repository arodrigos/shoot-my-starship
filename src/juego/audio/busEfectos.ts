// Bus de efectos: GainNode → DynamicsCompressorNode → destination. La voz lo
// atenúa igual que a la música, y el compresor evita que varios efectos
// seguidos saturen la salida.
export const FACTOR_ATENUACION_VOZ = 0.35;
export const RAMPA_ATENUACION_S = 0.1;

export interface BusEfectos {
  readonly entrada: AudioNode;
  atenuar(factor: number): void;
}

export function crearBusEfectos(contexto: AudioContext): BusEfectos {
  const ganancia = contexto.createGain();
  const compresor = contexto.createDynamicsCompressor();
  ganancia.connect(compresor);
  compresor.connect(contexto.destination);
  return {
    entrada: ganancia,
    atenuar(factor: number): void {
      const ahora = contexto.currentTime;
      ganancia.gain.cancelScheduledValues(ahora);
      ganancia.gain.setValueAtTime(ganancia.gain.value, ahora);
      ganancia.gain.linearRampToValueAtTime(factor, ahora + RAMPA_ATENUACION_S);
    },
  };
}
