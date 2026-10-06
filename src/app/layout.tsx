import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shoot my starship",
  description:
    "Artillería por turnos en el Cinturón de la Deriva: naves varadas, terreno destructible y diez armas con mala idea.",
};

// pan-6: sin viewport-fit=cover Safari en iPad deja bandas junto al indicador de
// inicio y el lienzo no llega a los bordes; la consola compensa con
// env(safe-area-inset-bottom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
