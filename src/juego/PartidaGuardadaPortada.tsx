"use client";

import { useEffect, useRef, useState } from "react";
import { borrarPartidaGuardada, leerPartidaGuardada } from "@/juego/partidaGuardada/almacen";
import { leerInstantanea } from "@/juego/partidaGuardada/instantanea";
import type { DatosPartida, MotivoDescarte } from "@/juego/partidaGuardada/tipos";

export interface PartidaPendiente {
  readonly datos: DatosPartida;
  readonly ronda: number;
  readonly rotulo: string;
}

type Lectura = { readonly tipo: "ninguna" } | { readonly tipo: "valida"; readonly pendiente: PartidaPendiente } | { readonly tipo: "no-recuperable"; readonly motivo: MotivoDescarte };

const MOTIVOS: Record<MotivoDescarte, string> = {
  json: "los datos estaban dañados",
  tamano: "ocupaba demasiado",
  version: "es de un formato que esta versión no conoce",
  mascara: "el terreno guardado no encaja",
  naves: "las naves guardadas no encajan",
  turno: "el turno guardado no es válido",
  arma: "usaba un arma que ya no existe",
  nombre: "algún nombre no era válido",
  terminada: "la partida ya había terminado",
  datos: "faltaban datos",
  "version-incompatible": "viene de otra versión del juego y ya no encaja",
};

// «Ana contra Luis y La Contable»: solo los asientos vivos. La partida de
// siempre (un humano sin nombre) se llama «Tu nave».
export function rotuloDePortada(datos: DatosPartida): string {
  const vivos = datos.config.jugadores
    .map((jugador, id) => ({ nombre: datos.config.clasica && id === 0 ? "Tu nave" : jugador.nombre, vivo: datos.estado.naves[id].integridad > 0 }))
    .filter((asiento) => asiento.vivo)
    .map((asiento) => asiento.nombre);
  const [primero, ...resto] = vivos;
  if (resto.length === 0) return primero ?? "";
  const rivales = resto.length === 1 ? resto[0] : `${resto.slice(0, -1).join(", ")} y ${resto[resto.length - 1]}`;
  return `${primero} contra ${rivales}`;
}

function leer(): Lectura {
  const cadena = leerPartidaGuardada();
  if (cadena === null) return { tipo: "ninguna" };
  const lectura = leerInstantanea(cadena);
  if (lectura.tipo === "descartada") return { tipo: "no-recuperable", motivo: lectura.motivo };
  return { tipo: "valida", pendiente: { datos: lectura.datos, ronda: lectura.rotulo.ronda, rotulo: rotuloDePortada(lectura.datos) } };
}

// La portada lee la instantánea una sola vez al montar. Una que no valida se
// borra aquí mismo, así que nunca puede impedir empezar una partida nueva.
export function usePartidaGuardada() {
  const [lectura, setLectura] = useState<Lectura>(() => leer());
  useEffect(() => {
    if (lectura.tipo === "no-recuperable") borrarPartidaGuardada();
  }, [lectura]);
  return {
    pendiente: lectura.tipo === "valida" ? lectura.pendiente : null,
    motivoNoRecuperable: lectura.tipo === "no-recuperable" ? MOTIVOS[lectura.motivo] : null,
    olvidar: () => setLectura({ tipo: "ninguna" }),
  };
}

const botonEstilo: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(30,34,46,0.9)",
  color: "#e8eaf0",
  font: "14px system-ui, sans-serif",
  cursor: "pointer",
};

// Confirmación en línea con el foco en la opción segura y Escape para volver.
function Confirmacion({ testid, texto, si, no, alSi, alNo }: { testid: string; texto: string; si: string; no: string; alSi: () => void; alNo: () => void }) {
  const seguro = useRef<HTMLButtonElement>(null);
  useEffect(() => seguro.current?.focus(), []);
  return (
    <div
      role="alertdialog"
      aria-label={texto}
      data-testid={testid}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") alNo();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <p style={{ margin: 0 }}>{texto}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" ref={seguro} data-testid={`${testid}-no`} onClick={alNo} style={botonEstilo}>
          {no}
        </button>
        <button type="button" data-testid={`${testid}-si`} onClick={alSi} style={{ ...botonEstilo, background: "#8a2c14" }}>
          {si}
        </button>
      </div>
    </div>
  );
}

interface PropsBloque {
  readonly pendiente: PartidaPendiente;
  readonly alContinuar: (datos: DatosPartida) => void;
  readonly alDescartar: () => void;
}

export function BloqueContinuarPartida({ pendiente, alContinuar, alDescartar }: PropsBloque) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <section
      data-testid="continuar-partida"
      style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 360, boxSizing: "border-box", padding: 12, borderRadius: 10, border: "2px solid #ffcc66", background: "rgba(255,204,102,0.08)" }}
    >
      <h2 style={{ margin: 0, fontSize: 15, overflowWrap: "anywhere" }}>
        Continuar partida (ronda {pendiente.ronda}, {pendiente.rotulo})
      </h2>
      {confirmando ? (
        <Confirmacion
          testid="confirmar-descarte"
          texto="¿Descartar la partida? No se puede recuperar."
          si="Sí, descartar"
          no="Cancelar"
          alSi={() => {
            borrarPartidaGuardada();
            alDescartar();
          }}
          alNo={() => setConfirmando(false)}
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" data-testid="continuar-partida-boton" onClick={() => alContinuar(pendiente.datos)} style={{ ...botonEstilo, background: "#ff6b4a" }}>
              Continuar
            </button>
            <button type="button" data-testid="descartar-partida-boton" onClick={() => setConfirmando(true)} style={botonEstilo}>
              Descartar
            </button>
          </div>
          <p style={{ margin: 0, font: "12px system-ui, sans-serif", opacity: 0.85 }}>
            Se guarda sola en este dispositivo y no sale de él. Si empiezas otra partida, esta se borra.
          </p>
        </>
      )}
    </section>
  );
}

export function AvisoPartidaNoRecuperable({ motivo, alEntender }: { motivo: string; alEntender: () => void }) {
  return (
    <section data-testid="aviso-partida-no-recuperable" role="status" style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 360, color: "#ffe08a", font: "13px system-ui, sans-serif" }}>
      <p style={{ margin: 0 }}>No se ha podido recuperar la partida guardada ({motivo}). Puedes empezar una nueva.</p>
      <button type="button" data-testid="aviso-partida-entendido" onClick={alEntender} style={botonEstilo}>
        Entendido
      </button>
    </section>
  );
}

export function ConfirmarNuevaPartida({ ronda, alEmpezar, alVolver }: { ronda: number; alEmpezar: () => void; alVolver: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.7)" }}>
      <div style={{ width: "100%", maxWidth: 320, padding: 16, borderRadius: 12, background: "#12141a", border: "1px solid rgba(255,255,255,0.25)", color: "#e8eaf0", font: "14px system-ui, sans-serif" }}>
        <Confirmacion
          testid="confirmar-nueva-partida"
          texto={`Hay una partida a medias (ronda ${ronda}). Si empiezas otra, se borra.`}
          si="Empezar otra"
          no="Volver"
          alSi={alEmpezar}
          alNo={alVolver}
        />
      </div>
    </div>
  );
}
