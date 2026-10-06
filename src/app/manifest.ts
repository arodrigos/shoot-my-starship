import type { MetadataRoute } from "next";

// pan-6: al añadirlo a la pantalla de inicio del iPad, el juego se abre sin
// la barra de Safari. Sin iconos binarios: los activos son procedimentales.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shoot my starship",
    short_name: "Starship",
    start_url: "/",
    display: "fullscreen",
    background_color: "#12141a",
    theme_color: "#12141a",
  };
}
