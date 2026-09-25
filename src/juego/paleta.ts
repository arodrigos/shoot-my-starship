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
