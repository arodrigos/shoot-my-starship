"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import {
  actualizarArrastre,
  ajustarAnguloFino,
  ajustarPotenciaFino,
  alternarSilenciado,
  armaEstaAgotada,
  cerrarAyuda,
  costeDeArma,
  fijarAnguloDesdeFraccion,
  fijarPotenciaDesdeFraccion,
  fijarSacudidaActiva,
  iniciarArrastre,
  obtenerEstadoControl,
  puedeCostearArma,
  repetirUltimoDisparo,
  seleccionarArma,
  solicitarDisparo,
  suscribirControl,
  terminarArrastre,
} from "@/juego/control/store";
import { obtenerHistorialEfectos, sonidoSilenciado } from "@/juego/audio/motor";
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { obtenerResultadoTurno, suscribirResultadoTurno } from "@/juego/control/resultadoTurnoStore";
import { obtenerBromas, suscribirBromas } from "@/juego/control/broma";
import { IntegridadHUD } from "@/juego/hud/IntegridadHUD";
import { BromaHUD } from "@/juego/hud/BromaHUD";
import { RoceHUD } from "@/juego/hud/RoceHUD";
import { HistoricoBromasHUD } from "@/juego/hud/HistoricoBromasHUD";
import "@/debug/tipos";

// La cáscara React del control (fuera del lienzo, ver arquitectura): todo lo
// de aquí es matemática de pantalla o de UI, nunca de terreno -- si algo
// necesitase saber dónde está el suelo, iría dentro de Partida.ts, no aquí.
// esp-4: 44px (WCAG 2.2 SC 2.5.5), no los 24px de SC 2.5.8 que ya cubre
// control-2 -- este hito exige el umbral más alto para los controles que de
// verdad se disparan con el pulgar en 360x640.
const TAMANO_MINIMO_BOTON_PX = 44;

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

