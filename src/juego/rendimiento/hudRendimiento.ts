import type { MedidorFrames } from "@/juego/rendimiento/medidorFrames";
import type { MedidorRespuesta } from "@/juego/rendimiento/medidorRespuesta";

export const LIMITE_RESPUESTA_MS = 200;

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
    const r = respuesta.instantanea();
    const maxDuracion = r.interacciones.reduce((m, x) => Math.max(m, x.duracion), 0);
    const maxRetraso = r.interacciones.reduce((m, x) => Math.max(m, x.retrasoEntrada), 0);
    const peor = Math.max(maxDuracion, maxRetraso, r.inp);
    const dentro = peor <= LIMITE_RESPUESTA_MS;
    caja.style.color = dentro ? "#9f9" : "#f88";
    caja.textContent =
      `p95 ${i.p95.toFixed(1)} ms\nmax ${i.max.toFixed(1)} ms\nlargos ${i.framesLargos}\n` +
      `INP ${r.inp.toFixed(0)} ms\nmáx duración ${maxDuracion.toFixed(0)} ms\nmáx retraso ${maxRetraso.toFixed(0)} ms\n` +
      (dentro ? "Respuesta ≤ 200 ms" : `Supera 200 ms (${peor.toFixed(0)} ms)`);
    caja.dataset.veredicto = dentro ? "verde" : "rojo";
  };
  pintar();
  const id = window.setInterval(pintar, 500);
  return () => {
    window.clearInterval(id);
    caja.remove();
  };
}
