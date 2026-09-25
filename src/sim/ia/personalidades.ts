import type { Personalidad } from "@/sim/ia/tipos";

// Los tres rivales del punto HITL de diseño. Sus nombres, voces y frases
// están aprobados por Adrián en la puerta de diseño (segundo punto HITL);
// este bloque los convierte en el perfil de error, la política de arma y
// objetivo, y el banco de frases que exige ia-6. El cuarto rival declarado
// como ampliación deseable (El Oráculo del Cráter) queda fuera a propósito:
// no lo pide ningún criterio.
export const LA_CONTABLE: Personalidad = {
  id: "la-contable",
  nombre: "La Contable",
  descripcion: "Apenas falla: desviación mínima en ángulo y potencia. La más difícil de las tres.",
  // Banda alta (ia-3): desviación mínima en los dos ejes. El rango exacto
  // sale de medir la tasa de victorias contra fuenteAleatoria (300 partidas,
  // varias semillas) -- entre esto y el siguiente escalón hay un salto de
  // ~55% a ~93% de victorias, así que no hay un punto medio "razonable a
  // ojo": hay que medirlo.
  error: { anguloGrados: { minimo: -1.2, maximo: 1.2 }, potencia: { minimo: -2.4, maximo: 2.4 } },
  trayectoriaPreferida: "tenso",
  // El arma más eficiente por punto de daño entre las fiables, evitando la
  // única arma con fiabilidad < 1 (el Petardo de Feria no es "eficiente",
  // es una lotería) y las de daño cero (Vertedero, Gravitón).
  ordenPreferenciaArmas: [
    "despedida",
    "tostadora-orbital",
    "mortero-lamentable",
    "pepinazo-cortesia",
    "pelota-de-chatarra",
    "racimo-de-tuppers",
    "zanjadora-manolita",
    "graviton-segunda-mano",
    "vertedero-portatil",
    "petardo-de-feria",
  ],
  bancoDeFrases: [
    "Registro el impacto como pérdida ordinaria. Su nave, a valor de chatarra, ya estaba provisionada.",
    "Amortizo su casco a diez años. Le quedan cuatro tiros.",
    "Esto no es rencor, es contabilidad de costes.",
    "Provisiono su derrota desde el turno uno.",
    "Su seguro no cubre impericia. El mío tampoco, pero acierto.",
    "Cierro el ejercicio con superávit de cráteres.",
  ],
};

export const ALMIRANTE_BISAGRA: Personalidad = {
  id: "almirante-bisagra",
  nombre: "Almirante Bisagra",
  descripcion: "Se pasa de fuerza casi siempre. Dificultad media: castiga menos que La Contable, pero no regala nada.",
  // Banda media (ia-3): baja en ángulo, alta y sesgada a más potencia en
  // potencia ("se pasa de fuerza" -- el rango es siempre positivo). Medido
  // para caer entre La Contable y Chispa con margen a los dos lados.
  error: { anguloGrados: { minimo: -3, maximo: 3 }, potencia: { minimo: 8, maximo: 20 } },
  trayectoriaPreferida: "mortero",
  // Prefiere el mortero y las armas con retardo (el Racimo de Tuppers se
  // abre a media altura), que le dan tiempo a hablar antes del impacto.
  ordenPreferenciaArmas: [
    "racimo-de-tuppers",
    "mortero-lamentable",
    "despedida",
    "pepinazo-cortesia",
    "tostadora-orbital",
    "pelota-de-chatarra",
    "zanjadora-manolita",
    "graviton-segunda-mano",
    "vertedero-portatil",
    "petardo-de-feria",
  ],
  bancoDeFrases: [
    "Anote, teniente: el enemigo ha sido conminado a rendirse. Anote también que se ha reído.",
    "Esta nave se sostiene con una bisagra y con orgullo. Por ese orden.",
    "En mis memorias, esto se llamará una retirada táctica del enemigo.",
    "Dispare con la solemnidad que la ocasión merece.",
    "No es que apunte alto. Es que aspiro alto.",
    "Consigne en el parte que el impacto fue, en esencia, decorativo.",
  ],
};

export const CHISPA: Personalidad = {
  id: "chispa",
  nombre: "Chispa",
  descripcion: "A veces se entierra a sí misma. La más floja de las tres: ideal para la primera partida.",
  // Banda baja (ia-3): desviación alta en los dos ejes. Un rango tan alto
  // como el de la voz ("a veces se entierra a sí misma") la hacía perder
  // casi siempre (~3-5%, por debajo del suelo de ia-3); esto la deja
  // rondando el 15-25% sin dejar de ser, con diferencia, la más floja.
  error: { anguloGrados: { minimo: -4.5, maximo: 4.5 }, potencia: { minimo: -5.5, maximo: 5.5 } },
  trayectoriaPreferida: "tenso",
  // Las armas raras, las de terreno y el Petardo de Feria antes que nada
  // fiable.
  ordenPreferenciaArmas: [
    "petardo-de-feria",
    "vertedero-portatil",
    "zanjadora-manolita",
    "graviton-segunda-mano",
    "pelota-de-chatarra",
    "racimo-de-tuppers",
    "mortero-lamentable",
    "tostadora-orbital",
    "pepinazo-cortesia",
    "despedida",
  ],
  bancoDeFrases: [
    "¡Perfecto! O sea, no era ahí, pero perfecto igual. Perdona, llave inglesa, no era por ti.",
    "Un tornillo más y esto era ciencia exacta.",
    "Técnicamente el cráter también es mío, así que empate moral.",
    "Le he soldado un tubo más. No preguntes a qué.",
    "Eso tenía que pasar. No sé por qué, pero tenía que pasar.",
    "¡Casi! Casi siempre cuenta en mi taller.",
  ],
};

export const PERSONALIDADES: readonly Personalidad[] = [LA_CONTABLE, ALMIRANTE_BISAGRA, CHISPA];

export function buscarPersonalidad(id: string): Personalidad {
  const personalidad = PERSONALIDADES.find((candidata) => candidata.id === id);
  if (!personalidad) {
    throw new Error(`buscarPersonalidad: no existe ninguna personalidad con id "${id}"`);
  }
  return personalidad;
}
