"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { IconoArmaGracioso, IconoEquipoGracioso } from "@/juego/hud/iconos/iconosArmas";
import { buscarEquipo, CATALOGO_EQUIPO } from "@/sim/equipo/catalogo";
import {
  actualizarArrastre,
  ajustarAnguloFino,
  ajustarPotenciaFino,
  alternarMusicaActiva,
  alternarVozActiva,
  sincronizarVoz,
  alternarSilenciado,
  armaEstaAgotada,
  cerrarAyuda,
  cerrarAyudaDispersion,
  costeDeArma,
  equipoYaActivo,
  fijarAnguloDesdeFraccion,
  motivoEquipoNoDisponible,
  seleccionarEquipo,
  fijarPotenciaDesdeFraccion,
  fijarSacudidaActiva,
  iniciarArrastre,
  obtenerEstadoControl,
  armaFaltaSaldo,
  repetirUltimoDisparo,
  seleccionarArma,
  solicitarDisparo,
  suscribirControl,
  terminarArrastre,
} from "@/juego/control/store";
import { estadoMusica, obtenerHistorialEfectos, sonidoSilenciado } from "@/juego/audio/motor";
import { obtenerLocutor } from "@/juego/audio/voz";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { obtenerResultadoTurno, suscribirResultadoTurno } from "@/juego/control/resultadoTurnoStore";
import { obtenerBromas, suscribirBromas } from "@/juego/control/broma";
import { IntegridadHUD } from "@/juego/hud/IntegridadHUD";
import { obtenerIntegridad, suscribirIntegridad } from "@/juego/control/integridadStore";
import { BromaHUD } from "@/juego/hud/BromaHUD";
import { FantasmasHUD } from "@/juego/hud/FantasmasHUD";
import { ObjetosHUD } from "@/juego/hud/ObjetosHUD";
import { RobotsHUD } from "@/juego/hud/RobotsHUD";
import { CartelEventoHUD, MuerteSubitaHUD, PronosticoHUD } from "@/juego/hud/UniversoHUD";
import { contarMensajes } from "@/juego/control/broma";
import { HistoricoBromasHUD } from "@/juego/hud/HistoricoBromasHUD";
import "@/debug/tipos";

// La cáscara React del control (fuera del lienzo, ver arquitectura): todo lo
// de aquí es matemática de pantalla o de UI, nunca de terreno -- si algo
// necesitase saber dónde está el suelo, iría dentro de Partida.ts, no aquí.
// esp-4: 44px (WCAG 2.2 SC 2.5.5), no los 24px de SC 2.5.8 que ya cubre
// control-2 -- este hito exige el umbral más alto para los controles que de
// verdad se disparan con el pulgar en 360x640.
const TAMANO_MINIMO_BOTON_PX = 44;
// pan-3: el botón de plegar es el único control que se pulsa con la consola
// escondida y a pulso, así que sube al tamaño de objetivo cómodo de 48 px.
const TAMANO_BOTON_PLEGAR_PX = 48;

function fraccionDeVentana(clienteX: number, clienteY: number): { x: number; y: number } {
  return { x: clienteX / window.innerWidth, y: clienteY / window.innerHeight };
}

// control-angulo-potencia: fracción del dedo DENTRO del propio control (0 en
// su borde izquierdo, 1 en el derecho) -- no de la ventana, que es la
// convención del arrastre combinado de más abajo -- para que el mapeo sea
// absoluto y cubra todo el eje en un solo gesto (ctl-2).
function fraccionDeControl(clienteX: number, elemento: HTMLElement): number {
  const rect = elemento.getBoundingClientRect();
  if (rect.width === 0) return 0;
  return (clienteX - rect.left) / rect.width;
}

// ctl-1: cada uno de los dos controles nuevos vive en su propio elemento y
// llama solo a la función de SU eje -- stopPropagation() evita que el gesto
// suba hasta la superficie de arrastre combinada de más abajo, que si lo
// recibiera movería el otro eje también.
function crearManejadoresEje(fijarDesdeFraccion: (fraccion: number) => void) {
  return {
    onPointerDown(evento: React.PointerEvent<HTMLDivElement>): void {
      evento.stopPropagation();
      evento.currentTarget.setPointerCapture(evento.pointerId);
      fijarDesdeFraccion(fraccionDeControl(evento.clientX, evento.currentTarget));
    },
    onPointerMove(evento: React.PointerEvent<HTMLDivElement>): void {
      evento.stopPropagation();
      if (evento.buttons === 0) return;
      fijarDesdeFraccion(fraccionDeControl(evento.clientX, evento.currentTarget));
    },
    onPointerUp(evento: React.PointerEvent<HTMLDivElement>): void {
      evento.stopPropagation();
    },
    onPointerCancel(evento: React.PointerEvent<HTMLDivElement>): void {
      evento.stopPropagation();
    },
  };
}

// El arrastre único de más abajo (legacy) cubre TODA la consola, incluidos
// estos botones -- si un gesto de ese arrastre arranca físicamente encima de
// uno de ellos, el navegador retarga el pointerup al botón (setPointerCapture
// del arrastre se fija sobre evento.target) y sintetiza un click ahí aunque
// el dedo haya terminado lejos, así que el paso fino se aplicaría de más justo
// al terminar un arrastre ajeno (visto en lay-6, que arranca su gesto al 90%
// del ancho, coincidiendo con estos botones). Se descarta el click cuando la
// distancia entre el descenso y la propia posición del click supera el
// umbral de un toque real.
const UMBRAL_ARRASTRE_PX = 8;
let descensoBotonPaso: { x: number; y: number } | null = null;

function alBajarBotonPaso(evento: React.PointerEvent<HTMLButtonElement>): void {
  descensoBotonPaso = { x: evento.clientX, y: evento.clientY };
}

