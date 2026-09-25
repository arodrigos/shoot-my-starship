"use client";

import dynamic from "next/dynamic";

// Aplicacion decide entre la pantalla de inicio y la partida real, y la de
// inicio ya lee localStorage al montarse (progreso.ts): ssr:false evita que
// el primer render en el servidor (sin `window`) calcule un estado
// equivocado -- p.ej. "sin almacenamiento" -- que la hidratación arrastraría
// tal cual (mismo motivo por el que JuegoLienzo hace lo mismo con Phaser).
const Aplicacion = dynamic(() => import("@/juego/Aplicacion").then((m) => m.Aplicacion), { ssr: false });

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100dvh" }}>
      <Aplicacion />
    </main>
  );
}