export function ControlHUD() {
  const estado = useSyncExternalStore(suscribirControl, obtenerEstadoControl, obtenerEstadoControl);
  const resultadoTurno = useSyncExternalStore(suscribirResultadoTurno, obtenerResultadoTurno, obtenerResultadoTurno);
  const bromas = useSyncExternalStore(suscribirBromas, obtenerBromas, obtenerBromas);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [historicoAbierto, setHistoricoAbierto] = useState(false);

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
  }, [estado]);

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
  const saldoInsuficienteParaSeleccionada = enPresupuesto && !puedeCostearArma(armaSeleccionada.id);
  const potenciaEnCero = Math.round(estado.ajuste.potencia) <= 0;
  // lay-6: motivo concreto de por qué "Disparar" no responde -- distinto de
  // puedeDisparar (que gobierna la escena: turno, animación en curso...) y
  // que por eso necesita su propio texto en vez de reusar el de la escena.
  // hud-canales-5: "disparar" ya viene disabled con !puedeDisparar (nunca se
  // encola un segundo disparo); esto solo pone en pantalla la causa concreta
  // -- vuelo en curso o turno del rival, las dos cosas que puedeDisparar ya
  // combina sin que el HUD reimplemente esa condición por su cuenta.
  const avisoAccionImposible = potenciaEnCero
    ? "Potencia a 0: arrastra hacia arriba en la consola para cargar el disparo."
    : saldoInsuficienteParaSeleccionada
      ? `Saldo insuficiente para ${armaSeleccionada.nombre}: elige otra arma o acierta un disparo para ingresar.`
      : !estado.puedeDisparar
        ? "Espera a que termine el disparo: no puedes disparar mientras hay un proyectil en vuelo o es el turno del rival."
        : null;

  return (
    // layout-dos-zonas: esta consola ocupa el 100% de su contenedor (la
    // franja inferior de PhaserGame, ya separada del lienzo) en un flujo
    // normal de filas -- nada de position:fixed disperso por el viewport,
    // que era justo lo que producía los solapes que este bloque corrige.
    <div
      style={{
        position: "absolute",
        inset: 0,
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
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "56%", minWidth: 0 }}>
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
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
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
        Histórico{bromas.historico.length > 0 ? ` (${bromas.historico.length})` : ""}
      </button>

      {historicoAbierto && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            top: 0,
            height: "58%",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            padding: 8,
            background: "rgba(5,6,10,0.88)",
          }}
        >
          <button
            type="button"
            data-testid="historico-bromas-cerrar"
            aria-label="Cerrar histórico"
            onClick={() => setHistoricoAbierto(false)}
            style={{
              alignSelf: "flex-end",
              minWidth: TAMANO_MINIMO_BOTON_PX,
              minHeight: TAMANO_MINIMO_BOTON_PX,
              background: "transparent",
              border: "none",
              color: "#cfe8ff",
              font: "16px system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
          <HistoricoBromasHUD />
        </div>
      )}

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
            {estado.ajuste.anguloGrados.toFixed(1)}°
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
          ...(bromas.clave > 0 ? { height: 78 } : { maxHeight: 78 }),
          overflowY: "auto",
        }}
      >
        <RoceHUD />
        {avisoAccionImposible && (
          <div
            role="status"
            data-testid="aviso-accion-imposible"
            style={{
              width: "100%",
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
            onClick={() => setSelectorAbierto((valor) => !valor)}
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
            {armaSeleccionada.nombre}
          </button>
          {selectorAbierto && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                left: 0,
                zIndex: 20,
                width: 220,
                background: "var(--color-cromado-fondo)",
                borderRadius: 8,
                padding: 6,
                maxHeight: 260,
                overflowY: "auto",
                color: "var(--color-cromado-texto)",
                font: "12px system-ui, sans-serif",
              }}
            >
              {CATALOGO_ARMAS.map((arma) => {
                const agotada = armaEstaAgotada(arma.id);
                const coste = costeDeArma(arma.id);
                const asequible = puedeCostearArma(arma.id);
                const faltan = enPresupuesto && !asequible ? coste - (estado.saldo ?? 0) : 0;
                return (
                  <button
                    key={arma.id}
                    type="button"
                    data-testid={`arma-${arma.id}`}
                    disabled={agotada || !asequible}
                    onClick={() => {
                      seleccionarArma(arma.id);
                      setSelectorAbierto(false);
                    }}
                    style={{
                      ...botonEstilo,
                      width: "100%",
                      minHeight: TAMANO_MINIMO_BOTON_PX,
                      textAlign: "left",
                      opacity: agotada || !asequible ? 0.45 : 1,
                      marginBottom: 4,
                    }}
                  >
                    <strong>{arma.nombre}</strong>
                    {agotada ? " (agotada)" : ""}
                    {enPresupuesto && <span data-testid={`precio-${arma.id}`}>{coste > 0 ? ` — ${coste} cr` : " — Gratis"}</span>}
                    <br />
                    <span>{arma.descripcion}</span>
                    {arma.notaAyuda && (
                      <>
                        <br />
                        <span data-testid={`ayuda-arma-${arma.id}`} style={{ color: "#9fd3ff", fontStyle: "italic" }}>
                          {arma.notaAyuda}
                        </span>
                      </>
                    )}
                    {faltan > 0 && (
                      <>
                        <br />
                        <span data-testid={`saldo-insuficiente-${arma.id}`} style={{ color: "#ffcc66" }}>
                          Te faltan {faltan} créditos: dispara una gratis o acierta para ingresar.
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
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
            disabled={!estado.puedeDisparar}
            style={{ ...botonEstilo, background: "#ff6b4a" }}
          >
            Disparar
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
              La barra de arriba es el ángulo: arrástrala de un extremo a otro para girar de 2° a 178° en un solo
              gesto, o usa +0.1°/-0.1° para el ajuste fino.
            </p>
            <p data-testid="ayuda-control-potencia">
              La barra de abajo es la potencia: es un control aparte, arrastrarlo nunca cambia el ángulo. Usa
              +1%/-1% para el ajuste fino.
            </p>
            <p>Ambas barras recuerdan el último valor que dejaste. Elige arma y pulsa Disparar.</p>
            {estado.modoEspacial && (
              <p data-testid="ayuda-espacial">
                Los planetas curvan la trayectoria de tu disparo -- apunta pensando en su tirón, no en línea recta.
                Un disparo puede quedarse en órbita y perderse: si pasa, el turno sigue igual.
              </p>
            )}
            <p data-testid="explicacion-modo">
              {estado.modo === "presupuesto"
                ? `Modo con presupuesto: empiezas con ${estado.saldo ?? 0} créditos, cada disparo cuesta el suyo y acertar ingresa por el daño causado. Tres armas son siempre gratis.`
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
