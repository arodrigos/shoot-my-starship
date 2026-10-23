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
  const recoger = (tipo: string, lista: typeof resultado.violations) => {
    for (const regla of lista) for (const nodo of regla.nodes) detalle.push(`${tipo}: ${nodo.target.join(" ")} -- ${nodo.failureSummary ?? ""}`);
  };
  recoger("violación", resultado.violations);
  recoger("incomplete", resultado.incomplete);
  return {
    violaciones: resultado.violations.reduce((n, r) => n + r.nodes.length, 0),
    incompletos: resultado.incomplete.reduce((n, r) => n + r.nodes.length, 0),
    detalle,
  };
}
