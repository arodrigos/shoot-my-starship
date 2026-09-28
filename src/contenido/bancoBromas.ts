import type { CategoriaBroma } from "@/sim/partida/categoriaBroma";
import { CATEGORIAS_BROMA } from "@/sim/partida/categoriaBroma";
import type { IdNave } from "@/sim/partida/tipos";

// humor-por-turno (hum-1, hum-3): una broma tras CADA disparo (banco plano,
// solo por nave/voz) y otra tras CADA impacto (banco por nave/voz y por
// categoría de resultado, las siete de categoriaBroma.ts). Bancos
// completamente separados de src/contenido/bancoReacciones.ts (ese es
// humor-sistemico: eventos raros, una sola voz -- este es la voz de cada
// nave, en cada turno, sin excepción).
export type IdVoz = "la-contable" | "almirante-bisagra" | "chispa";

export const VOCES_BROMAS: readonly IdVoz[] = ["la-contable", "almirante-bisagra", "chispa"];

// jugador (nave 0) no elige personalidad en el selector de inicio (ese solo
// elige rival, nave 1): para que "cada nave suena a sí misma" tenga sentido
// sin añadir un segundo selector fuera del alcance de este bloque, la nave
// del jugador toma la voz que NO sea la del rival elegido, con un desempate
// fijo cuando hay más de una candidata -- nunca la misma voz que el rival,
// así los dos bancos de una partida concreta son siempre disjuntos entre sí
// además de disjuntos entre personalidades (hum-3). Ver desviaciones.
export function vozDelJugador(rivalId: string): IdVoz {
  return rivalId === "chispa" ? "almirante-bisagra" : "chispa";
}

export function vozDeNave(idNave: IdNave, rivalId: string): IdVoz {
  if (idNave === 1) {
    return VOCES_BROMAS.includes(rivalId as IdVoz) ? (rivalId as IdVoz) : "la-contable";
  }
  return vozDelJugador(rivalId);
}

export type BancoBromasDisparo = Readonly<Record<IdVoz, readonly string[]>>;
export type BancoBromasImpacto = Readonly<Record<IdVoz, Readonly<Record<CategoriaBroma, readonly string[]>>>>;

export const BANCO_BROMAS_DISPARO: BancoBromasDisparo = {
  "la-contable": [
    "Disparo registrado. Ya veremos en qué columna cae.",
    "Cargo el cañón como quien cierra un asiento contable: sin margen de error permitido.",
    "Ahí va. Si sale mal, lo llamaré gasto de formación.",
    "Apunto con la misma frialdad con la que reviso una factura.",
    "Este disparo ya está en el libro. Lo que pase después, ya no depende de mí del todo.",
    "Potencia calculada al céntimo. Ojalá el universo cuadre igual de bien.",
  ],
  "almirante-bisagra": [
    "¡Fuego! Que quede constancia de que este almirante nunca duda.",
    "Cañón cargado, honor intacto. Disparando.",
    "Por la gloria de mi flota de una sola nave: ¡allá va!",
    "Ajusten posiciones, que disparo ya. Nadie más lo va a hacer por mí.",
    "Este disparo entra directo al parte de guerra, gane o pierda.",
    "¡Preparen los vítores! Aunque sea yo quien tenga que dármelos.",
  ],
  chispa: [
    "¡Allá va! No preguntes por dónde, que ni yo lo sé todavía.",
    "Disparo primero, calculo después. A veces al revés, si me acuerdo.",
    "Ojos cerrados, dedo en el gatillo... vale, los abro, que si no no apunto.",
    "¡Que sea lo que el universo quiera! Yo ya he hecho mi parte.",
    "Este disparo lleva toda mi confianza y ni un gramo de mi puntería.",
    "¡Fuego! Cruza los dedos, que yo ya no tengo más manos libres.",
  ],
};

