// Único punto de decisión sobre si la cámara puede moverse (sacudida de
// impacto, zoom del remate): cualquier efecto de cámara futuro pregunta aquí
// en vez de leer por su cuenta el ajuste o la preferencia del sistema.
export function permiteMovimientoCamara(sacudidaActiva: boolean, prefiereMovimientoReducido: boolean): boolean {
  return sacudidaActiva && !prefiereMovimientoReducido;
}
