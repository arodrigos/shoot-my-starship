import type { Arma } from "@/sim/armas/tipos";

// Las diez armas del diseño aprobado, declaradas como datos puros (armas-1):
// añadir un arma nueva es añadir una entrada aquí, nunca una rama de código
// nueva en el resolutor. Los nombres, descripciones y voces son el humor
// autoral de catálogo -- lo revisa Adrián en su punto HITL, y su material se
// contrasta contra no-copiar.md (armas-5) para no colarse en el terreno de
// otra franquicia por inercia del corpus de entrenamiento.
// armas-reprecio-roles: coste y rol de cada arma salen de la curva
// declarada en docs/facilidad-armas.md (precio = combinación de daño y
// facilidad MEDIDA por npm run medir:armas, nunca a mano) -- ver
// src/sim/armas/precio.ts para la fórmula y tests/unit/armas/
// armas-reprecio-roles.test.ts para la comprobación de desviación <=15%.
// Las tres gratis (zanjadora, petardo, pelota) son las de daño más bajo del
// catálogo con facilidad medida por debajo de la mediana -- pepinazo deja
// de ser gratis Y de ser de las fáciles, exactamente lo que pide el
// criterio 2. zanjadora conserva danioMaximo:4 sin tocar: decidir.ts
// (UMBRAL_DANIO_SUFICIENTE_POR_TURNO = 5) depende de que un impacto directo
// de ARMA_DE_DESBLOQUEO nunca cuente como "daño suficiente" -- subirlo a 5
// o más habría cambiado el comportamiento de ia-n7 sin que ningún criterio
// de este bloque lo pidiera.
export const CATALOGO_ARMAS: readonly Arma[] = [
  {
    id: "pepinazo-cortesia",
    nombre: "Pepinazo de Cortesía",
    descripcion:
      "El arma que viene de serie. Hace exactamente lo que promete y nada más, como un funcionario a las dos menos cinco.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 44, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 55, danioMaximo: 18 },
    fiabilidad: 1,
    coste: 55,
    rol: "equilibrada: ni la más floja ni la más fuerte",
  },
  {
    id: "tostadora-orbital",
    nombre: "Tostadora Orbital",
    descripcion: "Alguien le quitó la resistencia a una tostadora y le atornilló un cañón. Sale recta, sale rápida y el impacto huele a desayuno.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 26, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 42, danioMaximo: 32 },
    fiabilidad: 1,
    coste: 75,
    rol: "daño alto con radio contenido: exige puntería, no regala área",
  },
  {
    id: "mortero-lamentable",
    nombre: "Mortero Lamentable",
    descripcion: "Sube tanto que da tiempo a arrepentirse, redactar una disculpa y verla bajar.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "capsula", medioLargoPx: 50, radio: 22, signo: "restar" },
    // impacto-naves (imp-7): 90px superaba el tope de 70px que fija el
    // diseño para cualquier arma salvo Despedida -- valor de catálogo previo
    // a este bloque, corregido aquí (ver desviaciones). armas-reprecio-roles
    // lo deja justo en el tope (70, nunca por encima).
    efecto: { tipo: "danio", radioEfectoPx: 70, danioMaximo: 24 },
    fiabilidad: 1,
    coste: 65,
    rol: "área máxima permitida: perdona el error de ángulo, cuesta en consecuencia",
  },
  {
    id: "zanjadora-manolita",
    nombre: "Zanjadora Manolita",
    descripcion: "No mata a nadie. Reorganiza el planeta, que a la larga es peor.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "capsula", medioLargoPx: 90, radio: 15, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 56, danioMaximo: 4 },
    fiabilidad: 1,
    coste: 0,
    rol: "gratis, de daño bajo y difícil de acertar -- fondo de armario",
  },
  {
    id: "vertedero-portatil",
    nombre: "Vertedero Portátil",
    descripcion: "La única arma que aumenta el patrimonio del enemigo mientras le arruina la vida.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 52, signo: "sumar" },
    efecto: { tipo: "danio", radioEfectoPx: 0, danioMaximo: 0 },
    fiabilidad: 1,
    // armas-reprecio-roles-5: precio por volumen de terreno AÑADIDO (no
    // "retirado" -- su huella es signo "sumar", ver desviaciones), medido
    // por medirVolumenTerreno() en vez de daño. Ver precio.ts.
    coste: 15,
    // ia-autodanio-4: daño 0 a propósito (rellena terreno, no hiere), no un
    // descuido del catálogo -- ver tipos.ts.
    utilitaria: true,
    rol: "utilitaria: rellena terreno, precio por volumen afectado, no por daño",
  },
  {
    id: "racimo-de-tuppers",
    nombre: "Racimo de Tuppers",
    descripcion: "Se abre a media altura y reparte. Nadie ha conseguido saber qué había dentro y nadie quiere.",
    comportamiento: { tipo: "submuniciones", cantidad: 5, dispersionPxS: 220 },
    huella: { tipo: "circular", radio: 17, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 62, danioMaximo: 20 },
    fiabilidad: 1,
    coste: 85,
    rol: "cinco proyectiles dispersos: área grande repartida en vez de concentrada",
  },
  {
    id: "petardo-de-feria",
    nombre: "Petardo de Feria",
    descripcion: "Fabricado un jueves. Funciona tres de cada cuatro veces, y la cuarta es la graciosa.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 30, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 62, danioMaximo: 13 },
    fiabilidad: 0.75,
    coste: 0,
    // armas-nuevas (arm-5): el eje de dispersión mide precisión real, no
    // fiabilidad -- el Petardo ya tenía un 25% de fallo total (fiabilidad-6);
    // ahora ADEMÁS de fallar a veces, cuando no falla sale torcido.
    dispersionGrados: 6,
    rol: "gratis, de daño bajo, difícil y además una de cada cuatro falla del todo",
  },
  {
    id: "pelota-de-chatarra",
    nombre: "La Pelota de Chatarra",
    descripcion: "Paciente. Va bajando. Encuentra tu agujero antes que tú.",
    comportamiento: { tipo: "rodante", distanciaMaximaPx: 140, pasoPx: 4 },
    huella: { tipo: "circular", radio: 34, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 30, danioMaximo: 8 },
    fiabilidad: 1,
    coste: 0,
    rol: "gratis, de daño bajo: rueda hasta un agujero, pero no garantiza cuál",
  },
  {
    id: "graviton-segunda-mano",
    nombre: "Gravitón de Segunda Mano",
    descripcion: "No te hace daño: te cambia de sitio. El daño lo eliges tú al aterrizar.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "ninguna" },
    efecto: { tipo: "empuje", desplazamientoPx: 130 },
    fiabilidad: 1,
    // armas-reprecio-roles-5: segunda arma de daño 0. Su mecánica real no
    // toca terreno (huella "ninguna") sino que reposiciona a la nave, así
    // que el eje de precio es el desplazamiento, no un volumen de terreno
    // que no existe para ella -- ver desviaciones.
    coste: 45,
    utilitaria: true,
    rol: "utilitaria: reposiciona, precio por magnitud del desplazamiento, no por daño",
  },
  {
    id: "despedida",
    nombre: "Despedida",
    descripcion: "Se dispara desde el propio casco. Si te la juegas, hazlo con estilo.",
    comportamiento: { tipo: "impacto-simple" },
    huella: { tipo: "circular", radio: 95, signo: "restar" },
    efecto: {
      tipo: "danio-y-autodanio",
      radioEfectoPx: 115,
      danioMaximo: 55,
      autoDanioMaximo: 23,
      radioAutoHuellaPx: 40,
    },
    fiabilidad: 1,
    usosMaximos: 1,
    coste: 120,
    rol: "la más cara y la más dañina: un solo uso, con autodaño real de por medio",
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
    efecto: { tipo: "danio", radioEfectoPx: 34, danioMaximo: 16 },
    fiabilidad: 1,
    coste: 105,
    dispersionGrados: 3,
    disparosSimultaneos: { cantidad: 3, aperturaGrados: 12 },
    rol: "tres proyectiles en abanico: cubre un ángulo, no un punto",
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
    efecto: { tipo: "danio", radioEfectoPx: 38, danioMaximo: 44 },
    fiabilidad: 1,
    coste: 90,
    penetracionPx: 260,
    rol: "atraviesa terreno y pega fuerte: cara y de las de más daño",
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
    // radioEfectoPx 80 (no menos): RADIO_CASCO_NAVE_PX es 22, y danioPorDistancia
    // da 0 si la distancia al impacto >= radioEfectoPx -- un valor por debajo
    // de 23 deja un impacto justo en el borde del casco (arm-8) sin hacer daño
    // nunca. Con un valor pequeño (p. ej. 30) cae en la banda [20,40) de radio,
    // que ya tiene sus 4 armas (armas-reprecio-roles-4); 80 cae en la única
    // banda libre y la facilidad medida sigue siendo la más baja del catálogo
    // porque, al ser recta e inmune a la gravedad, falla por geometría (sin
    // línea de visión directa) mucho más de lo que un radio mayor compensa.
    efecto: { tipo: "danio", radioEfectoPx: 80, danioMaximo: 46 },
    fiabilidad: 1,
    // Desviación declarada (ver desviaciones en el entregable): la curva de
    // daño/facilidad por sí sola daría un precio medio, porque su facilidad
    // medida es de las más bajas del catálogo (sale recta, pero exige
    // precisión real) -- el precio se mantiene cerca del máximo porque paga
    // además la inmunidad a la gravedad, un eje que la curva no modela.
    // Coste 115 (no 120, el techo de Despedida): con 120 empataría a
    // Despedida en coste y, al tener menos daño y menos facilidad, quedaría
    // dominada por ella en el sentido del criterio 3 -- 115 rompe esa
    // comparación sin cambiar el papel de "la más cara tras Despedida".
    coste: 115,
    inmuneAGravedad: true,
    rol: "recta e inmune a la gravedad, pero de las más difíciles de acertar: cara por eso",
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
    efecto: { tipo: "danio", radioEfectoPx: 50, danioMaximo: 28 },
    fiabilidad: 1,
    coste: 75,
    notaAyuda: "Avisa: no vuela recta, hace eses todo el camino hasta que choca.",
    bromaPropia: {
      disparo: ["Ahí va. Que le vaya bien a donde sea que decida ir."],
      impacto: ["Ha aterrizado. Ni ella se lo esperaba."],
    },
    rol: "trayectoria errática: difícil de planear, castiga bien si llega",
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
    efecto: { tipo: "danio", radioEfectoPx: 62, danioMaximo: 34 },
    fiabilidad: 1,
    coste: 80,
    notaAyuda: "La cuenta empieza al disparar, no al tocar: a los 5 s explota donde esté, en el aire o en el suelo.",
    bromaPropia: {
      disparo: ["Cinco, cuatro... empieza a contar en cuanto sale, le toque lo que le toque."],
      impacto: ["Cero. Exactamente donde le tocaba, ni un paso antes."],
    },
    rol: "cuenta atrás desde el disparo: área grande, momento de detonar incierto",
  },
  // arma-mina-adherente (min-1..min-6): la segunda arma de cuenta atrás, la
  // que Adrián llamó "una especie de gancho" -- "adherente-con-mecha" con
  // fiabilidad 1 y sin dispersionGrados, igual que la granada. La diferencia
  // de verdad entre las dos no es de catálogo, es de cuándo arranca el
  // reloj: la granada cuenta desde el disparo, la mina cuenta desde que se
  // pega (notaAyuda de cada una lo deja explícito, min-5).
  {
    id: "gancho-pegajoso",
    nombre: "Gancho Pegajoso",
    descripcion: "No explota al llegar. Se agarra, espera cinco segundos y entonces sí, con toda la mala fe del mundo.",
    comportamiento: { tipo: "adherente-con-mecha", segundosHastaDetonar: 5 },
    // armas-2: huella/efecto deliberadamente distintos de los de la granada
    // (radio 40/60/24) -- una carga que se pega y elige su punto exacto de
    // contacto no necesita el mismo alcance de onda expansiva que una que
    // cae donde la física decida; un pelín más concentrada y algo más
    // dañina a cambio.
    huella: { tipo: "circular", radio: 34, signo: "restar" },
    efecto: { tipo: "danio", radioEfectoPx: 38, danioMaximo: 40 },
    fiabilidad: 1,
    coste: 85,
    notaAyuda: "La cuenta empieza al pegarse, no al disparar: se queda fija donde toque y explota 5 s después.",
    bromaPropia: {
      disparo: ["Ahí va, a buscar dónde agarrarse."],
      impacto: ["Se pegó, contó hasta cinco y cumplió su palabra."],
    },
    rol: "se pega donde toque primero: elige el punto, no el momento, y pega fuerte",
  },
];

export function buscarArma(id: string): Arma {
  const arma = CATALOGO_ARMAS.find((candidata) => candidata.id === id);
  if (!arma) {
    throw new Error(`buscarArma: no existe ningún arma con id "${id}" en el catálogo`);
  }
  return arma;
}
