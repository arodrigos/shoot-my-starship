import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Contra un servidor de producción local, no contra `next dev` ni una
    // URL de preview de Vercel: el proyecto de Vercel todavía no existe (se
    // crea en la etapa de traspaso, después de que Gatekeeper apruebe), así
    // que no hay deploy contra el que apuntar en desarrollo. Ver
    // desviaciones en el entregable.
    command: "npm run build && npm run start -- -p 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 180000,
  },
});
