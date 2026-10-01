"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import {
  actualizarArrastre,
  ajustarAnguloFino,
  ajustarPotenciaFino,
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
import { ANGULO_MAXIMO_GRADOS, ANGULO_MINIMO_GRADOS, POTENCIA_MAXIMA, POTENCIA_MINIMA } from "@/juego/control/apuntado";
import { obtenerResultadoTurno, suscribirResultadoTurno } from "@/juego/control/resultadoTurnoStore";
import { IntegridadHUD } from "@/juego/hud/IntegridadHUD";
import { BromaHUD } from "@/juego/hud/BromaHUD";
import { RoceHUD } from "@/juego/hud/RoceHUD";
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
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  useEffect(() => {
    window.__debug = window.__debug ?? {};
    window.__debug.control = {
      ajuste: estado.ajuste,
      ultimoDisparo: estado.ultimoDisparo,
      puedeDisparar: estado.puedeDisparar,
      ayudaVisible: estado.ayudaVisible,
      usosPorArma: estado.usosPorArma,
      sacudidaActiva: estado.sacudidaActiva,
    };
    window.__debug.modoEspacial = estado.modoEspacial;
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
  const avisoAccionImposible = potenciaEnCero
    ? "Potencia a 0: arrastra hacia arriba en la consola para cargar el disparo."
    : saldoInsuficienteParaSeleccionada
      ? `Saldo insuficiente para ${armaSeleccionada.nombre}: elige otra arma o acierta un disparo para ingresar.`
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
      {/* fila-estado: resultado del turno (+ saldo, en modo presupuesto) a la
          izquierda, integridad de ambas naves a la derecha. */}
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
              font: "11px system-ui, sans-serif",
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
          {/* realce-impacto (rlc-3): "no marea ni estorba" -- interruptor
              propio, fuera del lienzo, que persiste entre partidas (store). */}
          <button
            type="button"
            data-testid="toggle-sacudida"
            aria-pressed={estado.sacudidaActiva}
            onClick={() => fijarSacudidaActiva(!estado.sacudidaActiva)}
            title={estado.sacudidaActiva ? "Desactivar sacudida de impacto" : "Activar sacudida de impacto"}
            style={{
              minWidth: TAMANO_MINIMO_BOTON_PX,
              height: TAMANO_MINIMO_BOTON_PX,
              padding: "0 8px",
              borderRadius: 8,
              border: "none",
              background: "var(--color-cromado-fondo)",
              color: "var(--color-cromado-texto)",
              font: "11px system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            Sacudida: {estado.sacudidaActiva ? "On" : "Off"}
          </button>
          <IntegridadHUD />
        </div>
      </div>

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

      {/* fila-avisos: hueco reservado de broma (izquierda) y roce (derecha) --
          lay-4 pide el hueco reservado literalmente: altura FIJA (no
          mínima) y con scroll propio si una frase larga no cabe, para que
          quitar la broma nunca mueva el resto de controles y para que un
          texto largo jamás empuje ni solape la fila de abajo (lay-3).
          flexShrink:0 es el propio arreglo de lay-3: sin él, esta fila era
          la ÚNICA con overflowY:auto (mínimo automático 0 según CSS Flexbox
          §7.1.4), así que el algoritmo de flex-shrink la comprimía a ella
          sola para compensar el déficit de alto de la consola en 360x640,
          y su contenido (con maxHeight propio) se salía por debajo de la
          fila ya encogida, invadiendo geométricamente fila-armas aunque no
          se viera clípticamente -- exactamente lo que medía panel-bromas
          solapando selector-arma-abrir. */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 6,
          height: 78,
          flexShrink: 0,
          overflowY: "auto",
        }}
      >
        <BromaHUD />
        <RoceHUD />
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

      {avisoAccionImposible && (
        <div
          role="status"
          data-testid="aviso-accion-imposible"
          style={{
            position: "absolute",
            bottom: 4,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "92%",
            background: "rgba(255,107,74,0.16)",
            border: "1px solid rgba(255,107,74,0.6)",
            borderRadius: 8,
            padding: "4px 10px",
            color: "var(--color-cromado-texto)",
            font: "11px system-ui, sans-serif",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {avisoAccionImposible}
        </div>
      )}

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
