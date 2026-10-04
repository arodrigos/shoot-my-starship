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
  // Banda alta (ia-punteria-3, recalibrado): el buscador con refinamiento de
  // potencia es más preciso que el que calibró ia-3 originalmente (98.0% de
  // victorias contra el jugador patrón, muy por encima de la banda 75-90%
  // que pide este bloque), así que el rango de error crece x2.8 en los dos
  // ejes -- medido con npm run medir:ia (docs/jugador-patron.md, 200
  // partidas, semilla maestra 2024): 89.5% de victorias, dentro de banda.
  error: { anguloGrados: { minimo: -3.36, maximo: 3.36 }, potencia: { minimo: -6.72, maximo: 6.72 } },
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
  // Banda media (ia-punteria-3, recalibrado): con el buscador mejorado
  // ganaba el 90.0% de las partidas, muy por encima de la banda 45-65% que
  // pide este bloque -- el rango de error crece x2.2 en ángulo y x1.4 en
  // potencia (menos en potencia porque "se pasa de fuerza" sigue siendo su
  // sesgo declarado, no una imprecisión nueva). Medido con npm run medir:ia:
  // 57.0% de victorias, dentro de banda.
  error: { anguloGrados: { minimo: -6.6, maximo: 6.6 }, potencia: { minimo: 11.2, maximo: 28 } },
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
  // Banda baja (ia-punteria-3, recalibrado): con el buscador mejorado el
  // rango original la dejaba en 8.5% de victorias, por debajo de la banda
  // 20-40% que pide este bloque. Lo que de verdad la hace perder no es el
  // error de apuntado (sus armas preferidas son las de menos daño del
  // catálogo), así que el rango se RECORTA x0.15/x0.18 en vez de crecer --
  // es la personalidad que menos corrección necesitaba sobre su puntería
  // bruta, solo había que dejar que esa puntería contara. Medido con npm
  // run medir:ia: 31.3% de victorias (150 partidas), dentro de banda.
  // potencia-dispersion (recalibrado otra vez): universal -- se suma
  // encima del error propio de CUALQUIER personalidad, en todo disparo del
  // jugador y de la IA -- y Chispa es la que menos margen propio tiene
  // para absorberla (su error ya era el más pequeño del catálogo, y sus
  // armas preferidas son las de radio de efecto más pequeño, las que menos
  // toleran un error de ángulo). Medido: con el rango de arriba sin tocar,
  // la victoria caía a 17.0%, por debajo de su banda 20-40%. Recortado un
  // 25% más para devolverle el margen que la dispersión universal le quita.
  error: { anguloGrados: { minimo: -0.5, maximo: 0.5 }, potencia: { minimo: -0.75, maximo: 0.75 } },
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
