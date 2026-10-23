import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Cuenta violaciones E «incomplete» de color-contrast: axe deja en
// «incomplete» lo que no puede medir (fondos con alfa sobre el lienzo), y eso
// sería un falso verde si solo se mirasen las violaciones.
export async function comprobarContrasteHud(
  page: Page,
  selectores: readonly string[],
): Promise<{ violaciones: number; incompletos: number; detalle: string[] }> {
  const resultado = await new AxeBuilder({ page }).include([...selectores]).withRules(["color-contrast"]).analyze();
  const detalle: string[] = [];
  // Un glifo decorativo (⚙, flechas, iconos) con aria-hidden no es texto: axe
  // lo deja en «incomplete» con messageKey nonBmp y no hay nada que medir.
  const esGlifo = (nodo: (typeof resultado.incomplete)[number]["nodes"][number]) =>
    nodo.any.some((c) => (c.data as { messageKey?: string } | null)?.messageKey === "nonBmp");
  const incompletos = resultado.incomplete.flatMap((r) => r.nodes).filter((n) => !esGlifo(n));
  for (const regla of resultado.violations) for (const nodo of regla.nodes) detalle.push(`violación: ${nodo.target.join(" ")} -- ${nodo.failureSummary ?? ""}`);
  for (const nodo of incompletos) detalle.push(`incomplete: ${nodo.target.join(" ")} -- ${nodo.failureSummary ?? ""}`);
  return {
    violaciones: resultado.violations.reduce((n, r) => n + r.nodes.length, 0),
    incompletos: incompletos.length,
    detalle,
  };
}
