// «<nombre> está apuntando…» mientras la IA calcula en el trabajador. Es un
// aviso DOM mínimo, no un componente React, para no depender de un setState
// desde Phaser. El nombre entra como textContent: nunca se interpreta como HTML.
const ID = "apuntando-ia";

export function mostrarApuntandoIA(nombre: string): void {
  let caja = document.querySelector<HTMLElement>(`[data-testid="${ID}"]`);
  if (!caja) {
    caja = document.createElement("div");
    caja.setAttribute("data-testid", ID);
    caja.setAttribute("role", "status");
    caja.style.cssText =
      "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:50;padding:6px 12px;border-radius:999px;" +
      "background:rgba(10,14,30,.85);color:#fff;font:600 14px/1.3 system-ui,sans-serif;pointer-events:none;max-width:90vw;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
    document.body.appendChild(caja);
  }
  caja.textContent = `${nombre} está apuntando…`;
}

export function ocultarApuntandoIA(): void {
  document.querySelector(`[data-testid="${ID}"]`)?.remove();
}
