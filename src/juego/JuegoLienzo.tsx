"use client";

import dynamic from "next/dynamic";

// La importación dinámica con ssr:false solo se puede pedir desde un
// componente cliente (Next.js no lo admite en un Server Component): por eso
// existe esta capa, separada de page.tsx. Phaser toca `window` al cargarse,
// así que ejecutarlo en el servidor rompería el render.
const PhaserGame = dynamic(() => import("@/juego/PhaserGame").then((m) => m.PhaserGame), {
  ssr: false,
});

export function JuegoLienzo() {
  return <PhaserGame />;
}
