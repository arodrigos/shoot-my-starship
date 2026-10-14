import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { JSDOM } from "jsdom";

// ma-3: invariantes de menu-ajustes sobre el componente real renderizado en
// jsdom (sin mocks del store): abrir o cerrar el menú nunca toca localStorage
// y lo que muestra cada interruptor coincide con el store en todo momento.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
g.localStorage = dom.window.localStorage;
g.HTMLElement = dom.window.HTMLElement;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

type Accion = "boton" | "cerrar" | "escape" | "disparo" | "sacudida" | "sonido" | "musica" | "voz";
const acciones = fc.array(
  fc.constantFrom<Accion>("boton", "cerrar", "escape", "disparo", "sacudida", "sonido", "musica", "voz"),
  { minLength: 1, maxLength: 25 },
);

test("ma-3: abrir/cerrar el menú no escribe en localStorage y los interruptores reflejan el store", async () => {
  const { createRoot } = await import("react-dom/client");
  const { act, createElement } = await import("react");
  const { MenuAjustesHUD } = await import("@/juego/hud/MenuAjustesHUD");
  const store = await import("@/juego/control/store");

  const contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  const raiz = createRoot(contenedor);
  await act(async () => raiz.render(createElement(MenuAjustesHUD)));

  const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const instantanea = () => JSON.stringify(Object.entries(localStorage).sort());
  const pulsar = async (id: string) => {
    const el = q(id);
    if (el !== null && !(el as HTMLButtonElement).disabled) await act(async () => el.click());
  };

  await fc.assert(
    fc.asyncProperty(acciones, async (secuencia) => {
      for (const accion of secuencia) {
        const antes = instantanea();
        const esMenu = accion === "boton" || accion === "cerrar" || accion === "escape" || accion === "disparo";
        if (accion === "boton") await pulsar("boton-ajustes");
        if (accion === "cerrar") await pulsar("cerrar-ajustes");
        if (accion === "escape")
          await act(async () => {
            document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          });
        if (accion === "disparo")
          await act(async () => {
            store.publicarJugable(true);
            store.publicarJugable(false);
          });
        if (accion === "sacudida") await pulsar("toggle-sacudida");
        if (accion === "sonido") await pulsar("toggle-silenciado");
        if (accion === "musica") await pulsar("toggle-musica");
        if (accion === "voz") await pulsar("toggle-voz");
        if (esMenu) assert.equal(instantanea(), antes, `la acción ${accion} del menú escribió en localStorage`);

        const estado = store.obtenerEstadoControl();
        const abierto = q("boton-ajustes")!.getAttribute("aria-expanded") === "true";
        assert.equal(q("panel-ajustes") !== null, abierto);
        if (abierto) {
          assert.equal(q("toggle-sacudida")!.getAttribute("aria-pressed"), String(estado.sacudidaActiva));
          assert.equal(q("toggle-silenciado")!.getAttribute("aria-pressed"), String(!estado.silenciado));
          assert.equal(q("toggle-musica")!.getAttribute("aria-pressed"), String(estado.musicaActiva));
          assert.equal(q("toggle-voz")!.getAttribute("aria-pressed"), String(estado.vozActiva && estado.vozDisponible));
        }
      }
    }),
    { numRuns: 30 },
  );
  await act(async () => raiz.unmount());
});
