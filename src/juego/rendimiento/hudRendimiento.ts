import type { MedidorFrames } from "@/juego/rendimiento/medidorFrames";
import type { MedidorRespuesta } from "@/juego/rendimiento/medidorRespuesta";

// HUD de solo lectura para medir en el dispositivo real (?rendimiento=1). No
// hace peticiones; se refresca cada 500 ms, nunca por frame.
export function montarHudRendimiento(medidor: MedidorFrames, respuesta: MedidorRespuesta): () => void {
  const caja = document.createElement("div");
  caja.setAttribute("data-testid", "hud-rendimiento");
  caja.setAttribute("aria-hidden", "true");
  caja.style.cssText =
    "position:fixed;top:4px;left:4px;z-index:2147483000;padding:2px 6px;border-radius:4px;" +
    "background:rgba(0,0,0,.7);color:#9f9;font:12px/1.3 monospace;pointer-events:none;white-space:pre";
  document.body.appendChild(caja);
  const pintar = (): void => {
    const i = medidor.instantanea();
    caja.textContent = `p95 ${i.p95.toFixed(1)} ms\nmax ${i.max.toFixed(1)} ms\nlargos ${i.framesLargos}\nINP ${respuesta.instantanea().inp.toFixed(0)} ms`;
  };
  pintar();
  const id = window.setInterval(pintar, 500);
  return () => {
    window.clearInterval(id);
    caja.remove();
  };
}
