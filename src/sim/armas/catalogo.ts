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
    coste: 0,
  },
  {
    id: "tostadora-orbital",
    nombre: "Tostadora Orbital",
    descripcion: "Alguien le quitó la resistencia a una tostadora y le atornilló un cañón. Sale recta, sale rápida y el impacto huele a desayuno.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 26, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 50, danioMaximo: 30 },
    fiabilidad: 1,
    coste: 30,
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
    coste: 40,
  },
  {
    id: "zanjadora-manolita",
    nombre: "Zanjadora Manolita",
    descripcion: "No mata a nadie. Reorganiza el planeta, que a la larga es peor.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "capsula", medioLargoPx: 90, radio: 15, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 30, danioMaximo: 4 },
    fiabilidad: 1,
    coste: 0,
  },
  {
    id: "vertedero-portatil",
    nombre: "Vertedero Portátil",
    descripcion: "La única arma que aumenta el patrimonio del enemigo mientras le arruina la vida.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 52, signo: "sumar" },
    efecto: { tipo: "danio", radioEfectoPx: 0, danioMaximo: 0 },
    fiabilidad: 1,
    coste: 20,
  },
  {
    id: "racimo-de-tuppers",
    nombre: "Racimo de Tuppers",
    descripcion: "Se abre a media altura y reparte. Nadie ha conseguido saber qué había dentro y nadie quiere.",
    comportamiento: { tipo: "submuniciones", cantidad: 5, dispersionPxS: 220 },
    huella: { tipo: "circular", radio: 17, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 42, danioMaximo: 11 },
    fiabilidad: 1,
    coste: 50,
  },
  {
    id: "petardo-de-feria",
    nombre: "Petardo de Feria",
    descripcion: "Fabricado un jueves. Funciona tres de cada cuatro veces, y la cuarta es la graciosa.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 30, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 60, danioMaximo: 22 },
    fiabilidad: 0.75,
    coste: 0,
    // armas-nuevas (arm-5): el eje de dispersión mide precisión real, no
    // fiabilidad -- el Petardo ya tenía un 25% de fallo total (fiabilidad-6);
    // ahora ADEMÁS de fallar a veces, cuando no falla sale torcido.
    dispersionGrados: 6,
  },
  {
    id: "pelota-de-chatarra",
    nombre: "La Pelota de Chatarra",
    descripcion: "Paciente. Va bajando. Encuentra tu agujero antes que tú.",
    comportamiento: { tipo: "rodante", distanciaMaximaPx: 140, pasoPx: 4 },
    huella: { tipo: "circular", radio: 34, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 55, danioMaximo: 18 },
    fiabilidad: 1,
    coste: 35,
  },
  {
    id: "graviton-segunda-mano",
    nombre: "Gravitón de Segunda Mano",
    descripcion: "No te hace daño: te cambia de sitio. El daño lo eliges tú al aterrizar.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "ninguna" },
    efecto: { tipo: "empuje", desplazamientoPx: 130 },
    fiabilidad: 1,
    coste: 45,
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
    coste: 80,
  },
  // armas-nuevas: las tres armas que ejercitan los ejes nuevos de verdad
  // (ráfaga, penetración, inmunidad a gravedad). El diseño narra once armas
  // con estos tres nombres sustituyendo a parte del catálogo anterior; aquí
  // se AÑADEN sin tocar las diez de arriba -- ver desviaciones en el
  // entregable, motivo: quitar o renombrar armas ya mergeadas arriesga
  // romper imp-*/ia-* que las referencian por id, y arm-1/arm-2 solo piden
  // "10 armas o más" con los ejes nuevos presentes, no un recuento exacto.
  {
    id: "andanada-de-flechas",
    nombre: "Andanada de Flechas",
    descripcion: "Tres a la vez, en abanico. Ninguna con puntería, pero entre las tres siempre hay alguna maleducada.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 14, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 40, danioMaximo: 14 },
    fiabilidad: 1,
    coste: 55,
    dispersionGrados: 3,
    disparosSimultaneos: { cantidad: 3, aperturaGrados: 12 },
  },
  {
    id: "barrena-planetaria",
    nombre: "Barrena Planetaria",
    descripcion: "No detona al tocar tierra: sigue. Sale por el otro lado, si el otro lado existe.",
    comportamiento: { tipo: "impacto-simple" },
    // radio 32 (no 20): un taladro deja un agujero más grande que una bomba
    // normal -- y de paso evita que su silueta (proy-1) empate con la de
    // Andanada/Láser, cuyos radios pequeños caen los tres en el mismo suelo
    // de tamaño mínimo si se dejan por debajo de 24px.
    huella: { tipo: "circular", radio: 32, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 45, danioMaximo: 26 },
    fiabilidad: 1,
    coste: 90,
    penetracionPx: 260,
  },
  {
    id: "rayo-laser",
    nombre: "Rayo Láser",
    descripcion: "Va recto porque la gravedad no le ha convencido nunca. Cara, pero convence a quien la paga.",
    comportamiento: { tipo: "instantaneo" },
    // "circular" con radio propio (nunca "ninguna"): compartir huella con el
    // Gravitón le daría el mismo radioDeCatalogo() en juego/proyectiles y
    // colisionaría su huella visual (hashSilueta) con la suya en proy-1.
    // radio 25 (no 12): por debajo de 24px, cualquier arma "bomba" cae en el
    // mismo suelo de tamaño mínimo de puntosSilueta() y su silueta empataría
    // con la de otra arma pequeña del catálogo (proy-1, hash sin colisiones).
    huella: { tipo: "circular", radio: 25, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 55, danioMaximo: 28 },
    fiabilidad: 1,
    coste: 120,
    inmuneAGravedad: true,
  },
  // arma-mosca (mos-1..mos-5): la que pidió Adrián en persona -- no sigue la
  // parábola, revolotea alrededor de ella hasta chocar. "erratico" con
  // fiabilidad 1 y sin dispersionGrados (nunca falla del todo ni sale
  // torcida de salida): toda su rareza es la perturbación por paso, no un
  // eje distinto ya cubierto por otra arma.
  {
    id: "mosca-cojonera",
    nombre: "Mosca Cojonera",
    descripcion:
      "Sale del cañón y decide por su cuenta. No es que falle: es que tiene otros planes hasta que choca con algo.",
    comportamiento: { tipo: "erratico", magnitudPxS2: 90 },
    huella: { tipo: "circular", radio: 20, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 45, danioMaximo: 16 },
    fiabilidad: 1,
    coste: 40,
    notaAyuda: "Avisa: no vuela recta, hace eses todo el camino hasta que choca.",
    bromaPropia: {
      disparo: ["Ahí va. Que le vaya bien a donde sea que decida ir."],
      impacto: ["Ha aterrizado. Ni ella se lo esperaba."],
    },
  },
  // arma-granada-espoleta (gra-1..gra-5): la primera de las dos armas de
  // cuenta atrás -- "mecha" con fiabilidad 1 y sin dispersionGrados, porque
  // su rareza no es fallar ni salir torcida, es que el reloj corre desde el
  // disparo pase lo que pase por el camino.
  {
    id: "granada-de-espoleta",
    nombre: "Granada de Espoleta",
    descripcion: "Cuenta hasta cinco en voz alta desde que sale del cañón. Le da igual dónde esté cuando llegue.",
    comportamiento: { tipo: "mecha", segundosHastaDetonar: 5 },
    huella: { tipo: "circular", radio: 40, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 60, danioMaximo: 24 },
    fiabilidad: 1,
    coste: 45,
    notaAyuda: "La cuenta empieza al disparar, no al tocar: a los 5 s explota donde esté, en el aire o en el suelo.",
    bromaPropia: {
      disparo: ["Cinco, cuatro... empieza a contar en cuanto sale, le toque lo que le toque."],
      impacto: ["Cero. Exactamente donde le tocaba, ni un paso antes."],
    },
  },
];

export function buscarArma(id: string): Arma {
  const arma = CATALOGO_ARMAS.find((candidata) => candidata.id === id);
  if (!arma) {
    throw new Error(`buscarArma: no existe ningún arma con id "${id}" en el catálogo`);
  }
  return arma;
}
