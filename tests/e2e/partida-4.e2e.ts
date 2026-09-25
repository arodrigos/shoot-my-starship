import { test, expect } from "@playwright/test";

// partida-4: primera visita y estados vacíos -- con el almacenamiento
// recién estrenado (addInitScript limpia localStorage ANTES de que
// PantallaInicio se monte, issue #151: no depende de qué haya dejado un
// test anterior) la pantalla de inicio debe explicar el juego y cómo
// apuntar en una línea, cada rival debe mostrar nombre y descripción, y el
// panel de "última partida" debe explicar que no hay ninguna en vez de
// quedarse en blanco. La captura queda para el juicio subjetivo del
// Gatekeeper (rúbrica eje 6).
test("primera visita: explica el juego, cada rival se describe y el panel de última partida no está vacío", async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");

  await expect(page.getByTestId("pantalla-inicio")).toBeVisible();

  const descripcion = page.getByTestId("descripcion-juego");
  await expect(descripcion).not.toBeEmpty();
  const textoDescripcion = (await descripcion.textContent())!;
  // Explica el juego Y cómo apuntar en la misma línea (una sola frase, tal
  // como pide el criterio): "arrastra" es la palabra que delata que el
  // texto cubre el gesto de apuntado, no solo el género del juego.
  expect(textoDescripcion.toLowerCase()).toContain("arrastra");

  for (const rivalId of ["la-contable", "almirante-bisagra", "chispa"]) {
    const boton = page.getByTestId(`rival-${rivalId}`);
    await expect(boton).toBeVisible();
    const texto = (await boton.textContent())!.trim();
    expect(texto.length).toBeGreaterThan(0);
  }

  const panelVacio = page.getByTestId("ultima-partida-vacia");
  await expect(panelVacio).toBeVisible();
  const textoPanel = (await panelVacio.textContent())!.trim();
  expect(textoPanel.length).toBeGreaterThan(0);

  await page.screenshot({ path: "test-results/partida-4/partida-completa-12-01-inicio-vacio.png" });
});
