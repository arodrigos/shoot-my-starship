// Paleta real por mapa (render-juego sustituye el color cableado
// provisional de terreno-mascara): cada mapa del Cinturón de la Deriva es
// un montón de chatarra distinto, así que el color del "sólido" es un dato
// del mapa, no una constante del renderizador de terreno.
export interface PaletaTerreno {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

// Mantenida por compatibilidad con el color provisional de terreno-mascara
// (el mismo valor): solo la usa SuperficieCanvasPhaser como valor por
// defecto si algún consumidor no declara paleta explícita.
export const PALETA_PROVISIONAL: PaletaTerreno = { r: 0x8a, g: 0x7f, b: 0x6b };

export const CHATARRA_OXIDADA: PaletaTerreno = { r: 0x9c, g: 0x5a, b: 0x3a };
export const REGOLITO_CENIZA: PaletaTerreno = { r: 0x6e, g: 0x70, b: 0x78 };
export const ESCORIA_VERDOSA: PaletaTerreno = { r: 0x5c, g: 0x6b, b: 0x4a };

// render-espacio (esp-5): un color propio por cada id de planeta (1..6, ver
// mascara.PLANETA_MIN/MAX) para que se distingan entre sí sin depurador --
// elegidos con suficiente contraste de luminancia entre ellos y contra el
// fondo estrellado (casi negro) tanto en el hemisferio iluminado como en el
// sombreado (SuperficieEspacio los oscurece hacia el terminador, nunca hasta
// fundirlos a negro puro).
export const PALETA_ESPACIO_PLANETAS: Readonly<Record<number, PaletaTerreno>> = {
  1: { r: 0xc9, g: 0x6a, b: 0x4a }, // óxido marciano
  2: { r: 0x5a, g: 0x8f, b: 0xc7 }, // océano helado
  3: { r: 0xd9, g: 0xb0, b: 0x4a }, // gigante gaseoso
  4: { r: 0x7a, g: 0xc7, b: 0x7a }, // jungla tóxica
  5: { r: 0xb0, g: 0x7a, b: 0xd9 }, // cristal violeta
  6: { r: 0xd9, g: 0xd9, b: 0xe0 }, // roca helada
};

// Escombro (anillos, cinturón de asteroides): un gris neutro plano, sin
// sombreado esférico -- no son un cuerpo con "arriba" y "abajo" propios como
// un planeta, son fragmentos sueltos (sis-*, generador-sistema).
export const PALETA_ESPACIO_ESCOMBRO: PaletaTerreno = { r: 0x8a, g: 0x8a, b: 0x92 };
