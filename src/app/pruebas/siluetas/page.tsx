import { JuegoLienzo } from "@/juego/JuegoLienzo";

// Ruta dedicada para proy-1 (requisito c de la sexta devolución): la
// captura de las 13 siluetas en fila que el criterio pide literalmente,
// dibujadas por la escena real (Siluetas) en vez de por una comparación
// aparte de puntos, para que la captura demuestre lo que se ve en pantalla.
export default function PruebasSiluetas() {
  return (
    <main style={{ width: "100vw", height: "100dvh" }}>
      <JuegoLienzo escena="siluetas" />
    </main>
  );
}
