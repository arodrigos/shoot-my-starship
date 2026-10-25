import type { MedidorFrames } from "@/juego/rendimiento/medidorFrames";
import type { MedidorRespuesta } from "@/juego/rendimiento/medidorRespuesta";
import type { LatenciaInteraccion } from "@/juego/rendimiento/latenciasApuntado";
import { engancharToquesHud, observarZona } from "@/juego/camara/zonasOcupadas";
import { fijarCopiaMedicion, guardarResolutorCopia, iniciarPartidaMedicion, obtenerMedicion, type EstadoMedicion } from "@/juego/control/medicionStore";

export const LIMITE_RESPUESTA_MS = 200;

// HUD de solo lectura para medir en el dispositivo real (?rendimiento=1). No
// hace peticiones; se refresca cada 500 ms, nunca por frame.
export function montarHudRendimiento(medidor: MedidorFrames, respuesta: MedidorRespuesta, latencias: () => readonly LatenciaInteraccion[]): () => void {
  // El contenedor no recoge toques: solo el botón «Medir» (el texto se repinta
  // cada 500 ms y no puede ser el objetivo de un toque).
  const contenedor = document.createElement("div");
  contenedor.setAttribute("data-testid", "hud-rendimiento");
  contenedor.style.cssText = "position:fixed;top:4px;left:4px;z-index:2147483000;pointer-events:none;display:flex;flex-direction:column;align-items:flex-start;gap:4px";
  const caja = document.createElement("div");
  caja.setAttribute("data-testid", "hud-rendimiento-texto");
  caja.setAttribute("aria-hidden", "true");
  caja.style.cssText = "padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.7);color:#9f9;font:12px/1.3 monospace;white-space:pre";
  const boton = document.createElement("button");
  boton.type = "button";
  boton.setAttribute("data-testid", "medir-rendimiento");
  boton.setAttribute("aria-label", "Medir rendimiento");
  boton.textContent = "Medir";
  boton.style.cssText =
    "min-width:44px;min-height:44px;padding:0 12px;border-radius:6px;border:1px solid #9f9;background:rgba(0,0,0,.8);" +
    "color:#9f9;font:600 14px/1 monospace;pointer-events:auto;touch-action:manipulation";
  // La copia se arma aquí, en el toque y sin ningún await antes: WebKit solo
  // deja escribir en el portapapeles dentro del gesto del usuario.
  boton.addEventListener("click", () => {
    if (obtenerMedicion().estado === "en-curso") return;
    let copia: EstadoMedicion["copia"] = "pendiente";
    if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function") {
      const blob = new Promise<Blob>((resolver, rechazar) => {
        guardarResolutorCopia((texto) => resolver(new Blob([texto], { type: "text/plain" })), rechazar);
      });
      try {
        navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]).then(
          () => fijarCopiaMedicion("copiada"),
          () => fijarCopiaMedicion("fallida"),
        );
      } catch {
        copia = "fallida";
      }
    } else {
      copia = "no-soportada";
    }
    iniciarPartidaMedicion(respuesta.instantanea().inp, copia);
  });
  contenedor.append(caja, boton);
  document.body.appendChild(contenedor);
  // El recuadro es una zona más para la cámara: ninguna nave debe quedar bajo él.
  engancharToquesHud();
  const quitarZona = observarZona("rendimiento", contenedor, () => true);
  const pintar = (): void => {
    const i = medidor.instantanea();
    const r = respuesta.instantanea();
    const maxDuracion = r.interacciones.reduce((m, x) => Math.max(m, x.duracion), 0);
    const maxRetraso = r.interacciones.reduce((m, x) => Math.max(m, x.retrasoEntrada), 0);
    const peor = Math.max(maxDuracion, maxRetraso, r.inp);
    const dentro = peor <= LIMITE_RESPUESTA_MS;
    const todas = latencias();
    const ultima = todas.findLast((l) => l.nombre === "apuntado");
    const ultimaRastro = todas.findLast((l) => l.nombre === "rastro");
    const ultimaReloj = todas.findLast((l) => l.nombre === "reloj-turno");
    const ultimoDisparo = todas.findLast((l) => l.nombre === "disparo");
    const ultimoGestoCamara = todas.findLast((l) => l.nombre === "gesto-camara");
    const ultimoVerTodo = todas.findLast((l) => l.nombre === "ver-todo");
    const ultimoReencuadre = todas.findLast((l) => l.nombre === "reencuadre");
    caja.style.color = dentro ? "#9f9" : "#f88";
    caja.textContent =
      `p95 ${i.p95.toFixed(1)} ms\nmax ${i.max.toFixed(1)} ms\nlargos ${i.framesLargos}\n` +
      `INP ${r.inp.toFixed(0)} ms\nmáx duración ${maxDuracion.toFixed(0)} ms\nmáx retraso ${maxRetraso.toFixed(0)} ms\n` +
      `apuntado: ${ultima === undefined ? "–" : `${ultima.ms.toFixed(0)} ms`}\n` +
      `rastro: ${ultimaRastro === undefined ? "–" : `${ultimaRastro.ms.toFixed(0)} ms`}\n` +
      `reloj-turno: ${ultimaReloj === undefined ? "–" : `${ultimaReloj.ms.toFixed(0)} ms`}\n` +
      `disparo: ${ultimoDisparo === undefined ? "–" : `${ultimoDisparo.ms.toFixed(0)} ms`}\n` +
      `gesto-camara: ${ultimoGestoCamara === undefined ? "–" : `${ultimoGestoCamara.ms.toFixed(0)} ms`}\n` +
      `ver-todo: ${ultimoVerTodo === undefined ? "–" : `${ultimoVerTodo.ms.toFixed(0)} ms`}\n` +
      `reencuadre: ${ultimoReencuadre === undefined ? "–" : `${ultimoReencuadre.ms.toFixed(0)} ms`}\n` +
      (dentro ? "Respuesta ≤ 200 ms" : `Supera 200 ms (${peor.toFixed(0)} ms)`);
    contenedor.dataset.veredicto = dentro ? "verde" : "rojo";
  };
  pintar();
  const id = window.setInterval(pintar, 500);
  return () => {
    window.clearInterval(id);
    quitarZona();
    contenedor.remove();
  };
}
