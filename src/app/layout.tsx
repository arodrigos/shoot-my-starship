import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shoot my starship",
  description:
    "Artillería por turnos en el Cinturón de la Deriva: naves varadas, terreno destructible y diez armas con mala idea.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