export const BANCO_BROMAS_IMPACTO: BancoBromasImpacto = {
  "la-contable": {
    acierto: [
      "Impacto directo. Lo anoto como ingreso extraordinario.",
      "Diana en el casco. El balance de este turno cierra en positivo.",
      "Blanco exacto. Ni una unidad de daño desperdiciada.",
      "Ese disparo rinde más que cualquier inversión que haya hecho hoy.",
      "Acierto limpio. Así es como se justifica el presupuesto de munición.",
    ],
    casi: [
      "Rozado, no tocado. Lo anoto como pérdida evitada por poco.",
      "Un metro más y esto habría sido un ingreso, no una nota al pie.",
      "Casi cuadra el asiento. Casi no es suficiente en contabilidad.",
      "El objetivo ha salido indemne de milagro. Lo registro con disgusto.",
      "Tan cerca que duele más que un fallo de verdad.",
    ],
    "fallo-lejano": [
      "Ese disparo no figura ni de lejos en ninguna hoja de cálculo útil.",
      "Pérdida total del proyectil, sin ningún retorno que anotar.",
      "Ha caído tan lejos que ni sé en qué columna archivarlo.",
      "Gasto puro, sin ingreso que lo compense. Mal turno.",
      "El objetivo sigue exactamente donde estaba. Yo, más pobre.",
    ],
    autoimpacto: [
      "Anoto el golpe como gasto propio. Al menos el asiento cuadra.",
      "Me he facturado a mí misma otra vez. Qué eficiencia la mía.",
      "Pérdida operativa autoinfligida, capítulo dos de esta temporada.",
      "Un cargo inesperado en mi propia cuenta, y yo lo he aprobado.",
      "Provisiono por daños propios. El trimestre empieza fuerte.",
    ],
    "impacto-planeta": [
      "Cráter nuevo en el planeta. Coste asumido, beneficio nulo.",
      "El terreno se lleva el impacto que yo quería para el enemigo.",
      "Otro agujero en la roca que nadie me va a reembolsar.",
      "El planeta absorbe el gasto como si fuera su cliente favorito.",
      "Impacto contra piedra. El único que sale ganando es el paisaje.",
    ],
    "impacto-escombro": [
      "El escombro se lleva el golpe. Ni siquiera cotiza en mi balance.",
      "Chatarra contra chatarra: ningún activo real ha cambiado de manos.",
      "Impacto en los restos flotantes. Coste sin ningún retorno posible.",
      "Ese cinturón de rocas absorbe mi munición sin darme ni las gracias.",
      "Otro proyectil gastado en piedras que no van a pagar por ello.",
    ],
    "proyectil-perdido": [
      "El proyectil sigue orbitando. Lo doy de baja como pérdida indefinida.",
      "Ahí sigue, dando vueltas, sin decidirse a caer en ningún sitio.",
      "Pérdida por tiempo indeterminado: el disparo no vuelve ni con recordatorio.",
      "Ese proyectil ya cotiza como activo intangible. Nunca aterriza.",
      "Lo doy por perdido oficialmente. El universo se queda con la munición.",
    ],
  },
  "almirante-bisagra": {
    acierto: [
      "¡Impacto confirmado! Que suenen las trompetas de esta flota de uno.",
      "¡Directo al casco! Momento digno del parte de guerra.",
      "¡Blanco! La historia naval recordará este disparo con orgullo.",
      "¡Ahí tienen su merecido! Disparo limpio y honorable.",
      "¡Impacto de manual! Así se gana una guerra, aunque sea en solitario.",
    ],
    casi: [
      "¡Por muy poco! El enemigo ha esquivado por el canto de una medalla.",
      "Rozado el casco, no hundido. La próxima salva no fallará.",
      "¡Tan cerca! Casi entra en los anales, pero no del todo.",
      "El objetivo escapa por centímetros. Anoten la lección para la próxima.",
      "Casi impacto. El honor exige que lo intentemos de nuevo.",
    ],
    "fallo-lejano": [
      "Disparo perdido en el vacío. Que no conste en el parte oficial.",
      "El proyectil se ha ido tan lejos que ni el enemigo se ha dado cuenta.",
      "Fallo estrepitoso. Este almirante pide disculpas a su propia flota.",
      "Ese tiro no ha estado ni cerca. Bochornoso, francamente.",
      "El objetivo sigue intacto y a salvo, muy lejos de donde ha caído esto.",
    ],
    autoimpacto: [
      "Anote, teniente: fuego amigo. El enemigo, esta vez, era yo.",
      "Me he honrado con una salva a mí mismo. Que conste en acta.",
      "Un almirante no se dispara. Un almirante se autoinflige disciplina.",
      "Impacto propio. La corte marcial puede esperar hasta después de la guerra.",
      "He capturado mi propia nave a cañonazos. Táctica poco ortodoxa.",
    ],
    "impacto-planeta": [
      "El planeta recibe el impacto en nombre del enemigo. Casi vale igual.",
      "Cráter abierto en suelo neutral. La estrategia sigue en pie.",
      "El terreno se lleva la salva que iba dirigida a otro sitio.",
      "Impacto en roca. Ningún tratado prohíbe bombardear planetas, así que sigo.",
      "El planeta encaja el golpe con más disciplina que mi propia puntería.",
    ],
    "impacto-escombro": [
      "Los restos flotantes absorben la salva. Bajas cero, honor intacto igual.",
      "Impacto en chatarra espacial. No es gloria, pero cuenta como práctica.",
      "El cinturón de escombros se lleva este disparo sin oponer resistencia.",
      "Otro fragmento de metal muerto, ahora con un agujero más.",
      "La chatarra sirve de escudo involuntario. Buena suerte para el enemigo.",
    ],
    "proyectil-perdido": [
      "El proyectil sigue en órbita, desertando de su misión.",
      "Esa salva se ha alistado en la marina del espacio y no piensa volver.",
      "Perdido en órbita, como un soldado que se ha ido sin permiso.",
      "El disparo patrulla el vacío indefinidamente. Que Dios lo acompañe.",
      "Ese proyectil ya no responde a las órdenes de esta flota.",
    ],
  },
  chispa: {
    acierto: [
      "¡TOMA! Eso sí que lo he visto venir... más o menos.",
      "¡Le he dado! No preguntes cómo, que ni yo me lo creo.",
      "¡Diana! Apunté a la izquierda, pero bueno, el resultado es lo que cuenta.",
      "¡Boom, en el blanco! Voy a fingir que era el plan desde el principio.",
      "¡Acerté! Primera vez en el día, disfrutémoslo mientras dura.",
    ],
    casi: [
      "¡Uy, por un pelo! Casi le doy, casi me como el marrón después.",
      "Tan cerca que casi cuenta. Casi.",
      "¡Se ha librado por los pelos! Literal, casi le peino la antena.",
      "Rozado y nada más. La próxima sí, lo prometo de verdad.",
      "Vaya, casi. Bueno, casi también es una palabra bonita.",
    ],
    "fallo-lejano": [
      "¡Uy! Eso ha ido tan lejos que necesita pasaporte propio.",
      "Fallo total. En mi defensa, apuntar nunca fue lo mío.",
      "Se ha perdido por el otro lado del mapa. Ni idea de cómo.",
      "Eso no era ni la dirección correcta, para qué mentir.",
      "Fallo espectacular. Al menos ha sido decorativo.",
    ],
    autoimpacto: [
      "¡Ups! Perdona, casco, no era para ti otra vez.",
      "Me he dado a mí misma. Al menos el ángulo era bonito.",
      "Auch. Sabía que algo iba a fallar, no pensé que fuera yo.",
      "Anótalo como daño colateral. El colateral era yo, sí, otra vez.",
      "¡Ese impacto no iba ahí! Ni yo tampoco, la verdad.",
    ],
    "impacto-planeta": [
      "Le he dado al planeta entero en vez de a la nave. Buen tiro, mal objetivo.",
      "¡Cráter nuevo! El planeta no lo va a agradecer, la verdad.",
      "He abierto un agujero precioso en una roca que no me había hecho nada.",
      "El planeta se lleva el golpe que era para el enemigo. Perdón, roca.",
      "Impacto en tierra firme. Bueno, tierra flotante. Ya me entiendes.",
    ],
    "impacto-escombro": [
      "¡Le he dado a un pedrusco flotante! Al menos algo he tocado hoy.",
      "Impacto en chatarra. Técnicamente es un acierto, ¿no?",
      "Los restos espaciales acaban de recibir mi peor disparo del día.",
      "Le he dado a una roca. Una roca que no jugaba, pero bueno.",
      "Chatarra impactada con éxito. El enemigo sigue ahí, intacto.",
    ],
    "proyectil-perdido": [
      "¡Se ha ido a dar vueltas por ahí y no vuelve! Menudo compromiso.",
      "Mi disparo ha decidido quedarse a vivir en órbita. Respeto su decisión.",
      "Sigue girando y girando. Creo que le ha cogido gusto al sitio.",
      "Ese proyectil se ha independizado de mí oficialmente.",
      "Perdido en el espacio, como mis ganas de calcular ángulos.",
    ],
  },
};

// hum-3: comprobación de forma -- cada voz tiene su banco de disparo y sus
// siete categorías de impacto, todas con al menos 5 frases. Vive aquí (y no
// solo en el test) porque selectorBromas.ts la usa para fallar pronto si
// falta una combinación, en vez de descubrirlo en producción con una bolsa
// vacía.
export function bancoDisparoDe(voz: IdVoz): readonly string[] {
  return BANCO_BROMAS_DISPARO[voz];
}

export function bancoImpactoDe(voz: IdVoz, categoria: CategoriaBroma): readonly string[] {
  return BANCO_BROMAS_IMPACTO[voz][categoria];
}

export function todasLasFrasesDeBromas(): readonly string[] {
  const frases: string[] = [];
  for (const voz of VOCES_BROMAS) {
    frases.push(...BANCO_BROMAS_DISPARO[voz]);
    for (const categoria of CATEGORIAS_BROMA) {
      frases.push(...BANCO_BROMAS_IMPACTO[voz][categoria]);
    }
  }
  return frases;
}
