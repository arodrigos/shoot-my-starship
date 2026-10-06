import type { ReactElement } from "react";

// Un icono por arma, dibujado como SVG inline (JSX, nunca cadenas ni ficheros:
// ACTIVOS.md prohíbe binarios y así no hay nada que interpretar como HTML).
// Cada uno tiene una silueta distinta -- se distinguen también en escala de
// grises -- y un detalle gracioso (ojos, lágrima, gafas) que hace el guiño del
// nombre del arma. Todos caben en un viewBox 48x48.
const OJOS = (x1: number, x2: number, y: number) => (
  <>
    <circle cx={x1} cy={y} r={3} fill="#fff" />
    <circle cx={x2} cy={y} r={3} fill="#fff" />
    <circle cx={x1 + 0.8} cy={y + 0.6} r={1.4} fill="#1b1b2f" />
    <circle cx={x2 + 0.8} cy={y + 0.6} r={1.4} fill="#1b1b2f" />
  </>
);

const ICONOS: Readonly<Record<string, () => ReactElement>> = {
  // Bola de cañón educada: lleva pajarita.
  "pepinazo-cortesia": () => (
    <>
      <circle cx={24} cy={27} r={15} fill="#3b4a6b" />
      <circle cx={19} cy={21} r={4} fill="#5d7099" />
      <path d="M24 12 Q27 6 33 7" stroke="#c9a66b" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <circle cx={34} cy={7} r={3} fill="#ffb02e" />
      {OJOS(19, 29, 25)}
      <path d="M19 33 Q24 37 29 33" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M20 40 L24 37 L28 40 L28 44 L24 41.5 L20 44 Z" fill="#ff5a5f" />
    </>
  ),
  // Tubo inclinado, triste, con una lágrima.
  "mortero-lamentable": () => (
    <>
      <rect x={8} y={20} width={30} height={14} rx={3} fill="#6b7a3a" transform="rotate(-35 23 27)" />
      <rect x={4} y={36} width={26} height={7} rx={3} fill="#4a5426" />
      {OJOS(20, 27, 30)}
      <path d="M19 38 Q23.5 34 28 38" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M17 33 Q15 37 17 38 Q19 37 17 33 Z" fill="#6ec6ff" />
    </>
  ),
  // Pala con cara, de las que reorganizan planetas.
  "zanjadora-manolita": () => (
    <>
      <rect x={21} y={3} width={5} height={24} rx={2.5} fill="#a0703c" />
      <rect x={16} y={3} width={15} height={5} rx={2.5} fill="#7b542c" />
      <path d="M12 26 L35 26 Q36 42 24 45 Q12 42 12 26 Z" fill="#9aa5b4" />
      {OJOS(19, 29, 32)}
      <path d="M20 38 Q24 41 28 38" stroke="#2e3440" strokeWidth={2} fill="none" strokeLinecap="round" />
    </>
  ),
  // Cubo de basura, con moscas.
  "vertedero-portatil": () => (
    <>
      <rect x={10} y={14} width={28} height={5} rx={2} fill="#2f8f5b" />
      <rect x={19} y={10} width={10} height={5} rx={2} fill="#2f8f5b" />
      <path d="M12 19 L36 19 L33 44 L15 44 Z" fill="#3fbf78" />
      <path d="M19 22 L19 41 M24 22 L24 41 M29 22 L29 41" stroke="#2f8f5b" strokeWidth={2} />
      <circle cx={40} cy={8} r={1.8} fill="#2e3440" />
      <circle cx={6} cy={12} r={1.8} fill="#2e3440" />
    </>
  ),
  // Tres táperes de colores apilados y torcidos.
  "racimo-de-tuppers": () => (
    <>
      <rect x={4} y={26} width={20} height={14} rx={3} fill="#ff7a59" />
      <rect x={4} y={22} width={20} height={6} rx={2} fill="#ffc2b3" />
      <rect x={25} y={29} width={19} height={13} rx={3} fill="#4cc3ff" />
      <rect x={25} y={25} width={19} height={6} rx={2} fill="#b8e6ff" />
      <g transform="rotate(-14 24 14)">
        <rect x={14} y={8} width={20} height={13} rx={3} fill="#ffd23f" />
        <rect x={14} y={5} width={20} height={5} rx={2} fill="#fff0a6" />
      </g>
    </>
  ),
  // Petardo rojo con mecha y chispa; zigzag de ruido.
  "petardo-de-feria": () => (
    <>
      <rect x={17} y={14} width={14} height={28} rx={3} fill="#e63946" />
      <rect x={17} y={22} width={14} height={5} fill="#ffd23f" />
      <path d="M24 14 Q22 8 28 5" stroke="#8a6d3b" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M28 1 L30 5 L34 4 L31 7 L34 10 L29 8 L27 12 L26 7 L22 6 L26 4 Z" fill="#ffb02e" />
      <path d="M6 30 L10 34 L6 38 M42 30 L38 34 L42 38" stroke="#ffb02e" strokeWidth={2} fill="none" strokeLinecap="round" />
    </>
  ),
  // Bola de chatarra remachada, con ojos desiguales.
  "pelota-de-chatarra": () => (
    <>
      <circle cx={24} cy={24} r={17} fill="#8d99a6" stroke="#5c6772" strokeWidth={3} />
      <circle cx={13} cy={17} r={2} fill="#5c6772" />
      <circle cx={35} cy={17} r={2} fill="#5c6772" />
      <circle cx={13} cy={32} r={2} fill="#5c6772" />
      <circle cx={35} cy={32} r={2} fill="#5c6772" />
      <circle cx={19} cy={22} r={4} fill="#fff" />
      <circle cx={30} cy={22} r={2.5} fill="#fff" />
      <circle cx={20} cy={23} r={1.8} fill="#1b1b2f" />
      <circle cx={30} cy={22.5} r={1.2} fill="#1b1b2f" />
      <path d="M17 31 L31 29" stroke="#2e3440" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  // Imán de herradura que cambia de sitio las cosas.
  "graviton-segunda-mano": () => (
    <>
      <path d="M10 8 L10 26 A14 14 0 0 0 38 26 L38 8 L30 8 L30 26 A6 6 0 0 1 18 26 L18 8 Z" fill="#d7263d" />
      <rect x={10} y={8} width={8} height={8} fill="#f4f4f8" />
      <rect x={30} y={8} width={8} height={8} fill="#f4f4f8" />
      <path d="M5 40 Q2 44 6 46 M43 40 Q46 44 42 46" stroke="#7cc6fe" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </>
  ),
  // Una lápida con corazón: la despedida.
  despedida: () => (
    <>
      <path d="M12 44 L12 20 A12 12 0 0 1 36 20 L36 44 Z" fill="#b8bcc8" />
      <path d="M8 44 L40 44" stroke="#5b6170" strokeWidth={4} strokeLinecap="round" />
      <path d="M24 34 C14 28 18 20 24 25 C30 20 34 28 24 34 Z" fill="#ff5a8a" />
      <path d="M20 14 L28 14 M24 10 L24 18" stroke="#5b6170" strokeWidth={2.5} strokeLinecap="round" />
    </>
  ),
  // Broca cónica a rayas sobre un planetita.
  "barrena-planetaria": () => (
    <>
      <circle cx={24} cy={40} r={9} fill="#7a5c3e" />
      <path d="M24 3 L35 33 L13 33 Z" fill="#f0a500" />
      <path d="M17 26 L31 22 M15 31 L33 27 M20 17 L28 14" stroke="#7a4f00" strokeWidth={2.5} strokeLinecap="round" />
    </>
  ),
  // Pistola de rayos con gafas de sol y haz.
  "rayo-laser": () => (
    <>
      <rect x={3} y={17} width={20} height={13} rx={4} fill="#6a4cff" />
      <rect x={9} y={28} width={7} height={13} rx={2} fill="#4b33c4" />
      <rect x={6} y={20} width={14} height={5} rx={2} fill="#1b1b2f" />
      <path d="M23 24 L45 24" stroke="#ff2e63" strokeWidth={5} strokeLinecap="round" />
      <path d="M23 24 L45 24" stroke="#ffd1dc" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M40 15 L42 20 L47 21 L42 23 L40 28 L38 23 L33 21 L38 20 Z" fill="#ffd23f" />
    </>
  ),
  // Mosca con alas y trayectoria a eses.
  "mosca-cojonera": () => (
    <>
      <ellipse cx={17} cy={14} rx={9} ry={5} fill="#b8e6ff" stroke="#6aa9d6" strokeWidth={1.5} transform="rotate(-25 17 14)" />
      <ellipse cx={31} cy={14} rx={9} ry={5} fill="#b8e6ff" stroke="#6aa9d6" strokeWidth={1.5} transform="rotate(25 31 14)" />
      <ellipse cx={24} cy={28} rx={8} ry={12} fill="#3a3a4a" />
      <circle cx={24} cy={17} r={6} fill="#4d4d63" />
      <circle cx={21} cy={16} r={3} fill="#e63946" />
      <circle cx={27} cy={16} r={3} fill="#e63946" />
      <path d="M2 44 Q8 36 12 42 Q16 46 20 40" stroke="#9aa0b5" strokeWidth={1.8} strokeDasharray="3 3" fill="none" />
    </>
  ),
  // Granada con un reloj en la panza.
  "granada-de-espoleta": () => (
    <>
      <ellipse cx={24} cy={28} rx={15} ry={16} fill="#4f8a3a" />
      <rect x={19} y={7} width={10} height={7} rx={2} fill="#3a6a2a" />
      <circle cx={36} cy={8} r={5} fill="none" stroke="#c0c4cc" strokeWidth={2.5} />
      <path d="M29 10 L33 9" stroke="#c0c4cc" strokeWidth={2.5} />
      <circle cx={24} cy={28} r={9} fill="#f4f4f8" />
      <path d="M24 28 L24 22 M24 28 L29 30" stroke="#1b1b2f" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  // Robotito de cuerpo cuadrado con muelles en vez de patas, mirando al frente.
  "minirobot-saltaplanetas": () => (
    <>
      <path d="M14 44 Q10 38 16 36 Q22 34 16 30" stroke="#c0c4cc" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M34 44 Q38 38 32 36 Q26 34 32 30" stroke="#c0c4cc" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <rect x={12} y={10} width={24} height={21} rx={4} fill="#e8743b" />
      <path d="M24 10 L24 4" stroke="#c0c4cc" strokeWidth={2.5} />
      <circle cx={24} cy={4} r={2.5} fill="#ffe680" />
      {OJOS(19, 29, 19)}
      <path d="M18 26 L30 26" stroke="#1b1b2f" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  // Gancho amarillo goteando pegamento.
  "gancho-pegajoso": () => (
    <>
      <path d="M26 4 L26 30 A8 8 0 0 1 10 30 L10 24" stroke="#ffcc00" strokeWidth={6} fill="none" strokeLinecap="round" />
      <circle cx={26} cy={5} r={4} fill="#ffe680" />
      <path d="M10 26 Q6 33 10 36 Q14 33 10 26 Z" fill="#7bd88f" />
      <path d="M22 38 Q19 43 22 45 Q25 43 22 38 Z" fill="#7bd88f" />
      <circle cx={36} cy={40} r={3} fill="#7bd88f" />
    </>
  ),
};

// Para un arma sin icono propio (un fixture, un arma futura): una bola neutra
// en vez de un hueco, para que la celda nunca quede vacía.
const ICONO_GENERICO = () => <circle cx={24} cy={24} r={14} fill="#8d99a6" />;

export function iconoDeArmaExiste(armaId: string): boolean {
  return armaId in ICONOS;
}

export function IconoArmaGracioso({ armaId, tamano = 36 }: { readonly armaId: string; readonly tamano?: number }) {
  const dibujo = ICONOS[armaId] ?? ICONO_GENERICO;
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 48 48" aria-hidden="true" data-testid={`icono-${armaId}`} style={{ flexShrink: 0 }}>
      {dibujo()}
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
