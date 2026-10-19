// «Calculando el turno…» junto a la consola mientras el trabajador cierra el
// turno y la animación del impacto ya ha terminado: la pantalla nunca se queda
// quieta sin decir por qué. DOM mínimo, como indicadorApuntandoIA, para no
// depender de un setState desde Phaser.
const ID = "calculando-turno";

export function mostrarCalculandoTurno(): void {
  let caja = document.querySelector<HTMLElement>(`[data-testid="${ID}"]`);
  if (!caja) {
    caja = document.createElement("div");
    caja.setAttribute("data-testid", ID);
    caja.setAttribute("role", "status");
    caja.style.cssText =
      "position:fixed;z-index:50;padding:6px 12px;border-radius:999px;transform:translateX(-50%);" +
      "background:rgba(10,14,30,.88);color:#fff;font:600 14px/1.3 system-ui,sans-serif;pointer-events:none;white-space:nowrap";
    caja.textContent = "Calculando el turno…";
    document.body.appendChild(caja);
  }
  // Pegada a la parte alta de la consola; sin consola visible, abajo y al centro.
  const consola = document.querySelector<HTMLElement>('[data-testid="consola"]')?.getBoundingClientRect();
  if (consola !== undefined && consola.width > 0 && consola.height > 0) {
    caja.style.left = `${consola.left + consola.width / 2}px`;
    caja.style.bottom = `${Math.max(8, window.innerHeight - consola.top + 8)}px`;
  } else {
    caja.style.left = "50%";
    caja.style.bottom = "12px";
  }
}

export function ocultarCalculandoTurno(): void {
  document.querySelector(`[data-testid="${ID}"]`)?.remove();
}
