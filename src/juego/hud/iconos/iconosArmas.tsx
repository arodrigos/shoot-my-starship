import type { ReactElement } from "react";
import { aspectoDeId, colorCss, radioEnvolvente, trazadoSvg } from "@/juego/armas/aspecto";

// Iconos de equipo dibujados como SVG inline (JSX, nunca cadenas ni ficheros:
// ACTIVOS.md prohíbe binarios y así no hay nada que interpretar como HTML),
// con silueta propia y un guiño. Caben en un viewBox 48x48. Las armas ya no
// pasan por aquí: ver IconoArmaGracioso.
const OJOS = (x1: number, x2: number, y: number) => (
  <>
    <circle cx={x1} cy={y} r={3} fill="#fff" />
    <circle cx={x2} cy={y} r={3} fill="#fff" />
    <circle cx={x1 + 0.8} cy={y + 0.6} r={1.4} fill="#1b1b2f" />
    <circle cx={x2 + 0.8} cy={y + 0.6} r={1.4} fill="#1b1b2f" />
  </>
);

// Para un arma sin icono propio (un fixture, un arma futura): una bola neutra
// en vez de un hueco, para que la celda nunca quede vacía.
const ICONO_GENERICO = () => <circle cx={24} cy={24} r={14} fill="#8d99a6" />;

// armas-aspecto: el icono del arma ya no es un dibujo aparte con cara, sino el
// MISMO contorno que Phaser hornea para el proyectil (aspecto.ts), con su
// paleta: lo que eliges es lo que ves en el lanzador y volando.
export function IconoArmaGracioso({ armaId, tamano = 36 }: { readonly armaId: string; readonly tamano?: number }) {
  const aspecto = aspectoDeId(armaId);
  const radio = Math.ceil(radioEnvolvente(aspecto.puntos)) + 2;
  const { paleta } = aspecto;
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox={`${-radio} ${-radio} ${radio * 2} ${radio * 2}`}
      aria-hidden="true"
      data-testid={`icono-${armaId}`}
      style={{ flexShrink: 0 }}
    >
      <path d={trazadoSvg(aspecto.puntos)} fill={colorCss(paleta.cuerpo)} stroke={colorCss(paleta.borde)} strokeWidth={1.5} strokeLinejoin="round" data-testid={`icono-trazado-${armaId}`} />
      <path d={trazadoSvg(aspecto.puntos.map((p) => ({ x: p.x * 0.5, y: p.y * 0.5 - radio * 0.12 })))} fill={colorCss(paleta.brillo)} fillOpacity={0.45} />
    </svg>
  );
}

// Equipo: mismo estilo que las armas (SVG inline, silueta propia, un guiño).
const ICONOS_EQUIPO: Readonly<Record<string, () => ReactElement>> = {
  // Escudo con cara de pocos amigos y un abollón de orgullo.
  escudo: () => (
    <>
      <path d="M24 5 L40 11 V24 C40 34 33 41 24 44 C15 41 8 34 8 24 V11 Z" fill="#3f8fd6" />
      <path d="M24 9 L36 13.5 V24 C36 31.5 31 37 24 40 Z" fill="#6cc0ff" />
      {OJOS(18, 28, 22)}
      <path d="M18 31 Q23 28 29 31" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" />
      <circle cx={33} cy={16} r={2.2} fill="#ffd23f" />
    </>
  ),
  // Cohete diminuto con llamas que no se deciden y una cara de pánico.
  propulsores: () => (
    <>
      <path d="M24 4 C32 12 33 22 31 32 H17 C15 22 16 12 24 4 Z" fill="#e4e8f2" />
      <circle cx={24} cy={19} r={5} fill="#6cc0ff" />
      {OJOS(21, 27, 19)}
      <path d="M17 26 L9 36 L18 33 Z" fill="#d7263d" />
      <path d="M31 26 L39 36 L30 33 Z" fill="#d7263d" />
      <path d="M19 33 Q24 46 29 33 Z" fill="#ff9f1c" />
      <path d="M21.5 33 Q24 41 26.5 33 Z" fill="#ffd23f" />
    </>
  ),
};

export function IconoEquipoGracioso({ equipoId, tamano = 36 }: { readonly equipoId: string; readonly tamano?: number }) {
  const dibujo = ICONOS_EQUIPO[equipoId] ?? ICONO_GENERICO;
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 48 48" aria-hidden="true" data-testid={`equipo-icono-${equipoId}`} style={{ flexShrink: 0 }}>
      {dibujo()}
    </svg>
  );
}
