import type { ParametrosMundo } from "@/sim/partida/tipos";
import { MUNDO_ALTO, MUNDO_ANCHO } from "@/juego/constantes";
import { CHATARRA_OXIDADA, ESCORIA_VERDOSA, REGOLITO_CENIZA, type PaletaTerreno } from "@/juego/paleta";

// Tres mapas del Cinturón de la Deriva, cada uno con su propia semilla de
// terreno, su gravedad, su deriva (magnitud y sentido) y su etiqueta de
// origen -- el dato que render-6 comprueba que llega de verdad hasta el
// indicador, no un literal repetido en las tres.
export interface MapaJuego {
  readonly id: string;
  readonly nombre: string;
  readonly semillaTerreno: number;
  readonly semillaPartida: number;
  readonly mundo: ParametrosMundo;
  readonly paleta: PaletaTerreno;
}

export const DESGUACE_DEL_ECUADOR: MapaJuego = {
  id: "desguace-del-ecuador",
  nombre: "Desguace del Ecuador",
  semillaTerreno: 20260925,
  semillaPartida: 1,
  mundo: {
    ancho: MUNDO_ANCHO,
    alto: MUNDO_ALTO,
    gravedad: 1.0,
    // Deriva negativa: empuja hacia -x. El nombre describe la causa en el
    // propio mapa, no un genérico "viento".
    deriva: -18,
    etiquetaDeriva: "Estela de un remolcador que ya no vuelve",
  },
  paleta: CHATARRA_OXIDADA,
};

export const CALMA_DE_LOS_RESTOS: MapaJuego = {
  id: "calma-de-los-restos",
  nombre: "Calma de los Restos",
  semillaTerreno: 71,
  semillaPartida: 2,
  mundo: {
    ancho: MUNDO_ANCHO,
    alto: MUNDO_ALTO,
    gravedad: 0.85,
    deriva: 0,
    etiquetaDeriva: "Sin corriente: el cementerio está en calma",
  },
  paleta: REGOLITO_CENIZA,
};

export const CORRIENTE_DE_ESTRIBOR: MapaJuego = {
  id: "corriente-de-estribor",
  nombre: "Corriente de Estribor",
  semillaTerreno: 314159,
  semillaPartida: 3,
  mundo: {
    ancho: MUNDO_ANCHO,
    alto: MUNDO_ALTO,
    gravedad: 1.3,
    // Deriva positiva: empuja hacia +x.
    deriva: 26,
    etiquetaDeriva: "Corriente de gravedad de una luna vecina",
  },
  paleta: ESCORIA_VERDOSA,
};

export const MAPAS: readonly MapaJuego[] = [DESGUACE_DEL_ECUADOR, CALMA_DE_LOS_RESTOS, CORRIENTE_DE_ESTRIBOR];

export function buscarMapa(id: string): MapaJuego {
  const mapa = MAPAS.find((candidato) => candidato.id === id);
  if (!mapa) {
    throw new Error(`buscarMapa: no existe ningún mapa con id "${id}"`);
  }
  return mapa;
}

export const MAPA_POR_DEFECTO = DESGUACE_DEL_ECUADOR;
