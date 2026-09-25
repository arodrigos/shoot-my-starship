import type { EstadoPartida } from "@/sim/partida/tipos";

// EstadoPartida es serializable de punta a punta (nucleo-2), pero
// JSON.stringify no reconstruye un Uint8Array por sí solo: sin este par,
// mascara.datos vuelve de JSON.parse como un objeto plano sin longitud, y el
// siguiente disparo clona una máscara de tamaño 0 en silencio. Es el único
// punto que conoce ese detalle -- avanzar() y el resto del núcleo nunca
// serializan nada por su cuenta.
export function serializarEstado(estado: EstadoPartida): string {
  return JSON.stringify(estado, (_clave, valor: unknown) => (valor instanceof Uint8Array ? Array.from(valor) : valor));
}

export function deserializarEstado(json: string): EstadoPartida {
  const bruto = JSON.parse(json) as EstadoPartida;
  return { ...bruto, mascara: { ...bruto.mascara, datos: Uint8Array.from(bruto.mascara.datos) } };
}