function crearClicConToleranciaDeArrastre(accion: () => void) {
  return (evento: React.MouseEvent<HTMLButtonElement>): void => {
    const distancia = descensoBotonPaso
      ? Math.hypot(evento.clientX - descensoBotonPaso.x, evento.clientY - descensoBotonPaso.y)
      : 0;
    if (distancia > UMBRAL_ARRASTRE_PX) return;
    accion();
  };
}

// Un arrastre deja ángulos como 359,999997°: toFixed(1) los pintaría como
// «360,0°», que no existe en el rango [0, 360).
function textoAnguloGrados(grados: number): string {
  const decimas = Math.round(grados * 10) % 3600;
  return (decimas / 10).toFixed(1).replace(".", ",");
}

interface PropsControl {
  readonly plegada: boolean;
  readonly alAlternarPlegado: () => void;
  readonly alOcultar: () => void;
  readonly alMover: () => void;
}

// Icono del arma en la barra mínima: el mismo dibujo que la celda del selector,
// para que se reconozca sin leer el nombre (que no cabe junto a Disparar a
// 360 px).
function IconoArma({ armaId }: { readonly armaId: string }) {
  return (
    <span data-testid="icono-arma" style={{ display: "inline-flex" }}>
      <IconoArmaGracioso armaId={armaId} tamano={28} />
    </span>
  );
}

// Eje propio de las armas que no hacen daño: enseñar «Daño 0» de una
// utilitaria es mentir sobre lo que hace.
function textoEjeDeArma(arma: (typeof CATALOGO_ARMAS)[number]): string {
  if (arma.efecto.tipo === "empuje") return `Empuje: ${arma.efecto.desplazamientoPx} u`;
  if (arma.utilitaria === true && arma.huella.tipo === "circular") return `Relleno: ${Math.round(Math.PI * arma.huella.radio ** 2)} u²`;
  if (arma.efecto.tipo === "danio" || arma.efecto.tipo === "danio-y-autodanio") return `Daño: ${arma.efecto.danioMaximo}`;
  return "";
}

