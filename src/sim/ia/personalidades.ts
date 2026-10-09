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
  // Banda alta (ia-punteria-3, recalibrado otra vez en armas-reprecio-roles):
  // el reprecio subió el daño medio del catálogo (varias armas pasan de
  // 20-30 a 30-45 de daño máximo), lo que por sí solo disparó la victoria a
  // 93.0% -- más turnos letales dejan menos margen para que el jugador
  // patrón remonte. El rango de error vuelve a crecer (x1.34 en los dos
  // ejes sobre el valor de ia-punteria) hasta devolverla a banda. Medido
  // con npm run medir:ia (docs/jugador-patron.md, 200 partidas, semilla
  // maestra 2024): 84.5% de victorias, dentro de la banda 75-90%.
  error: { anguloGrados: { minimo: -4.5, maximo: 4.5 }, potencia: { minimo: -9, maximo: 9 } },
  trayectoriaPreferida: "tenso",
  // El arma más eficiente por punto de daño entre las fiables, evitando la
  // única arma con fiabilidad < 1 (el Petardo de Feria no es "eficiente",
  // es una lotería) y las de daño cero (Vertedero, Gravitón).
  ordenPreferenciaArmas: [
    "despedida",
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
  // Banda media (ia-punteria-3, recalibrado otra vez en armas-reprecio-roles):
  // con el daño medio del catálogo subido por el reprecio, el rango que
  // calibró ia-punteria se disparaba a 93.0% de victorias, muy por encima
  // de la banda 45-65% -- el rango crece otra vez (x3.3 en ángulo, x1.8 en
  // potencia sobre ia-punteria) para devolverla a banda. Medido con
  // npm run medir:ia: 50.5% de victorias, dentro de la banda 45-65%.
  // salida-pantalla: recalibrada contra el jugador patrón con tiro trazado (ver
  // ia-3): con la puntería nueva del patrón sube a ~47 % de media.
  error: { anguloGrados: { minimo: -20, maximo: 20 }, potencia: { minimo: 35, maximo: 65 } },
  trayectoriaPreferida: "mortero",
  // Prefiere el mortero y las armas con retardo (el Racimo de Tuppers se
  // abre a media altura), que le dan tiempo a hablar antes del impacto.
  ordenPreferenciaArmas: [
    "racimo-de-tuppers",
    "mortero-lamentable",
    "despedida",
    "pepinazo-cortesia",
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
  // Banda baja (ia-punteria-3, recalibrado otra vez en armas-reprecio-roles):
  // el reprecio le subió el daño a varias de sus armas preferidas (p.ej.
  // zanjadora-manolita pasa de utilitaria pura a algo de alcance real,
  // petardo-de-feria sube de 8 a 13 de daño), y la victoria subía a 61.0%,
  // muy por encima de la banda 20-40%. El rango crece otra vez (x1.8 en los
  // dos ejes sobre ia-punteria) para devolverla a banda. Medido con
  // npm run medir:ia: 25.0% de victorias, dentro de la banda 20-40%.
  // salida-pantalla: ±2° la dejaba en 50-80 % contra el patrón nuevo; con este
  // rango baja a ~31 % de media (17-54 % según el mapa).
  error: { anguloGrados: { minimo: -10, maximo: 10 }, potencia: { minimo: -14, maximo: 14 } },
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
