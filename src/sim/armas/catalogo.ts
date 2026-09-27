import type { Arma } from "@/sim/armas/tipos";

// Las diez armas del diseño aprobado, declaradas como datos puros (armas-1):
// añadir un arma nueva es añadir una entrada aquí, nunca una rama de código
// nueva en el resolutor. Los nombres, descripciones y voces son el humor
// autoral de catálogo -- lo revisa Adrián en su punto HITL, y su material se
// contrasta contra no-copiar.md (armas-5) para no colarse en el terreno de
// otra franquicia por inercia del corpus de entrenamiento.
export const CATALOGO_ARMAS: readonly Arma[] = [
  {
    id: "pepinazo-cortesia",
    nombre: "Pepinazo de Cortesía",
    descripcion:
      "El arma que viene de serie. Hace exactamente lo que promete y nada más, como un funcionario a las dos menos cinco.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 44, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 70, danioMaximo: 20 },
    fiabilidad: 1,
  },
  {
    id: "tostadora-orbital",
    nombre: "Tostadora Orbital",
    descripcion: "Alguien le quitó la resistencia a una tostadora y le atornilló un cañón. Sale recta, sale rápida y el impacto huele a desayuno.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 26, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 50, danioMaximo: 30 },
    fiabilidad: 1,
  },
  {
    id: "mortero-lamentable",
    nombre: "Mortero Lamentable",
    descripcion: "Sube tanto que da tiempo a arrepentirse, redactar una disculpa y verla bajar.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "capsula", medioLargoPx: 50, radio: 22, signo: "restar" },
    // impacto-naves (imp-7): 90px superaba el tope de 70px que fija el
    // diseño para cualquier arma salvo Despedida -- valor de catálogo previo
    // a este bloque, corregido aquí (ver desviaciones).
    efecto: { tipo: "danio", radioEfectoPx: 65, danioMaximo: 24 },
    fiabilidad: 1,
  },
  {
    id: "zanjadora-manolita",
    nombre: "Zanjadora Manolita",
    descripcion: "No mata a nadie. Reorganiza el planeta, que a la larga es peor.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "capsula", medioLargoPx: 90, radio: 15, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 30, danioMaximo: 4 },
    fiabilidad: 1,
  },
  {
    id: "vertedero-portatil",
    nombre: "Vertedero Portátil",
    descripcion: "La única arma que aumenta el patrimonio del enemigo mientras le arruina la vida.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 52, signo: "sumar" },
    efecto: { tipo: "danio", radioEfectoPx: 0, danioMaximo: 0 },
    fiabilidad: 1,
  },
  {
    id: "racimo-de-tuppers",
    nombre: "Racimo de Tuppers",
    descripcion: "Se abre a media altura y reparte. Nadie ha conseguido saber qué había dentro y nadie quiere.",
    comportamiento: { tipo: "submuniciones", cantidad: 5, dispersionPxS: 220 },
    huella: { tipo: "circular", radio: 17, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 42, danioMaximo: 11 },
    fiabilidad: 1,
  },
  {
    id: "petardo-de-feria",
    nombre: "Petardo de Feria",
    descripcion: "Fabricado un jueves. Funciona tres de cada cuatro veces, y la cuarta es la graciosa.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 30, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 60, danioMaximo: 22 },
    fiabilidad: 0.75,
  },
  {
    id: "pelota-de-chatarra",
    nombre: "La Pelota de Chatarra",
    descripcion: "Paciente. Va bajando. Encuentra tu agujero antes que tú.",
    comportamiento: { tipo: "rodante", distanciaMaximaPx: 140, pasoPx: 4 },
    huella: { tipo: "circular", radio: 34, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 55, danioMaximo: 18 },
    fiabilidad: 1,
  },
  {
    id: "graviton-segunda-mano",
    nombre: "Gravitón de Segunda Mano",
    descripcion: "No te hace daño: te cambia de sitio. El daño lo eliges tú al aterrizar.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "ninguna" },
    efecto: { tipo: "empuje", desplazamientoPx: 130 },
    fiabilidad: 1,
  },
  {
    id: "despedida",
    nombre: "Despedida",
    descripcion: "Se dispara desde el propio casco. Si te la juegas, hazlo con estilo.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 95, signo: "restar" },
    efecto: {
      tipo: "danio-y-autodanio",
      radioEfectoPx: 130,
      danioMaximo: 60,
      autoDanioMaximo: 25,
      radioAutoHuellaPx: 40,
    },
    fiabilidad: 1,
    usosMaximos: 1,
  },
];

export function buscarArma(id: string): Arma {
  const arma = CATALOGO_ARMAS.find((candidata) => candidata.id === id);
  if (!arma) {
    throw new Error(`buscarArma: no existe ningún arma con id "${id}" en el catálogo`);
  }
  return arma;
}
