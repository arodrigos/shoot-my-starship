import { colorDeAsiento } from "@/juego/naves/paletaNaves";
import { contornoSiluetaAsiento, varianteSiluetaAsiento } from "@/juego/naves/siluetaAsiento";

// Mini-silueta del asiento: el color solo no basta (daltonismo, brillo bajo),
// así que la forma de la nave va también delante del nombre. Contorno oscuro
// para que se lea sobre cualquier fondo de pestaña.
export function MarcaAsiento({ asiento, alto = 13 }: { readonly asiento: number; readonly alto?: number }) {
  const puntos = contornoSiluetaAsiento(asiento)
    .map((p) => `${(p.x * 100).toFixed(1)},${(p.y * 100).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={alto}
      height={alto}
      viewBox="-6 -6 112 112"
      data-testid={`integridad-marca-${asiento}`}
      data-silueta={varianteSiluetaAsiento(asiento)}
      style={{ flex: "0 0 auto", marginRight: alto < 13 ? 1 : 2, verticalAlign: "-2px", display: "inline-block" }}
    >
      <polygon points={puntos} fill={colorDeAsiento(asiento)} stroke="#0b0f1a" strokeWidth={9} strokeLinejoin="round" />
    </svg>
  );
}
