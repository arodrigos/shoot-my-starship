import type { TipoEventoHumor } from "@/sim/partida/eventos";
import { TIPOS_EVENTO_HUMOR } from "@/sim/partida/eventos";

// humor-sistemico: banco mínimo de 6 frases por combinación de tipo de
// evento y personalidad (7 x 3 = 21 combinaciones, 126 frases), para que el
// selector sin repetición (selectorFrases.ts) tenga de dónde tirar. Vive en
// src/contenido junto a no-copiar.md/noCopiar.ts porque es texto propio, no
// lógica de simulación ni de presentación -- ninguna de las dos fronteras
// que vigilan los scripts de comprobación necesita saber que existe.
//
// Deliberadamente NO reutiliza Personalidad.bancoDeFrases (ia-personalidades):
// ese banco es plano (una lista por personalidad, sin evento asociado, ya
// probado por ia-6) y este necesita granularidad por evento -- son dos
// colecciones con propósitos distintos, no una duplicada.
export type BancoReacciones = Readonly<Record<string, Readonly<Record<TipoEventoHumor, readonly string[]>>>>;

export const BANCO_REACCIONES: BancoReacciones = {
  "la-contable": {
    autoimpacto: [
      "Anoto el golpe como gasto propio. Al menos el asiento contable cuadra.",
      "Me he facturado a mí misma. Qué eficiencia.",
      "Pérdida operativa autoinfligida. Lo archivo bajo \"errores del propio ejercicio\".",
      "Descuento de nómina automático: me lo he cobrado yo sola.",
      "Un cargo inesperado en mi propia cuenta. Al menos sé quién lo aprobó.",
      "Provisiono por daños propios. Empezamos fuerte el trimestre.",
    ],
    "deriva-traiciona": [
      "El viento se ha llevado el disparo como un gasto no deducible.",
      "Pérdida por factores externos. La deriva no figura en mi previsión.",
      "Ajusto el balance: el aire ha cobrado comisión por el trayecto.",
      "Reclamaré al viento. No tiene número de cuenta, así que dudo que cobre.",
      "Registro el fallo como caso de fuerza mayor. El viento no firma contratos.",
      "El aire se ha quedado con el margen que yo había calculado.",
    ],
    "derrumbe-bajo-el-lider": [
      "El terreno bajo quien iba en cabeza se ha depreciado de golpe.",
      "Ajuste de valor a la baja: el suelo ya no sostiene el liderazgo.",
      "Quien iba arriba en la cuenta de resultados, ahora va abajo en la física.",
      "El activo más sólido de la partida ha dejado de serlo, literalmente.",
      "Reclasifico el liderazgo como pasivo contingente.",
      "El suelo ha hecho lo que yo llevo un rato pidiendo: recortar la ventaja del líder.",
    ],
    "arma-falla": [
      "El arma ha fallado su tirada de fiabilidad. Lo anoto como gasto sin retorno.",
      "Cero rendimiento sobre la inversión de este disparo.",
      "El petardo, nunca mejor dicho, ha resultado ser papel mojado.",
      "Provisiono este disparo como pérdida total. Sin excepciones contractuales.",
      "El arma ha incumplido su propia garantía de fiabilidad.",
      "Un gasto que no genera ni ruido decente. Lamentable en el sentido literal.",
    ],
    enterrado: [
      "La nave queda enterrada. Actualizo su valor contable a \"inaccesible\".",
      "Sepultada bajo un pasivo de tierra que nadie presupuestó.",
      "El terreno ha capitalizado sobre mi posición sin previo aviso.",
      "Registro el entierro como inmovilizado, en el sentido más literal.",
      "Ya no hay activo que valorar si no se puede ni ver.",
      "El suelo se ha cobrado intereses en forma de escombro.",
    ],
    "caida-al-vacio": [
      "El suelo bajo mis pies deja de figurar en el balance. Sin previo aviso.",
      "Cotización del terreno: cero. Sigo aquí de milagro contable.",
      "Un activo entero ha desaparecido del inventario: el suelo.",
      "Provisiono por riesgo de caída. Un poco tarde, la verdad.",
      "Me he quedado sin base sobre la que sostener ninguna cifra.",
      "El vacío no cotiza en ningún mercado que yo conozca.",
    ],
    "tiro-imposible-acertado": [
      "Un rendimiento estadísticamente imposible. Lo registro igual, contra mi criterio.",
      "Ese ángulo no debería figurar en ninguna hoja de cálculo seria.",
      "El resultado no cuadra con ninguna proyección que yo haya hecho.",
      "Beneficio inesperado. No preguntaré de dónde ha salido.",
      "Esto rompe hasta mi modelo más optimista.",
      "Anoto el acierto. La explicación se la dejo a otro departamento.",
    ],
  },
  "almirante-bisagra": {
    autoimpacto: [
      "Anote, teniente: fuego amigo. El enemigo, esta vez, era yo.",
      "Me he honrado con una salva a mí mismo. Que conste en acta.",
      "Un almirante no se dispara. Un almirante... se autoinflige disciplina.",
      "Consigne que el impacto fue estratégico. Contra mi propio casco.",
      "He flanqueado al enemigo por el único lado desprotegido: el mío.",
      "Que la posteridad no vea esta maniobra. O que la vea con orgullo. Decida usted, teniente.",
    ],
    "deriva-traiciona": [
      "El viento ha desertado a mitad de vuelo, teniente. Que conste su traición.",
      "Consigne que el enemigo, esta vez, fue la atmósfera.",
      "Ninguna flota ha vencido jamás al viento. Hoy tampoco lo hemos hecho nosotros.",
      "El aire se ha insubordinado. Fusílenlo. Ah, no se puede. Anótelo igual.",
      "Mi puntería era impecable. El clima, no tanto.",
      "Que la crónica diga que el viento cambió de bando sin avisar.",
    ],
    "derrumbe-bajo-el-lider": [
      "El terreno bajo el que manda la flota se ha rendido sin consultarme.",
      "Anote: hasta el suelo se subleva contra quien va ganando.",
      "Ni la roca más firme aguanta el peso de tanto orgullo, teniente.",
      "El líder pierde apoyo. Metafórica y literalmente, para más inri.",
      "Consigne que el terreno ha decidido nivelar la contienda por su cuenta.",
      "Quien iba en cabeza ahora está, cómo decirlo, un poco más abajo.",
    ],
    "arma-falla": [
      "El arma se ha negado a cumplir órdenes, teniente. Insubordinación mecánica.",
      "Consigne el fallo como acto de cobardía del arsenal, no del artillero.",
      "Ni el cañón más glorioso está libre de un mal día.",
      "Anote: el enemigo sigue en pie porque el arma ha decidido no presentarse.",
      "Esto no es un fallo. Es una pausa dramática mal calculada.",
      "El arma ha desertado en el momento más inoportuno posible.",
    ],
    enterrado: [
      "La nave ha sido sepultada, teniente. Que conste como retirada involuntaria.",
      "Ni la mejor flota resiste que el propio planeta la entierre.",
      "Consigne que hemos sido superados en número por la tierra misma.",
      "El honor sigue intacto. La visibilidad, no tanto.",
      "Un almirante no se rinde. Un almirante, simplemente, queda cubierto de escombros.",
      "Anote esto como asedio, pero del terreno, no del enemigo.",
    ],
    "caida-al-vacio": [
      "El terreno se ha retirado de la contienda sin previo aviso, teniente.",
      "Consigne que hemos perdido el suelo, no la batalla.",
      "Un almirante flota sobre el vacío con la dignidad que puede reunir.",
      "Anote: el mapa tenía un agujero y lo hemos encontrado con estilo.",
      "Ni el más firme terreno aguanta el peso de esta guerra.",
      "Que la crónica diga que caímos al abismo con la barbilla bien alta.",
    ],
    "tiro-imposible-acertado": [
      "Ese disparo desafía toda doctrina naval conocida, teniente.",
      "Consigne el acierto como milagro, no como maniobra.",
      "Ni en mis mejores memorias habría escrito un ángulo así.",
      "Anote que la física ha decidido tomarse el día libre.",
      "Esto no se enseña en ninguna academia. Debería, pero no se enseña.",
      "Un tiro imposible, ejecutado con la elegancia de lo accidental.",
    ],
  },
  chispa: {
    autoimpacto: [
      "¡Ups! Perdona, casco, no era para ti.",
      "Vale, técnicamente eso también cuenta como práctica de puntería.",
      "Me he dado a mí misma. Al menos el ángulo estaba perfecto.",
      "¡Ese cable no iba ahí! Ni ese disparo tampoco.",
      "Auch. Bueno, ya sabía yo que algo iba a fallar, no pensé que fuera yo.",
      "Anótalo como daño colateral. El colateral era yo.",
    ],
    "deriva-traiciona": [
      "¡El viento se lo ha llevado! Oye, eso iba dirigido, ¿eh?",
      "Iba perfecto hasta que el aire ha decidido opinar.",
      "Traicionada por la brisa. Ni que fuéramos amigas.",
      "Eso iba que ni pintado. Literal, se ha desviado como pintura mal seca.",
      "El viento tiene mejor puntería que yo y encima juega para el otro equipo.",
      "Vale, esa la doy por buena igual. El viento la ha currado más que yo.",
    ],
    "derrumbe-bajo-el-lider": [
      "¡Eh! ¡Eso no estaba en el plan, pero menuda cabezada le ha dado el suelo al que iba ganando!",
      "El terreno se ha hundido justo debajo del líder. Yo no he sido. Bueno, sí, pero sin querer.",
      "Toma, un poco de justicia geológica para quien iba tan tranquilo arriba.",
      "¡Se le ha movido el suelo de verdad! No es una forma de hablar.",
      "El líder acaba de descubrir que el suelo también tiene opinión.",
      "Eso ha sido más satisfactorio de lo que debería admitir en voz alta.",
    ],
    "arma-falla": [
      "¡Vamos, funciona, funciona... vale, no funciona!",
      "Eso iba a ser espectacular. Ha sido, en cambio, silencioso.",
      "Le prometí a esta arma que hoy sí. Le he mentido, al parecer.",
      "Un mal día para el arma, un peor día para mi credibilidad.",
      "Técnicamente ha disparado. Técnicamente nada más.",
      "Anda que no le he dado yo cariño a este cacharro para esto.",
    ],
    enterrado: [
      "¡Me han enterrado! Bueno, técnicamente el suelo, pero el efecto es el mismo.",
      "Un poco de tierra nunca mató a nadie. A la visibilidad, sí.",
      "Ahora soy oficialmente parte del paisaje.",
      "Esto es peor que cuando se me atascó la puerta del taller.",
      "Sepultada por mi propio terreno favorito. Qué ironía tan específica.",
      "Al menos aquí abajo hace fresquito.",
    ],
    "caida-al-vacio": [
      "¡Uy! ¿Dónde ha ido el suelo? ¿Alguien ha visto el suelo?",
      "Esto no estaba en los planos. Bueno, nada de esto estaba en los planos.",
      "¡Sujeta esto! Ah, no hay nada que sujetar. Ni nadie.",
      "Técnicamente estoy volando. Técnicamente no por elección propia.",
      "El suelo se ha ido de vacaciones sin avisarme.",
      "Vale, esto sí que no lo había probado en el taller.",
    ],
    "tiro-imposible-acertado": [
      "¡¿Cómo ha entrado eso?! No, en serio, explicádmelo, que lo quiero repetir.",
      "Eso iba a cualquier lado menos ahí. Y ha ido ahí.",
      "La física me debe una explicación. Y yo le debo una disculpa.",
      "¡Ni planeándolo mil años me sale eso otra vez!",
      "Voy a fingir que era el plan desde el principio.",
      "Esto entra en el cuaderno de \"cosas que no debieron pasar pero pasaron\".",
    ],
  },
};

