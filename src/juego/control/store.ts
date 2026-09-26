import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import type { EntradaDeTurno } from "@/sim/partida/tipos";
import {
  ANGULO_INICIAL_GRADOS,
  POTENCIA_INICIAL,
  anguloConPasoFino,
  anguloTrasArrastre,
  potenciaTrasArrastre,
  type FraccionDeVentana,
} from "@/juego/control/apuntado";

// Puente entre React (ControlHUD, fuera del lienzo) y la escena de Phaser
// (que sí sabe de terreno y física): un módulo-singleton con
// suscribir/publicar, siguiendo la regla del diseño de que el control que no
// necesita saber dónde está el terreno vive fuera del lienzo. Disparar SÍ lo
// necesita, así que aquí solo se guarda la intención (`ajuste`) y quien la
// resuelve es el manejador que registra Partida.ts.
export interface EstadoAjuste {
  readonly anguloGrados: number;
  readonly potencia: number;
  readonly armaId: string;
}

export interface EstadoControl {
  readonly ajuste: EstadoAjuste;
  readonly usosPorArma: Readonly<Record<string, number>>;
  readonly ultimoDisparo: EstadoAjuste | null;
  // Publicado por la escena: turno del jugador, partida en curso y sin
  // animación de vuelo -- el HUD no reimplementa esa condición por su cuenta.
  readonly puedeDisparar: boolean;
  readonly ayudaVisible: boolean;
  // render-espacio: qué frase extra añade la ayuda inicial (planetas,
  // trayectoria curva) -- lo fija la escena en create(), antes de que el
  // HUD pinte el primer fotograma.
  readonly modoEspacial: boolean;
}

const CLAVE_AYUDA_VISTA = "control-apuntado:ayuda-vista";

function ayudaYaVista(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_AYUDA_VISTA) === "1";
  } catch {
    return false;
  }
}

function marcarAyudaVista(): void {
  try {
    window.localStorage.setItem(CLAVE_AYUDA_VISTA, "1");
  } catch {
    // Almacenamiento no disponible (navegación privada, cuota agotada...):
    // la ayuda volverá a aparecer la próxima vez, que es un fallo visible y
    // sin consecuencias, no una excepción sin capturar.
  }
}

let estado: EstadoControl = {
  ajuste: { anguloGrados: ANGULO_INICIAL_GRADOS, potencia: POTENCIA_INICIAL, armaId: CATALOGO_ARMAS[0].id },
  usosPorArma: {},
  ultimoDisparo: null,
  puedeDisparar: false,
  ayudaVisible: !ayudaYaVista(),
  modoEspacial: false,
};

const escuchas = new Set<() => void>();

function fijar(parcial: Partial<EstadoControl>): void {
  estado = { ...estado, ...parcial };
  for (const escucha of escuchas) escucha();
}

export function obtenerEstadoControl(): EstadoControl {
  return estado;
}

export function suscribirControl(escucha: () => void): () => void {
  escuchas.add(escucha);
  return () => escuchas.delete(escucha);
}

export function armaEstaAgotada(armaId: string): boolean {
  const arma = CATALOGO_ARMAS.find((candidata) => candidata.id === armaId);
  if (!arma || arma.usosMaximos === undefined) return false;
  return (estado.usosPorArma[armaId] ?? 0) >= arma.usosMaximos;
}

// Sesión de arrastre: vive fuera de EstadoControl a propósito -- ningún
// suscriptor necesita re-renderizar por el punto de inicio en sí, solo por
// el ajuste que produce, y guardarlo en el estado publicado obligaría a
// limpiarlo con un valor especial en vez de con la ausencia de campo.
let arrastreEnCurso: { fraccionInicio: FraccionDeVentana; ajusteInicio: EstadoAjuste } | null = null;

export function iniciarArrastre(fraccion: FraccionDeVentana): void {
  arrastreEnCurso = { fraccionInicio: fraccion, ajusteInicio: estado.ajuste };
}

export function actualizarArrastre(fraccion: FraccionDeVentana): void {
  if (!arrastreEnCurso) return;
  const { fraccionInicio, ajusteInicio } = arrastreEnCurso;
  fijar({
    ajuste: {
      ...estado.ajuste,
      anguloGrados: anguloTrasArrastre(ajusteInicio.anguloGrados, fraccionInicio, fraccion),
      potencia: potenciaTrasArrastre(ajusteInicio.potencia, fraccionInicio, fraccion),
    },
  });
}

export function terminarArrastre(): void {
  arrastreEnCurso = null;
}

export function ajustarAnguloFino(sentido: 1 | -1): void {
  fijar({ ajuste: { ...estado.ajuste, anguloGrados: anguloConPasoFino(estado.ajuste.anguloGrados, sentido) } });
}

export function seleccionarArma(armaId: string): void {
  if (armaEstaAgotada(armaId)) return;
  fijar({ ajuste: { ...estado.ajuste, armaId } });
}

export function repetirUltimoDisparo(): void {
  if (!estado.ultimoDisparo || armaEstaAgotada(estado.ultimoDisparo.armaId)) return;
  fijar({ ajuste: { ...estado.ultimoDisparo } });
}

export function publicarJugable(valor: boolean): void {
  if (estado.puedeDisparar !== valor) fijar({ puedeDisparar: valor });
}

export function fijarModoEspacial(valor: boolean): void {
  if (estado.modoEspacial !== valor) fijar({ modoEspacial: valor });
}

// Llamado por Partida.ts cuando el disparo del jugador ha terminado de
// resolverse (no al pulsar "Disparar", que solo entrega la intención): así
// "repetir último disparo" siempre precarga un tiro que de verdad ocurrió.
export function publicarDisparoJugadorResuelto(ajuste: EstadoAjuste): void {
  fijar({
    ultimoDisparo: ajuste,
    usosPorArma: { ...estado.usosPorArma, [ajuste.armaId]: (estado.usosPorArma[ajuste.armaId] ?? 0) + 1 },
  });
}

export function cerrarAyuda(): void {
  marcarAyudaVista();
  fijar({ ayudaVisible: false });
}

type ManejadorDisparo = (entrada: EntradaDeTurno) => void;
let manejadorDisparo: ManejadorDisparo | null = null;

export function registrarManejadorDisparo(manejador: ManejadorDisparo): () => void {
  manejadorDisparo = manejador;
  return () => {
    if (manejadorDisparo === manejador) manejadorDisparo = null;
  };
}

export function solicitarDisparo(): void {
  if (!estado.puedeDisparar || !manejadorDisparo) return;
  manejadorDisparo({ arma: estado.ajuste.armaId, anguloGrados: estado.ajuste.anguloGrados, potencia: estado.ajuste.potencia });
}

// partida-completa: "otra partida" reutiliza el mismo store (es un
// singleton de módulo, no ligado al ciclo de vida de React) para una nueva
// escena de Phaser -- sin esto, el ajuste, el arma agotada y el último
// disparo de la partida ya terminada seguirían vivos en la siguiente. La
// ayuda inicial NO se reinicia: ya la vio en este navegador, no hay que
// volver a enseñársela.
export function reiniciarControl(): void {
  fijar({
    ajuste: { anguloGrados: ANGULO_INICIAL_GRADOS, potencia: POTENCIA_INICIAL, armaId: CATALOGO_ARMAS[0].id },
    usosPorArma: {},
    ultimoDisparo: null,
    puedeDisparar: false,
    modoEspacial: false,
  });
}
