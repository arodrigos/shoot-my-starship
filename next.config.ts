import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import { calcularRevision } from "./src/juego/pwa/revision";

function salidaGit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

const revision = calcularRevision(
  { shaDespliegue: process.env.VERCEL_GIT_COMMIT_SHA, salidaGit: salidaGit() },
  randomUUID,
);

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_VERSION_APP: revision.slice(0, 7) },
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Endurecimiento sin efecto visible: el juego no usa cámara,
        // micrófono ni ubicación, así que ningún script (propio o colado)
        // debe poder pedirlos. screen-wake-lock y el portapapeles quedan
        // fuera a propósito: la pantalla encendida y la medición los usan.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // El navegador revisa el script del worker en cada carga; con caché
        // HTTP una versión vieja del propio worker se quedaría pegada. El
        // alcance por defecto de /serwist/ no cubriría la página de inicio.
        source: "/serwist/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