// Falla explícitamente (en vez de devolver un banco vacío o inventar una
// frase por defecto) si falta la combinación: un banco incompleto es un
// hueco de contenido, no un caso normal que la selección deba encubrir.
export function frasesPara(personalidadId: string, tipoEvento: TipoEventoHumor): readonly string[] {
  const porPersonalidad = BANCO_REACCIONES[personalidadId];
  if (!porPersonalidad) {
    throw new Error(`frasesPara: no hay banco de reacciones para la personalidad "${personalidadId}"`);
  }
  const frases = porPersonalidad[tipoEvento];
  if (!frases || frases.length === 0) {
    throw new Error(`frasesPara: banco vacío para "${personalidadId}" / "${tipoEvento}"`);
  }
  return frases;
}

// Usado por humor-3/humor-8 para recorrer todas las combinaciones sin
// duplicar la lista de tipos ni de personalidades en el propio test.
export function combinacionesDelBanco(): { personalidadId: string; tipoEvento: TipoEventoHumor }[] {
  const combinaciones: { personalidadId: string; tipoEvento: TipoEventoHumor }[] = [];
  for (const personalidadId of Object.keys(BANCO_REACCIONES)) {
    for (const tipoEvento of TIPOS_EVENTO_HUMOR) {
      combinaciones.push({ personalidadId, tipoEvento });
    }
  }
  return combinaciones;
}
