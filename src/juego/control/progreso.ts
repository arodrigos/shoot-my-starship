import type { EstadisticasPartida, ParteDeGuerra } from "@/sim/partida/parteDeGuerra";

// partida-5: degradación con gracia sin almacenamiento -- mismo patrón
// try/catch de store.ts (CLAVE_AYUDA_VISTA), pero con esquema versionado
// (partida-4/5 lo exigen: rival elegido y resumen de la última partida, no
// un flag suelto) que se descarta en silencio si no valida, en vez de
// lanzar y romper el arranque.
const CLAVE_PROGRESO = "partida-completa:progreso";
const VERSION_PROGRESO = 1;

export interface UltimaPartida {
  readonly medalla: string;
  readonly texto: string;
  readonly estadisticas: EstadisticasPartida;
}

export interface Progreso {
  readonly version: 1;
  readonly rivalId: string | null;
  readonly ultimaPartida: UltimaPartida | null;
}

function progresoVacio(): Progreso {
  return { version: VERSION_PROGRESO, rivalId: null, ultimaPartida: null };
}

function esEstadisticasValidas(valor: unknown): valor is EstadisticasPartida {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<string, unknown>;
  return (
    typeof v.disparos === "number" &&
    typeof v.fallos === "number" &&
    typeof v.autoimpactos === "number" &&
    typeof v.danioHechoAlEnemigo === "number" &&
    typeof v.pixelesDestruidos === "number"
  );
}

function esProgresoValido(valor: unknown): valor is Progreso {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<string, unknown>;
  if (v.version !== VERSION_PROGRESO) return false;
  if (v.rivalId !== null && typeof v.rivalId !== "string") return false;
  if (v.ultimaPartida === null) return true;
  if (typeof v.ultimaPartida !== "object") return false;
  const u = v.ultimaPartida as Record<string, unknown>;
  return typeof u.medalla === "string" && typeof u.texto === "string" && esEstadisticasValidas(u.estadisticas);
}

// El único punto de la sesión donde se decide si el aviso de partida-5 debe
// aparecer: un sondeo de escritura real, no una suposición sobre el
// navegador -- localStorage puede existir y aun así lanzar (cuota agotada,
// modo privado estricto en algunos navegadores).
export function almacenamientoDisponible(): boolean {
  try {
    const clave = "partida-completa:sondeo";
    window.localStorage.setItem(clave, "1");
    window.localStorage.removeItem(clave);
    return true;
  } catch {
    return false;
  }
}

export function leerProgreso(): Progreso {
  try {
    const bruto = window.localStorage.getItem(CLAVE_PROGRESO);
    if (!bruto) return progresoVacio();
    const datos: unknown = JSON.parse(bruto);
    return esProgresoValido(datos) ? datos : progresoVacio();
  } catch {
    return progresoVacio();
  }
}

function guardar(progreso: Progreso): void {
  try {
    window.localStorage.setItem(CLAVE_PROGRESO, JSON.stringify(progreso));
  } catch {
    // Sin almacenamiento el juego se juega igual (partida-5): la próxima
    // visita simplemente vuelve a ver el estado vacío.
  }
}

export function guardarRivalElegido(rivalId: string): void {
  guardar({ ...leerProgreso(), rivalId });
}

export function guardarUltimaPartida(parte: ParteDeGuerra, estadisticas: EstadisticasPartida): void {
  guardar({ ...leerProgreso(), ultimaPartida: { medalla: parte.medalla, texto: parte.texto, estadisticas } });
}
