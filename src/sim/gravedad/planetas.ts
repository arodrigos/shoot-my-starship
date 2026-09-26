import { AIRE, ESCOMBRO, type Mascara } from "@/sim/terreno/mascara";

// Un planeta tal y como lo ve la gravedad, no como se dibuja: nucleo-gravedad
// solo declara esta forma y su aritmética. Qué planetas hay, dónde y de qué
// tamaño es decisión de generador-sistema (el siguiente bloque); este no
// genera ninguno, solo sabe qué hacer con ellos.
export interface Planeta {
  // 1..6 (mascara.PLANETA_MIN..PLANETA_MAX): coincide con el material que
  // ese planeta ocupa en la máscara, así que un píxel sabe de quién es sin
  // tabla de traducción aparte.
  readonly id: number;
  // Centro de atracción. FIJO: la decisión declarada del diseño es que NO se
  // recalcula como centroide al destruir el planeta (grav-5) -- si se
  // recalculara, un planeta afeitado por un lado desplazaría su tirón en
  // silencio y la previsualización de trayectoria pasaría a mentir.
  readonly cx: number;
  readonly cy: number;
  // Radio del planeta ENTERO (no del recuento de píxeles vivos, que baja al
  // destruirlo): además de geometría, hace de eps de suavizado de Aarseth en
  // la gravedad (grav-2), así que tampoco cambia con la destrucción.
  readonly radio: number;
  readonly densidad: number;
  // Recuento de píxeles sólidos que le quedan a este planeta en la máscara.
  // Se mantiene incrementalmente al escribir (huella.ts) y se recalcula al
  // cerrar el turno (recalcularRegistro / registroDesdeContadores); durante
  // un vuelo se queda CONGELADO (grav-4), nunca se toca dentro del bucle de
  // integración.
  readonly pixelesVivos: number;
}

export type RegistroPlanetas = readonly Planeta[];

// LA DECISIÓN DECLARADA, hecha aritmética: la masa de un planeta es su
// recuento de píxeles sólidos por su densidad. Es una masa 2D a propósito
// (2D es lo que la máscara sabe medir), lo que hace que el enlace entre
// destruir y desviar sea exacto y no estimado (grav-3).
export function masaPlaneta(planeta: Planeta): number {
  return planeta.pixelesVivos * planeta.densidad;
}

// Fuerza bruta, O(ancho*alto): la referencia contra la que grav-7 comprueba
// que el contador incremental de huella.ts no se ha desincronizado, y la
// base de recalcularRegistro. El escombro (255) es sólido pero
// gravitatoriamente inerte (sis-4) y por eso no se cuenta aquí.
export function contarPixelesPorMaterial(mascara: Mascara): Map<number, number> {
  const contadores = new Map<number, number>();
  for (const material of mascara.datos) {
    if (material === AIRE || material === ESCOMBRO) continue;
    contadores.set(material, (contadores.get(material) ?? 0) + 1);
  }
  return contadores;
}

// "Cerrar el turno" por fuerza bruta: recorre la máscara entera y produce un
// registro nuevo con las masas al día, sin tocar centro, radio ni densidad.
// Útil cuando no se ha llevado un contador incremental de por medio (p.ej.
// para inicializar el registro de una máscara ya escrita).
export function recalcularRegistro(registro: RegistroPlanetas, mascara: Mascara): RegistroPlanetas {
  return registroDesdeContadores(registro, contarPixelesPorMaterial(mascara));
}

// "Cerrar el turno" a partir de un contador ya mantenido incrementalmente
// (huella.ts) en vez de recorrer la máscara entera de nuevo: es la vía
// barata para grav-4 (varias huellas durante un mismo vuelo, una sola
// recalculada al final).
export function registroDesdeContadores(registro: RegistroPlanetas, contadores: ReadonlyMap<number, number>): RegistroPlanetas {
  return registro.map((planeta) => ({ ...planeta, pixelesVivos: contadores.get(planeta.id) ?? 0 }));
}
