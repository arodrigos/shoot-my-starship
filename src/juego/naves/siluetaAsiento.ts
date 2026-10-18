import { puntosCascoVariante, type PuntoCasco, type VarianteNave } from "@/sim/naves/geometriaCasco";
import { varianteDeNave } from "@/sim/naves/contacto";

// Segundo canal del asiento (marca-asiento): la misma familia de casco que se
// ve en el campo, sin deterioro, normalizada a la caja unidad para que la
// pinten igual React (SVG) y Phaser (Graphics). Se escala por el lado mayor y
// se centra, así conserva la proporción: un dardo sigue siendo largo y fino.
export function contornoSiluetaAsiento(asiento: number): readonly PuntoCasco[] {
  const puntos = puntosCascoVariante(varianteDeNave(asiento) as VarianteNave, 1);
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const lado = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  const sobraX = (lado - (Math.max(...xs) - minX)) / 2;
  const sobraY = (lado - (Math.max(...ys) - minY)) / 2;
  return puntos.map((p) => ({ x: (p.x - minX + sobraX) / lado, y: (p.y - minY + sobraY) / lado }));
}

export function varianteSiluetaAsiento(asiento: number): 0 | 1 | 2 | 3 {
  return varianteDeNave(asiento);
}
