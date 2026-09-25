import { JuegoLienzo } from "@/juego/JuegoLienzo";

// Ruta dedicada para terreno-3/terreno-6: la raíz ahora monta la escena real
// (Partida, render-juego), así que la escena de pruebas de terreno se muda
// aquí para que ese contrato de terreno-mascara siga siendo verificable sin
// depender de que la escena principal exponga la misma superficie de
// depuración.
export default function PruebasTerreno() {
  return (
    <main style={{ width: "100vw", height: "100dvh" }}>
      <JuegoLienzo escena="sandbox" />
    </main>
  );
}
