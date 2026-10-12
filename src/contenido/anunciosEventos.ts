import { PREMIO_LOTERIA } from "@/sim/economia/parametros";
import { DRENAJE_BASE, RONDA_MUERTE_SUBITA } from "@/sim/partida/muerteSubita";
import { buscarEvento } from "@/sim/universo/catalogoEventos";
import { FACTOR_VITAMINAS, FRACCION_REPARACION, TURNOS_EFECTO_NAVE } from "@/sim/universo/efectos";
import { VIDA_CORAZON, VIDA_TORMENTA } from "@/sim/universo/objetos";
import type { TipoEvento } from "@/sim/universo/tipos";

export interface AnuncioEvento {
  readonly titulo: string;
  readonly explicacion: string;
}

// El título sale del catálogo para que cartel, pronóstico e histórico llamen
// igual al mismo evento; la explicación nombra el efecto con su número real.
function anuncio(tipo: TipoEvento, explicacion: string): AnuncioEvento {
  return { titulo: buscarEvento(tipo).nombre, explicacion };
}

export const ANUNCIOS_EVENTOS: Readonly<Record<TipoEvento, AnuncioEvento>> = {
  loteria: anuncio("loteria", `Gana ${PREMIO_LOTERIA} créditos`),
  vitaminas: anuncio("vitaminas", `Su daño se multiplica por ${FACTOR_VITAMINAS} durante ${TURNOS_EFECTO_NAVE} turnos`),
  virus: anuncio("virus", `Su daño se reduce a la mitad durante ${TURNOS_EFECTO_NAVE} turnos`),
  reparacion: anuncio("reparacion", `Los planetas recuperan la mitad (${Math.round(FRACCION_REPARACION * 100)} %) del terreno perdido`),
  terremoto: anuncio("terremoto", "Cada nave salta a otro sitio, a entre 1 y 2 octavos del mundo de donde estaba"),
  "gravedad-x2": anuncio("gravedad-x2", "La gravedad de los planetas se duplica (×2) durante 1 ronda"),
  "gravedad-mitad": anuncio("gravedad-mitad", "La gravedad de los planetas se reduce a la mitad (÷2) durante 1 ronda"),
  "viento-solar": anuncio("viento-solar", "Un viento solar empuja los disparos hacia un lado durante 1 ronda"),
  "agujero-negro": anuncio("agujero-negro", "Un agujero negro atrae los disparos que pasan cerca durante 1 ronda"),
  corazon: anuncio("corazon", `Aparece un corazón: quien lo toca recupera ${VIDA_CORAZON} de vida`),
  tormenta: anuncio("tormenta", `Aparece una tormenta: quien la toca pierde ${VIDA_TORMENTA} de vida`),
};

export function anuncioDeEvento(tipo: TipoEvento): AnuncioEvento {
  return ANUNCIOS_EVENTOS[tipo];
}

const TITULO_MUERTE_SUBITA = "Muerte súbita";

export function anuncioMuerteSubitaAviso(): AnuncioEvento {
  return {
    titulo: TITULO_MUERTE_SUBITA,
    explicacion: `Desde la ronda ${RONDA_MUERTE_SUBITA} todos pierden ${DRENAJE_BASE} de vida al empezar cada ronda, y cada vez ${DRENAJE_BASE} más`,
  };
}

export function anuncioMuerteSubitaDrenaje(danio: number): AnuncioEvento {
  return { titulo: TITULO_MUERTE_SUBITA, explicacion: `Todos pierden ${danio} de vida` };
}

// Lo que lee la voz: título, a quién y qué, en una frase seguida.
export function textoLocutado(anuncio: AnuncioEvento, quien: string): string {
  return `${anuncio.titulo}. ${quien}. ${anuncio.explicacion}.`;
}