export function ControlHUD({ plegada, alAlternarPlegado, alOcultar, alMover }: PropsControl) {
  const estado = useSyncExternalStore(suscribirControl, obtenerEstadoControl, obtenerEstadoControl);
  const resultadoTurno = useSyncExternalStore(suscribirResultadoTurno, obtenerResultadoTurno, obtenerResultadoTurno);
  const navesEnPartida = useSyncExternalStore(suscribirIntegridad, obtenerIntegridad, obtenerIntegridad).naves.length;
  const bromas = useSyncExternalStore(suscribirBromas, obtenerBromas, obtenerBromas);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [pestana, setPestana] = useState<"armas" | "equipo">("armas");
  const [historicoAbierto, setHistoricoAbierto] = useState(false);
  const cerrarHistorico = useCallback(() => setHistoricoAbierto(false), []);
  useEffect(() => {
    window.__debug = window.__debug ?? {};
    window.__debug.historico = { abierto: historicoAbierto, mensajes: contarMensajes(obtenerBromas().historico) };
  }, [historicoAbierto, bromas.historico]);

  useEffect(() => {
    window.__debug = window.__debug ?? {};
    window.__debug.control = {
      ajuste: estado.ajuste,
      ultimoDisparo: estado.ultimoDisparo,
      puedeDisparar: estado.puedeDisparar,
      ayudaVisible: estado.ayudaVisible,
      usosPorArma: estado.usosPorArma,
      sacudidaActiva: estado.sacudidaActiva,
      silenciado: estado.silenciado,
    };
    window.__debug.modoEspacial = estado.modoEspacial;
    // sonido-procedimental (snd-2): función en vivo, no una instantánea --
    // los efectos de sonido se registran desde Partida.ts (Phaser) entre dos
    // renders de React, así que un valor fijado aquí quedaría obsoleto
    // (mismo motivo que estadoAudio, ver src/debug/tipos.ts).
    window.__debug.audio = () => ({ silenciado: sonidoSilenciado(), historial: obtenerHistorialEfectos() });
    // banda-sonora: en vivo por la misma razón que audio (las notas se
    // programan fuera del ciclo de React).
    window.__debug.musica = () => estadoMusica();
  }, [estado]);

  // voz-chistes: la disponibilidad de voz se resuelve en un momento que React
  // no ve (las voces del sistema cargan solas), así que el store la sigue
  // por suscripción.
  useEffect(() => {
    const locutor = obtenerLocutor();
    sincronizarVoz();
    window.__debug = window.__debug ?? {};
    window.__debug.voz = () => ({ ...locutor.estado(), llamadas: locutor.llamadas() });
    return locutor.suscribir(sincronizarVoz);
  }, []);

  useEffect(() => {
    window.__debug = window.__debug ?? {};
    window.__debug.resultadoTurno = resultadoTurno.texto;
  }, [resultadoTurno]);

  const armaSeleccionada = CATALOGO_ARMAS.find((arma) => arma.id === estado.ajuste.armaId) ?? CATALOGO_ARMAS[0];

  const manejadoresAngulo = crearManejadoresEje(fijarAnguloDesdeFraccion);
  const manejadoresPotencia = crearManejadoresEje(fijarPotenciaDesdeFraccion);
  const fraccionAngulo =
    (estado.ajuste.anguloGrados - ANGULO_MINIMO_GRADOS) / (ANGULO_MAXIMO_GRADOS - ANGULO_MINIMO_GRADOS);
  const fraccionPotencia = (estado.ajuste.potencia - POTENCIA_MINIMA) / (POTENCIA_MAXIMA - POTENCIA_MINIMA);

  function alPuntoDeArrastre(evento: React.PointerEvent<HTMLDivElement>): void {
    // layout-dos-zonas: la consola entera (ya separada del lienzo, ver
    // PhaserGame) es la superficie de apuntado -- ya no hace falta el filtro
    // por mitad de pantalla que existía cuando el HUD flotaba sobre el juego.
    (evento.target as HTMLElement).setPointerCapture(evento.pointerId);
    iniciarArrastre(fraccionDeVentana(evento.clientX, evento.clientY));
  }

  function alMoverArrastre(evento: React.PointerEvent<HTMLDivElement>): void {
    if (evento.buttons === 0) return;
    actualizarArrastre(fraccionDeVentana(evento.clientX, evento.clientY));
  }

  const enPresupuesto = estado.modo === "presupuesto";
  const equipoElegido = estado.equipoId === null ? null : buscarEquipo(estado.equipoId);
  const escudoYaPuesto = equipoYaActivo(estado.equipoId);
  // Con equipo elegido el botón de acción lo usa en vez de disparar; si es el
  // escudo y ya está puesto, dice por qué no se puede repetir (esc-1, esc-4).
  const etiquetaAccion = equipoElegido === null
    ? "Disparar"
    : escudoYaPuesto
      ? "Ya tienes el escudo activo"
      : `${equipoElegido.verboAccion}${enPresupuesto ? ` (${equipoElegido.coste} cr)` : ""}`;
  const accionDeshabilitada = !estado.puedeDisparar || escudoYaPuesto;
  const potenciaEnCero = Math.round(estado.ajuste.potencia) <= 0;
  // lay-6: motivo concreto de por qué "Disparar" no responde -- distinto de
  // puedeDisparar (que gobierna la escena: turno, animación en curso...) y
  // que por eso necesita su propio texto en vez de reusar el de la escena.
  // hud-canales-5: "disparar" ya viene disabled con !puedeDisparar (nunca se
  // encola un segundo disparo); esto solo pone en pantalla la causa concreta
  // -- vuelo en curso o turno del rival, las dos cosas que puedeDisparar ya
  // combina sin que el HUD reimplemente esa condición por su cuenta.
  // hud-canales (novena corrección): el texto largo de antes (hasta 112
  // caracteres, 3 líneas a 360px) era la mitad real del hueco que faltaba
  // en fila-avisos -- medido con una partida real, el aviso solo ya
  // necesitaba 52 de los 78px del hueco, dejando menos de lo que la broma
  // necesita incluso en su mínimo (minHeight 44). "Qué pasa y qué hacer"
  // cabe en una frase corta; el resto era repetir la condición de
  // puedeDisparar que el usuario ya ve en el botón Disparar deshabilitado.
  const avisoAccionImposible = potenciaEnCero && estado.equipoId !== "escudo"
    ? "Potencia a 0: arrastra arriba para cargar el disparo."
    : !estado.puedeDisparar
      ? "Espera a que termine el disparo."
      : null;

  const estiloBotonConsola = {
    ...botonEstilo,
    width: TAMANO_BOTON_PLEGAR_PX,
    height: TAMANO_BOTON_PLEGAR_PX,
    minWidth: TAMANO_BOTON_PLEGAR_PX,
    minHeight: TAMANO_BOTON_PLEGAR_PX,
    padding: 0,
    font: "20px system-ui, sans-serif",
  } as const;

  // Reducir y ampliar son el mismo botón (desplegada <-> mínima); ocultar y
  // mover son aparte, para que cada gesto tenga un nombre accesible propio.
  const botonPlegar = (
    <button
      type="button"
      data-testid="boton-plegar-consola"
      aria-expanded={!plegada}
      aria-label={plegada ? "Ampliar controles" : "Reducir controles"}
      title={plegada ? "Ampliar controles" : "Reducir controles"}
      onPointerDown={(evento) => evento.stopPropagation()}
      onClick={alAlternarPlegado}
      style={estiloBotonConsola}
    >
      <span aria-hidden="true">{plegada ? "▴" : "▾"}</span>
    </button>
  );

  const botonOcultar = (
    <button
      type="button"
      data-testid="boton-ocultar-consola"
      aria-label="Ocultar controles"
      title="Ocultar controles"
      onPointerDown={(evento) => evento.stopPropagation()}
      onClick={alOcultar}
      style={estiloBotonConsola}
    >
      <span aria-hidden="true">✕</span>
    </button>
  );

  const botonMover = (
    <button
      type="button"
      data-testid="boton-mover-consola"
      aria-label="Mover controles"
      title="Mover controles"
      onPointerDown={(evento) => evento.stopPropagation()}
      onClick={alMover}
      style={estiloBotonConsola}
    >
      <span aria-hidden="true">⇄</span>
    </button>
  );

  // pan-2: con la consola plegada se apunta en el lienzo (apuntado directo) y
  // aquí solo queda lo imprescindible para disparar sin desplegar nada.
  if (plegada) {
    const costeSeleccionada = costeDeArma(armaSeleccionada.id);
    return (
      <div
        data-testid="barra-minima"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "4px 8px",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {botonPlegar}
        <div data-testid="arma-minima" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, color: "var(--color-cromado-texto)", font: "12px system-ui, sans-serif" }}>
          {equipoElegido === null ? <IconoArma armaId={armaSeleccionada.id} /> : <IconoEquipoGracioso equipoId={equipoElegido.id} tamano={28} />}
          <span data-testid="precio-arma-minima">
            {equipoElegido !== null
              ? enPresupuesto ? `${equipoElegido.coste} cr` : "Sin coste"
              : enPresupuesto ? (costeSeleccionada > 0 ? `${costeSeleccionada} cr` : "Gratis") : "Sin coste"}
          </span>
        </div>
        <button
          type="button"
          data-testid="disparar"
          onClick={solicitarDisparo}
          disabled={accionDeshabilitada}
          style={{ ...botonEstilo, minHeight: TAMANO_BOTON_PLEGAR_PX, padding: "6px 14px", background: "#ff6b4a", whiteSpace: "normal", maxWidth: 150, lineHeight: 1.1 }}
        >
          {etiquetaAccion}
        </button>
      </div>
    );
  }

  return (
    // layout-dos-zonas: esta consola ocupa el 100% de su contenedor (la
    // franja inferior de PhaserGame, ya separada del lienzo) en un flujo
    // normal de filas -- nada de position:fixed disperso por el viewport,
    // que era justo lo que producía los solapes que este bloque corrige.
    <div
      style={{
        position: "relative",
        zIndex: 1,
        touchAction: "none",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
        // lay-3: "space-evenly" reparte el espacio libre EN NEGATIVO cuando
        // el contenido (p.ej. una broma real de dos líneas largas) no cabe
        // en el alto fijo de la consola -- eso separaba las filas con un
        // hueco negativo y las hacía solaparse de verdad (medido: el panel
        // de bromas empezaba antes de que terminase la fila del retículo).
        // "flex-start" + el `gap` fijo de abajo nunca produce huecos
        // negativos: si el contenido no cabe, se desborda hacia el scroll
        // de la consola (overflowY:auto), nunca hacia el solape.
        justifyContent: "flex-start",
        padding: "4px 8px",
        gap: 4,
        boxSizing: "border-box",
      }}
      onPointerDown={alPuntoDeArrastre}
      onPointerMove={alMoverArrastre}
      onPointerUp={terminarArrastre}
      onPointerCancel={terminarArrastre}
      data-testid="superficie-arrastre"
    >
      {/* Flota sobre el borde superior del panel (no dentro de su alto): el
          panel ya no tiene sitio libre en 360x640 con el tope del 45 %. */}
      <div style={{ position: "absolute", right: 0, top: -(TAMANO_BOTON_PLEGAR_PX + 4), display: "flex", gap: 4 }}>
        {botonMover}
        {botonPlegar}
        {botonOcultar}
      </div>
      {/* canal-estado (hud-canales-1): permanente -- de quién es el turno y
          el nombre del rival ya no son una fila propia (ver IntegridadHUD:
          resalta la nave de quien juega y sustituye su etiqueta genérica),
          porque esta sección ya agotaba casi todo el presupuesto de alto de
          la consola en 360x640 (lay-5: sin ni 2px de margen) y una fila
          nueva, o incluso un botón nuevo aquí dentro, la hacía desbordar la
          ventana -- el botón de histórico (gra-2, mismo criterio que
          CuentaAtrasHUD) vive fuera de la consola, superpuesto a la zona de
          juego con position:fixed, así que no reserva nada de su alto. */}
      <div data-testid="canal-estado" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {/* multi-setup-partida: con 3 o 4 barras de integridad ya no caben al
            lado del resumen del turno (lo estrechaban hasta una columna de una
            letra de ancho): pasan a su propia fila, a todo el ancho. */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: navesEnPartida > 2 ? "wrap" : "nowrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: navesEnPartida > 2 ? "100%" : "56%", minWidth: 0 }}>
          <div
            role="status"
            data-testid="resultado-turno"
            style={{
              background: "var(--color-cromado-fondo)",
              borderRadius: 10,
              padding: "6px 10px",
              color: "var(--color-cromado-texto)",
              font: "12px system-ui, sans-serif",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {resultadoTurno.texto}
          </div>
          {enPresupuesto && (
            <div
              data-testid="saldo"
              style={{
                background: "var(--color-cromado-fondo)",
                borderRadius: 10,
                padding: "4px 10px",
                color: "var(--color-cromado-texto)",
                font: "12px system-ui, sans-serif",
              }}
            >
              Saldo: {estado.saldo ?? 0} cr
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, ...(navesEnPartida > 2 ? { flex: "1 1 100%" } : {}) }}>
          <IntegridadHUD />
        </div>
        </div>

      </div>

      {/* hud-canales-3: "accesible desde el canal de estado" -- fixed, igual
          que CuentaAtrasHUD (gra-2), para que no compita por el presupuesto
          de alto/ancho de la consola, que ya está al límite. */}
      <button
        type="button"
        data-testid="historico-bromas-toggle"
        aria-expanded={historicoAbierto}
        onClick={() => setHistoricoAbierto((valor) => !valor)}
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          zIndex: 15,
          minHeight: 24,
          padding: "4px 10px",
          borderRadius: 8,
          border: "none",
          background: "var(--color-cromado-fondo)",
          color: "var(--color-cromado-texto)",
          font: "12px system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        Histórico{bromas.historico.length > 0 ? ` (${contarMensajes(bromas.historico)})` : ""}
      </button>

      {historicoAbierto && <HistoricoBromasHUD onCerrar={cerrarHistorico} />}

      {/* control-angulo-potencia: dos controles independientes de verdad --
          cada uno en su propio elemento, con su propio gesto de arrastre
          absoluto (ctl-1/ctl-2), su paso fino de botón y su lectura de valor
          en texto (ctl-5). El retículo conserva su rotación como referencia
          visual del ángulo, ahora dentro de la propia barra. */}
      <div data-testid="control-angulo" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
        <button type="button" data-testid="paso-angulo-menos" onPointerDown={alBajarBotonPaso} onClick={crearClicConToleranciaDeArrastre(() => ajustarAnguloFino(-1))} style={botonEstilo}>
          -0.1°
        </button>
        <div
          data-testid="barra-angulo"
          role="slider"
          aria-label="Ángulo"
          aria-valuemin={ANGULO_MINIMO_GRADOS}
          aria-valuemax={ANGULO_MAXIMO_GRADOS}
          aria-valuenow={estado.ajuste.anguloGrados}
          {...manejadoresAngulo}
          style={{
            position: "relative",
            flex: "1 1 auto",
            minWidth: 0,
            height: TAMANO_MINIMO_BOTON_PX,
            background: "var(--color-cromado-fondo)",
            borderRadius: 8,
            touchAction: "none",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <svg width={28} height={28} viewBox="0 0 60 60" data-testid="reticulo" style={{ flexShrink: 0, marginLeft: 4 }}>
            <circle cx={30} cy={56} r={2} fill="#5ac8fa" />
            <line
              x1={30}
              y1={56}
              x2={30 + 26 * Math.cos((estado.ajuste.anguloGrados * Math.PI) / 180)}
              y2={56 - 26 * Math.sin((estado.ajuste.anguloGrados * Math.PI) / 180)}
              stroke="#ff6b4a"
              strokeWidth={3}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.max(0, Math.min(1, fraccionAngulo)) * 100}%`,
              background: "rgba(255,107,74,0.18)",
              pointerEvents: "none",
            }}
          />
          <div
            data-testid="valor-angulo"
            style={{ marginLeft: "auto", marginRight: 8, color: "var(--color-cromado-texto)", font: "12px system-ui, sans-serif", pointerEvents: "none" }}
          >
            {textoAnguloGrados(estado.ajuste.anguloGrados)}°
          </div>
        </div>
        <button type="button" data-testid="paso-angulo-mas" onPointerDown={alBajarBotonPaso} onClick={crearClicConToleranciaDeArrastre(() => ajustarAnguloFino(1))} style={botonEstilo}>
          +0.1°
        </button>
      </div>

      <div data-testid="control-potencia" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
        <button type="button" data-testid="paso-potencia-menos" onPointerDown={alBajarBotonPaso} onClick={crearClicConToleranciaDeArrastre(() => ajustarPotenciaFino(-1))} style={botonEstilo}>
          -1%
        </button>
        <div
          data-testid="barra-potencia"
          role="slider"
          aria-label="Potencia"
          aria-valuemin={POTENCIA_MINIMA}
          aria-valuemax={POTENCIA_MAXIMA}
          aria-valuenow={estado.ajuste.potencia}
          {...manejadoresPotencia}
          style={{
            position: "relative",
            flex: "1 1 auto",
            minWidth: 0,
            height: TAMANO_MINIMO_BOTON_PX,
            background: "var(--color-cromado-fondo)",
            borderRadius: 8,
            touchAction: "none",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.max(0, Math.min(1, fraccionPotencia)) * 100}%`,
              background: "rgba(90,200,250,0.18)",
              pointerEvents: "none",
            }}
          />
          <div
            data-testid="valor-potencia"
            style={{ marginLeft: 10, color: "var(--color-cromado-texto)", font: "12px system-ui, sans-serif", pointerEvents: "none" }}
          >
            {Math.round(estado.ajuste.potencia)}%
          </div>
        </div>
        <button type="button" data-testid="paso-potencia-mas" onPointerDown={alBajarBotonPaso} onClick={crearClicConToleranciaDeArrastre(() => ajustarPotenciaFino(1))} style={botonEstilo}>
          +1%
        </button>
      </div>

      {/* potencia-dispersion (pot-6): aparece UNA vez por partida, la
          primera vez que la potencia cruza el umbral donde la dispersión
          empieza a notarse (ver store.ts) -- nunca más en los turnos
          siguientes de esta misma partida. */}
      {estado.ayudaDispersionVisible && (
        <div
          role="status"
          data-testid="ayuda-dispersion"
          onClick={cerrarAyudaDispersion}
          style={{
            width: "100%",
            flexShrink: 0,
            background: "var(--color-aviso-fondo)",
            border: "1px solid var(--color-aviso-borde)",
            borderRadius: 8,
            padding: "4px 8px",
            color: "var(--color-aviso-texto)",
            font: "12px system-ui, sans-serif",
            textAlign: "center",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            boxSizing: "border-box",
          }}
        >
          A tanta potencia el disparo pierde precisión: más alcance y menos curva, pero menos puntería.
        </div>
      )}

      {/* hud-canales (corrección): los dos interruptores vivían dentro de
          fila-avisos, alineados a la derecha igual que panel-bromas (ver más
          abajo) -- compartir ESE mismo borde derecho en una fila de apenas
          78px es lo que hacía que panel-bromas, al crecer más allá de dos
          líneas de texto, se dibujara encima de "Sacudida: On" (hallazgo del
          gatekeeper sobre la validación del hito arte-siluetas). Mismo patrón
          que historico-bromas-toggle: fixed, fuera del flujo de la consola,
          así que ninguna fila compite por su alto ni por su ancho con ellos. */}
      <div
        style={{
          position: "fixed",
          top: 10,
          right: 10,
          zIndex: 15,
          display: "flex",
          flexDirection: "row",
          gap: 6,
        }}
      >
        {/* realce-impacto (rlc-3): "no marea ni estorba" -- interruptor propio
            que persiste entre partidas (store). */}
        <button
          type="button"
          data-testid="toggle-sacudida"
          aria-pressed={estado.sacudidaActiva}
          onClick={() => fijarSacudidaActiva(!estado.sacudidaActiva)}
          title={estado.sacudidaActiva ? "Desactivar sacudida de impacto" : "Activar sacudida de impacto"}
          style={{
            minWidth: TAMANO_MINIMO_BOTON_PX,
            minHeight: TAMANO_MINIMO_BOTON_PX,
            padding: "0 8px",
            borderRadius: 8,
            border: "none",
            background: "var(--color-cromado-fondo)",
            color: "var(--color-cromado-texto)",
            font: "12px system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          Sacudida: {estado.sacudidaActiva ? "On" : "Off"}
        </button>
        {/* sonido-procedimental (snd-1): "siempre accesible" -- nunca dentro
            de un menú ni una pantalla aparte. El gesto de pulsar ESTE botón
            para activar sonido es, a la vez, el gesto de usuario que exige la
            política de autoplay (ver alternarSonido en motor.ts). */}
        <button
          type="button"
          data-testid="toggle-silenciado"
          aria-pressed={!estado.silenciado}
          onClick={() => alternarSilenciado()}
          title={estado.silenciado ? "Activar sonido" : "Silenciar"}
          style={{
            minWidth: TAMANO_MINIMO_BOTON_PX,
            minHeight: TAMANO_MINIMO_BOTON_PX,
            padding: "0 8px",
            borderRadius: 8,
            border: "none",
            background: "var(--color-cromado-fondo)",
            color: "var(--color-cromado-texto)",
            font: "12px system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          Sonido: {estado.silenciado ? "Off" : "On"}
        </button>
        <button
          type="button"
          data-testid="toggle-musica"
          aria-pressed={estado.musicaActiva}
          onClick={() => alternarMusicaActiva()}
          title={estado.musicaActiva ? "Quitar la música" : "Poner la música"}
          style={{
            minWidth: TAMANO_MINIMO_BOTON_PX,
            minHeight: TAMANO_MINIMO_BOTON_PX,
            padding: "0 8px",
            borderRadius: 8,
            border: "none",
            background: "var(--color-cromado-fondo)",
            color: "var(--color-cromado-texto)",
            font: "12px system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          Música: {estado.musicaActiva ? "Sí" : "No"}
        </button>
      </div>

      {/* voz-chistes: cuarto interruptor de la banda superior. En 360 px la
          fila de cuatro llegaba hasta el botón Histórico y lo tapaba, así que
          Voz va en su propia fila fija justo debajo (a 10 + 44 + 6 px). */}
      <div
        style={{
          position: "fixed",
          top: 60,
          right: 10,
          zIndex: 15,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          maxWidth: "min(260px, calc(100vw - 20px))",
        }}
      >
        {/* voz-chistes: sin voz castellana local el interruptor se
            deshabilita y el aviso explica por qué (voz-3). */}
        <button
          type="button"
          data-testid="toggle-voz"
          aria-pressed={estado.vozActiva && estado.vozDisponible}
          disabled={!estado.vozDisponible}
          onClick={() => alternarVozActiva()}
          title={
            !estado.vozDisponible
              ? (estado.avisoVoz ?? "Sin voz en castellano")
              : estado.vozActiva
                ? "Callar la voz de los chistes"
                : "Leer los chistes en voz alta"
          }
          style={{
            minWidth: TAMANO_MINIMO_BOTON_PX,
            minHeight: TAMANO_MINIMO_BOTON_PX,
            padding: "0 8px",
            borderRadius: 8,
            border: "none",
            background: "var(--color-cromado-fondo)",
            color: "var(--color-cromado-texto)",
            font: "12px system-ui, sans-serif",
            cursor: estado.vozDisponible ? "pointer" : "not-allowed",
            opacity: estado.vozDisponible ? 1 : 0.6,
          }}
        >
          Voz: {estado.vozActiva && estado.vozDisponible ? "On" : "Off"}
        </button>
        {estado.avisoVoz !== null && (
          <span data-testid="voz-aviso" role="status" style={{ textAlign: "right", font: "11px system-ui, sans-serif", color: "var(--color-cromado-texto)" }}>
            {estado.avisoVoz}
          </span>
        )}
      </div>

      {/* fila-avisos (hud-canales-1, quinta corrección): roce, aviso y broma
          ya no comparten el ANCHO de una fila -- compartirlo era lo que
          ocultaba el 59% del aviso en cuanto la broma también estaba
          visible (el gatekeeper midió el aviso reducido a 83 de 164px). Se
          apilan en columna, cada uno a ancho completo, así que ninguno le
          quita sitio a otro. La altura sigue sin ser fija en el estado
          vacío inicial (sin roce, sin aviso y sin broma todavía: la fila
          mide 0, que es justo lo que le faltaba al botón Disparar para no
          salir cortado) -- pero en cuanto se publica la primera broma
          (bromas.clave > 0, y hum-1 garantiza que eso pasa en todo turno,
          "sin excepción") la fila pasa a altura FIJA de 78px para siempre,
          en vez de seguir el contenido. hud-canales-1 (sexta corrección):
          con altura por contenido, descartar la broma (lay-4) encogía la
          fila y desplazaba fila-armas entera -- el propio criterio exige
          que los controles no se muevan al descartar. 78px es el mismo
          tope que tenía la versión de altura fija (lo que de verdad cabe
          junto al resto de filas en los 268.8px de consola a 360x640); si
          los tres juntos lo superan, se leen con scroll (mismo patrón que
          ya usan sus hijos) en vez de empujar fila-armas fuera del
          viewport. */}
      <div
        data-testid="fila-avisos"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          // hud-canales (octava corrección, revertida en la novena): subir
          // esto a 96 e invadir la fracción del lienzo (ver
          // layoutContenedor.ts) no llegaba ni de lejos a los 134px reales
          // que mide una partida real con aviso largo + broma -- y sí rompía
          // encuadre-movil-2. El aviso de "espera a que termine el disparo"
          // convive con la broma en TODO turno propio -- !puedeDisparar ya
          // es cierto en cuanto el proyectil sale volando -- así que la
          // novena corrección ataca la causa real (el texto del aviso,
          // acortado donde se define avisoAccionImposible) en vez de pedirle
          // más alto a esta fila. flexShrink:0 en los dos hijos (más abajo)
          // evita que el flex los comprima por debajo de su propio
          // contenido; si de verdad no caben los dos a la vez (un aviso
          // largo con una broma larga), esta fila es la que se desplaza con
          // su propio overflowY, nunca los hijos recortando glifos a medias.
          // consola-compacta: con la consola al 40 % del alto no queda sitio
          // para esta fila dentro del panel. Flota sobre su borde superior,
          // por encima de la fila de botones de la consola, y no recibe
          // toques (la broma y su cierre los reactivan por su cuenta).
          position: "absolute",
          left: 0,
          right: 0,
          bottom: `calc(100% + ${TAMANO_BOTON_PLEGAR_PX + 8}px)`,
          maxHeight: 150,
          overflowY: "auto",
          pointerEvents: "none",
        }}
      >
        <FantasmasHUD />
        <RobotsHUD />
        <ObjetosHUD />
        <MuerteSubitaHUD />
        <PronosticoHUD />
        <CartelEventoHUD />
        {avisoAccionImposible && (
          <div
            role="status"
            data-testid="aviso-accion-imposible"
            style={{
              width: "100%",
              flexShrink: 0,
              maxHeight: 70,
              overflowY: "auto",
              background: "var(--color-aviso-fondo)",
              border: "1px solid var(--color-aviso-borde)",
              borderRadius: 8,
              padding: "4px 8px",
              color: "var(--color-aviso-texto)",
              font: "12px system-ui, sans-serif",
              textAlign: "center",
              pointerEvents: "none",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              boxSizing: "border-box",
            }}
          >
            {avisoAccionImposible}
          </div>
        )}
        <BromaHUD />
      </div>

      {/* fila-armas: selector de arma y disparo/repetir -- el paso fino de
          ángulo/potencia vive ahora en sus propias filas, junto al control
          al que pertenece (control-angulo-potencia).
          lay-2/lay-5: con el nombre de arma más largo del catálogo
          ("Gravitón de Segunda Mano") los tres grupos no cabían en 344px con
          el padding original -- ni exprimiendo el selector (lo hacía partirse
          en muchas líneas y crecer más de lo que cabe en el alto reservado
          de la consola) ni dándole ancho fijo (sacaba el grupo de disparo
          fuera de la ventana por la derecha). flex:"0 0 auto" sin encoger en
          los tres grupos, con el padding de botonEstilo recortado para
          liberar el ancho que el selector necesita, es lo que hace que el
          presupuesto cierre en una sola línea sin exprimir ni desbordar. */}
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
        <div style={{ position: "relative", flex: "0 0 auto" }}>
          <button
            type="button"
            data-testid="selector-arma-abrir"
            onClick={() => {
              setPestana("armas");
              setSelectorAbierto((valor) => !valor);
            }}
            style={{
              ...botonEstilo,
              maxWidth: 112,
              display: "block",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              lineHeight: 1.15,
            }}
          >
            {equipoElegido?.nombre ?? armaSeleccionada.nombre}
          </button>
          {selectorAbierto && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                left: 0,
                zIndex: 20,
                width: "min(336px, calc(100vw - 16px))",
                background: "var(--color-cromado-fondo)",
                borderRadius: 8,
                padding: 6,
                maxHeight: "min(62vh, 440px)",
                overflowY: "auto",
                color: "var(--color-cromado-texto)",
                font: "12px system-ui, sans-serif",
              }}
            >
              <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                {(["armas", "equipo"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={pestana === id}
                    data-testid={`pestana-${id}`}
                    onClick={() => setPestana(id)}
                    style={{ ...botonEstilo, flex: 1, minHeight: TAMANO_MINIMO_BOTON_PX, outline: pestana === id ? "2px solid #ffd23f" : "none" }}
                  >
                    {id === "armas" ? "Armas" : "Equipo"}
                  </button>
                ))}
              </div>
              {pestana === "equipo" && (
                <div data-testid="rejilla-equipo" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                  {CATALOGO_EQUIPO.map((equipo) => {
                    const motivo = motivoEquipoNoDisponible(equipo.id);
                    return (
                      <button
                        key={equipo.id}
                        type="button"
                        data-testid={`equipo-${equipo.id}`}
                        disabled={motivo !== null}
                        onClick={() => {
                          seleccionarEquipo(equipo.id);
                          setSelectorAbierto(false);
                        }}
                        style={{
                          ...botonEstilo,
                          minWidth: TAMANO_MINIMO_BOTON_PX,
                          minHeight: TAMANO_MINIMO_BOTON_PX,
                          textAlign: "left",
                          opacity: motivo !== null ? 0.45 : 1,
                          outline: equipo.id === estado.equipoId ? "2px solid #ffd23f" : "none",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <IconoEquipoGracioso equipoId={equipo.id} />
                          <strong style={{ lineHeight: 1.1 }}>{equipo.nombre}</strong>
                        </span>
                        <span style={{ fontSize: 11 }}>
                          {enPresupuesto && <span data-testid={`precio-equipo-${equipo.id}`}>{equipo.coste} cr</span>}
                          {motivo !== null && <span data-testid={`faltan-equipo-${equipo.id}`}>{enPresupuesto ? " · " : ""}{motivo}</span>}
                        </span>
                        <span data-testid={`ayuda-equipo-${equipo.id}`} style={{ fontSize: 10.5, opacity: 0.85 }}>{equipo.ayuda}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {pestana === "armas" && enPresupuesto && estado.saldo !== null && !CATALOGO_ARMAS.some((arma) => costeDeArma(arma.id) > 0 && armaFaltaSaldo(arma.id) === 0) && (
                <p data-testid="selector-sin-saldo" style={{ margin: "0 0 6px" }}>
                  Sin saldo para armas de pago: te quedan las gratis (daño reducido). Un evento de lotería puede darte más.
                </p>
              )}
              {/* cat-3: rejilla de celdas con icono, de 2 columnas (≥ 44 px de alto, 6 px de separación) */}
              {pestana === "armas" && (
              <div data-testid="rejilla-armas" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                {CATALOGO_ARMAS.map((arma) => {
                  const agotada = armaEstaAgotada(arma.id);
                  const coste = costeDeArma(arma.id);
                  const faltan = armaFaltaSaldo(arma.id);
                  const deshabilitada = agotada || faltan > 0;
                  const eje = textoEjeDeArma(arma);
                  return (
                    <button
                      key={arma.id}
                      type="button"
                      data-testid={`arma-${arma.id}`}
                      disabled={deshabilitada}
                      onClick={() => {
                        seleccionarArma(arma.id);
                        setSelectorAbierto(false);
                      }}
                      style={{
                        ...botonEstilo,
                        minWidth: TAMANO_MINIMO_BOTON_PX,
                        minHeight: TAMANO_MINIMO_BOTON_PX,
                        textAlign: "left",
                        opacity: deshabilitada ? 0.45 : 1,
                        outline: arma.id === armaSeleccionada.id ? "2px solid #ffd23f" : "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <IconoArmaGracioso armaId={arma.id} />
                        <strong style={{ lineHeight: 1.1 }}>{arma.nombre}</strong>
                      </span>
                      <span style={{ fontSize: 11 }}>
                        {agotada ? "(agotada) Ya la usaste en esta partida" : ""}
                        {enPresupuesto && <span data-testid={`precio-${arma.id}`}>{coste > 0 ? `${coste} cr` : "Gratis"}</span>}
                        {eje !== "" && <span data-testid={`eje-${arma.id}`}>{enPresupuesto ? " · " : ""}{eje}</span>}
                        {enPresupuesto && coste === 0 && arma.efecto.tipo === "danio" && (
                          <span data-testid={`gratis-reducida-${arma.id}`}> · Gratis · daño reducido al 25 %</span>
                        )}
                        {enPresupuesto && coste === 0 && (
                          <span data-testid={`gratis-evento-${arma.id}`}> · 25 % de provocar un evento</span>
                        )}
                        {enPresupuesto && faltan > 0 && !agotada && <span data-testid={`faltan-${arma.id}`}> · Te faltan {faltan} cr</span>}
                      </span>
                      <span style={{ fontSize: 10.5, opacity: 0.85 }}>{arma.descripcion}</span>
                      {arma.notaAyuda && (
                        <span data-testid={`ayuda-arma-${arma.id}`} style={{ color: "#9fd3ff", fontStyle: "italic", fontSize: 10.5 }}>
                          {arma.notaAyuda}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "row", gap: 2 }}>
          <button
            type="button"
            data-testid="repetir-disparo"
            onClick={repetirUltimoDisparo}
            disabled={!estado.ultimoDisparo}
            style={botonEstilo}
          >
            Repetir
          </button>
          <button
            type="button"
            data-testid="disparar"
            onClick={solicitarDisparo}
            disabled={accionDeshabilitada}
            style={{ ...botonEstilo, background: "#ff6b4a", whiteSpace: "normal", maxWidth: 132, lineHeight: 1.1 }}
          >
            {etiquetaAccion}
          </button>
        </div>
      </div>

      {estado.ayudaVisible && (
        <div
          role="alert"
          data-testid="ayuda-inicial"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-cromado-fondo)",
            color: "var(--color-cromado-texto)",
            font: "14px system-ui, sans-serif",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 320 }}>
            <p data-testid="ayuda-control-angulo">
              La barra de arriba es el ángulo: arrástrala de un extremo a otro para girar en círculo completo (0° a
              360°, también hacia abajo) en un solo gesto, o usa +0.1°/-0.1° para el ajuste fino.
            </p>
            <p data-testid="ayuda-control-potencia">
              La barra de abajo es la potencia: es un control aparte, arrastrarlo nunca cambia el ángulo. Usa
              +1%/-1% para el ajuste fino.
            </p>
            <p>Ambas barras recuerdan el último valor que dejaste. Elige arma y pulsa Disparar.</p>
            {estado.modoEspacial && (
              <p data-testid="ayuda-espacial">
                Los planetas curvan la trayectoria de tu disparo -- apunta pensando en su tirón, no en línea recta. El
                halo azul alrededor de cada planeta es su campo de gravedad real: más cerca, más tirón. La línea
                punteada es tu mira, un adelanto corto y honesto de hacia dónde va a curvarse el disparo con el ángulo
                y la potencia que tienes ahora -- muévela y verás cómo cambia. Un disparo puede quedarse en órbita y
                perderse: si pasa, el turno sigue igual.
              </p>
            )}
            <p data-testid="explicacion-modo">
              {estado.modo === "presupuesto"
                ? `Modo con presupuesto: empiezas con ${estado.saldo ?? 0} créditos, cada arma de pago se cobra al dispararla. Las tres gratis siempre están, con el daño reducido al 25 %.`
                : "Modo barra libre: todas las armas están disponibles siempre, sin coste."}
            </p>
            <button type="button" data-testid="ayuda-cerrar" onClick={cerrarAyuda} style={botonEstilo}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const botonEstilo: React.CSSProperties = {
  minWidth: TAMANO_MINIMO_BOTON_PX,
  minHeight: TAMANO_MINIMO_BOTON_PX,
  // lay-2/lay-5: el padding original ("6px 10px") no dejaba sitio para el
  // selector de arma con el nombre más largo del catálogo sin desbordar la
  // fila -- 44px de alto (el mínimo táctil real, esp-4) no depende de este
  // padding horizontal, así que recortarlo no toca ningún criterio de
  // tamaño de objetivo.
  padding: "6px 6px",
  borderRadius: 8,
  border: "1px solid var(--color-cromado-borde)",
  background: "var(--color-cromado-boton)",
  color: "var(--color-cromado-texto)",
  font: "12px system-ui, sans-serif",
  cursor: "pointer",
};
