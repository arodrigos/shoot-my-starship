import { test, expect } from "@playwright/test";

// Auditoría de seguridad 2026-10 (docs/informes/seguridad-2026-10.md): las
// cabeceras se comprueban en la respuesta real del servidor de producción, no
// en el texto de next.config.ts, porque un `source` mal escrito las dejaría
// sin aplicar sin ningún error.
for (const ruta of ["/", "/serwist/sw.js", "/manifest.webmanifest"]) {
  test(`seg-1: cabeceras de seguridad en ${ruta}`, async ({ request }) => {
    const respuesta = await request.get(ruta);
    expect(respuesta.status()).toBe(200);
    const cabeceras = respuesta.headers();
    expect(cabeceras["x-content-type-options"]).toBe("nosniff");
    expect(cabeceras["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(cabeceras["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(cabeceras["x-powered-by"]).toBeUndefined();
  });
}
