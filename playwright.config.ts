import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // cie-2: testDir sube a "./tests" (antes "./tests/e2e") y testMatch gana
  // ".spec.ts" para que tests/smoke/traspaso.spec.ts sea descubrible por el
  // comando literal del manifiesto ("npx playwright test
  // tests/smoke/traspaso.spec.ts", sin --config), que usa esta misma
  // configuración por defecto. tests/unit/**/*.test.ts no coincide con
  // ningún sufijo de este patrón, así que la suite de Node no se cuela aquí.
  testDir: "./tests",
  testMatch: /.*\.(e2e|spec)\.ts/,
  fullyParallel: true,
  reporter: "list",
  // cie-6: reintentos en CI (una repetición basta para que un fallo
  // intermitente de verdad no tumbe el pipeline por una sola muestra).
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    // cie-6, desviación diagnosticada en desarrollo-29: "retain-on-failure"
    // graba (y solo descarta al final) la traza de CADA intento, incluido
    // el que pasa -- ese coste de grabación, no la contención de CI, es lo
    // que rompía proy-5 y humor-1 de forma reproducible incluso en solitario
    // y sin ningún otro test en paralelo (confirmado: fallan siempre con
    // "retain-on-failure" y pasan siempre con "on-first-retry", mismo
    // commit, misma máquina). proy-5 muestrea el vuelo real por polling
    // cada 30ms -- exactamente el tipo de test que un coste añadido de
    // grabación por acción puede aplastar a "solo 1 muestra". "on-first-retry"
    // da lo mismo que se necesita (traza disponible cuando algo falla, vía
    // el reintento) sin grabar en el camino que sí importa medir en tiempo real.
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Contra un servidor de producción local, no contra `next dev` ni una
    // URL de preview de Vercel: el proyecto de Vercel todavía no existe (se
    // crea en la etapa de traspaso, después de que Gatekeeper apruebe), así
    // que no hay deploy contra el que apuntar en desarrollo. Ver
    // desviaciones en el entregable.
    //
    // Solo "start", sin "build" encadenado: arrancar "next start" justo
    // después de "next build" en el mismo comando de shell producía un
    // "Cannot find module '@next/env'" intermitente pese a que el fichero
    // existe en disco (visto en CI y reproducido en local tras un npm ci
    // limpio). Requiere "npm run build" ya ejecutado antes -- lo hace CI
    // como paso propio; en local, ejecutar "npm run build" antes de
    // "npm run test:e2e".
    command: "npm run start -- -p 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 180000,
  },
});
