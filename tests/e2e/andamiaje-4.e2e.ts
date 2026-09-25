import { test, expect, chromium } from "@playwright/test";

// andamiaje-4: sin WebGL, el jugador tiene que ver un aviso legible, nunca
// un lienzo negro ni una excepción sin capturar. Se desactiva WebGL a nivel
// de flags del navegador (no confiando en que el entorno de CI carezca de
// GPU por accidente) para que la prueba sea determinista en cualquier
// máquina, issue #151.
test("sin WebGL se muestra un aviso en vez de fallar en silencio", async ({ baseURL }) => {
  const navegador = await chromium.launch({
    args: ["--disable-webgl", "--disable-webgl2", "--disable-gpu"],
  });

  try {
    const pagina = await navegador.newPage();
    const erroresNoCapturados: string[] = [];
    pagina.on("pageerror", (error) => erroresNoCapturados.push(error.message));

    await pagina.goto(baseURL ?? "http://127.0.0.1:3000");

    // getByRole("alert") a secas también encuentra el anunciador de rutas
    // de Next (mismo role, siempre vacío): se filtra por texto para quedarse
    // solo con el aviso de SinWebGL.
    const aviso = pagina.getByRole("alert").filter({ hasText: "WebGL" });
    await expect(aviso).toBeVisible();

    expect(erroresNoCapturados).toEqual([]);
  } finally {
    await navegador.close();
  }
});
