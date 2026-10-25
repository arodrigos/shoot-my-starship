// Zonas de pantalla que el HUD tapa (la consola, el botón ⚙, el recuadro de
// ?rendimiento=1), en px CSS del viewport. El HUD las publica y la escena las
// pasa al controlador de cámara: así la cámara sabe qué franjas no puede usar
// en vez de que cada aviso se coloque a mano alrededor de las naves.
import "@/debug/tipos";

export type IdZona = "consola" | "ajustes" | "rendimiento";

export interface ZonaOcupada {
  readonly id: IdZona;
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
  // false mientras la zona está apartada (la consola, en vuelo y en el turno del
  // rival): sigue publicada porque vuelve en el mismo sitio.
  readonly visible: boolean;
}

export interface RectCss {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

export interface DepuracionZonasCamara {
  readonly zonas: readonly ZonaOcupada[];
  readonly libre: RectCss;
  readonly objetivos: readonly { readonly tipo: "nave" | "proyectil" | "impacto"; readonly css: RectCss }[];
  readonly valido: boolean;
  readonly zoom: number;
  readonly modo: "auto" | "manual";
  readonly motivo: "inicial" | "turno" | "usuario" | "vuelo" | "ver-todo" | "degenerado" | null;
  readonly reencuadres: number;
}

const zonas = new Map<IdZona, ZonaOcupada>();
const escuchas = new Set<() => void>();
let instantanea: readonly ZonaOcupada[] = [];

function avisar(): void {
  instantanea = [...zonas.values()];
  for (const escucha of escuchas) escucha();
}

function iguales(a: ZonaOcupada, b: ZonaOcupada): boolean {
  return a.x === b.x && a.y === b.y && a.ancho === b.ancho && a.alto === b.alto && a.visible === b.visible;
}

export function publicarZona(id: IdZona, zona: Omit<ZonaOcupada, "id"> | null): void {
  if (zona === null) {
    if (zonas.delete(id)) avisar();
    return;
  }
  const nueva: ZonaOcupada = { id, ...zona };
  const previa = zonas.get(id);
  if (previa !== undefined && iguales(previa, nueva)) return;
  zonas.set(id, nueva);
  avisar();
}

export function obtenerZonas(): readonly ZonaOcupada[] {
  return instantanea;
}

export function suscribirZonas(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function limpiarZonas(): void {
  zonas.clear();
  avisar();
}

// Rectángulo del elemento más el de sus descendientes marcados con
// data-zona-extra: la fila ⇄ ▾ ✕ y la fila de avisos («Próximo evento…», muerte
// súbita, vuelo corto…) flotan fuera de la caja (position:absolute) y, si no se
// cuentan, la cámara deja una nave debajo. Una fila de avisos vacía mide ancho
// completo y alto 0: no debe ensanchar la zona.
export function medirZona(elemento: HTMLElement): RectCss {
  const r = elemento.getBoundingClientRect();
  let izq = r.left;
  let arr = r.top;
  let der = r.right;
  let aba = r.bottom;
  for (const extra of elemento.querySelectorAll("[data-zona-extra]")) {
    const e = extra.getBoundingClientRect();
    if (e.width === 0 || e.height === 0) continue;
    izq = Math.min(izq, e.left);
    arr = Math.min(arr, e.top);
    der = Math.max(der, e.right);
    aba = Math.max(aba, e.bottom);
  }
  return { x: izq, y: arr, ancho: der - izq, alto: aba - arr };
}

// Mide el elemento con ResizeObserver y con resize/orientationchange de la
// ventana, nunca por frame, y sin escribir estilos en lo que observa (un
// observador que cambia lo que mide acaba en un bucle de maquetación).
export function observarZona(id: IdZona, elemento: HTMLElement, visible: () => boolean): () => void {
  const medir = (): void => {
    publicarZona(id, { ...medirZona(elemento), visible: visible() });
  };
  medir();
  const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
  observador?.observe(elemento);
  // Los extras cuelgan fuera de la caja y su tamaño cambia sin que cambie el de
  // la raíz (aparece el pronóstico): se observan ellos también, y se vuelven a
  // enlazar cuando cambian sus hijos.
  const observados = new Set<Element>();
  const enlazarExtras = (): void => {
    if (observador === null) return;
    for (const extra of elemento.querySelectorAll("[data-zona-extra]")) {
      if (observados.has(extra)) continue;
      observados.add(extra);
      observador.observe(extra);
    }
  };
  enlazarExtras();
  const mutaciones =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(() => {
          enlazarExtras();
          medir();
        });
  mutaciones?.observe(elemento, { childList: true, subtree: true });
  window.addEventListener("resize", medir);
  window.addEventListener("orientationchange", medir);
  return () => {
    observador?.disconnect();
    mutaciones?.disconnect();
    window.removeEventListener("resize", medir);
    window.removeEventListener("orientationchange", medir);
    publicarZona(id, null);
  };
}

// zonasCamara es de solo lectura: devuelve copias, así que mutar lo que
// devuelve no cambia la cámara.
export function exponerDepuracionZonas(proveedor: () => DepuracionZonasCamara): () => void {
  window.__debug = window.__debug ?? {};
  window.__debug.zonasCamara = () => structuredClone(proveedor());
  return () => {
    if (window.__debug) delete window.__debug.zonasCamara;
  };
}

// Marca el toque que cambia el HUD para medir la latencia «reencuadre» hasta el
// primer frame con el encuadre nuevo. Se engancha una sola vez, en captura.
let marcaToque = 0;
let toqueEnganchado = false;
export function engancharToquesHud(): void {
  if (toqueEnganchado || typeof document === "undefined") return;
  toqueEnganchado = true;
  document.addEventListener(
    "click",
    (evento) => {
      if (!(evento.target instanceof Element) || evento.target.closest("[data-zona-hud]") === null) return;
      const nombre = `zona-toque-${marcaToque++}`;
      performance.mark(nombre);
      ultimoToque = nombre;
    },
    true,
  );
}
let ultimoToque: string | null = null;
export function tomarMarcaToque(): string | null {
  const m = ultimoToque;
  ultimoToque = null;
  return m;
}

// Rectángulos CSS de las naves vivas con la vista actual de la cámara: la capa
// de avisos (React) los lee para elegir un anclaje que no las pise. Solo los
// publica la escena; aquí no hay estado de juego.
let navesCss: readonly RectCss[] = [];
const escuchasNaves = new Set<() => void>();

export function publicarNavesCss(nuevas: readonly RectCss[]): void {
  const igual = nuevas.length === navesCss.length && nuevas.every((n, i) => Math.round(n.x) === Math.round(navesCss[i].x) && Math.round(n.y) === Math.round(navesCss[i].y) && Math.round(n.ancho) === Math.round(navesCss[i].ancho) && Math.round(n.alto) === Math.round(navesCss[i].alto));
  if (igual) return;
  navesCss = nuevas.map((n) => ({ ...n }));
  for (const escucha of escuchasNaves) escucha();
}

export function obtenerNavesCss(): readonly RectCss[] {
  return navesCss;
}

export function suscribirNaves(escucha: () => void): () => void {
  escuchasNaves.add(escucha);
  return () => escuchasNaves.delete(escucha);
}
