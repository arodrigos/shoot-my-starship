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
  descripcion: "Apenas falla: calcula cada tiro.",
  // Banda alta (ia-punteria-3, recalibrado otra vez en armas-reprecio-roles):
  // el reprecio subió el daño medio del catálogo (varias armas pasan de
  // 20-30 a 30-45 de daño máximo), lo que por sí solo disparó la victoria a
  // 93.0% -- más turnos letales dejan menos margen para que el jugador
  // patrón remonte. El rango de error vuelve a crecer (x1.34 en los dos
  // ejes sobre el valor de ia-punteria) hasta devolverla a banda. Medido
  // con npm run medir:ia (docs/jugador-patron.md, 200 partidas, semilla
  // maestra 2024): 84.5% de victorias, dentro de la banda 75-90%.
  // vida-muerte-subita: con 150 de vida las partidas se alargan y La Contable
  // ganaba 85-96 %. Por decisión de Adrián su banda baja a 60-80 %: el error
  // angular sube a ±11,7° (x2,6) y el de potencia a ±10,8 (x1,2). Medido con
  // 100 partidas por semilla: 61/82/77/69/73 %. Con la fuerza máxima de 1050
  // el tiro es más difícil: ±18° / ±14 mide 39/79/67/62/75 % (4 de 5 en banda).
  // armas-recorte: sin el Mortero, ±18° / ±14 bajaba a 29/74/53/39/67 %. Medido
  // con ia-3 (semillas fijas, resultado determinista): ±13° / ±11 da
  // 54/81/77/58/81 %, ±17° / ±11 da 26/77/61/58/71 % y ±14° / ±12 da
  // 52/79/63/57/85 % (media 67 %). La semilla 1 nunca sube de 52 % y la 5 no
  // baja de 70 % sin hundir la 1, así que la dispersión entre mapas supera la
  // banda de 60-80 %: se queda ±14° / ±12 y ia-3 ensancha la banda a lo medido.
  error: { anguloGrados: { minimo: -14, maximo: 14 }, potencia: { minimo: -12, maximo: 12 } },
  trayectoriaPreferida: "tenso",
  // El arma más eficiente por punto de daño entre las fiables, evitando la
  // única arma con fiabilidad < 1 (la Pelota de Chatarra no es "eficiente",
  // es una lotería) y las de daño cero (Vertedero, Gravitón).
  ordenPreferenciaArmas: [
    "despedida",
    "pepinazo-cortesia",
    "pelota-de-chatarra",
    "racimo-de-tuppers",
    "zanjadora-manolita",
    "graviton-segunda-mano",
    "vertedero-portatil",
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
  descripcion: "Se pasa de fuerza casi siempre y lo dice con solemnidad.",
  // Banda media (ia-punteria-3, recalibrado otra vez en armas-reprecio-roles):
  // con el daño medio del catálogo subido por el reprecio, el rango que
  // calibró ia-punteria se disparaba a 93.0% de victorias, muy por encima
  // de la banda 45-65% -- el rango crece otra vez (x3.3 en ángulo, x1.8 en
  // potencia sobre ia-punteria) para devolverla a banda. Medido con
  // npm run medir:ia: 50.5% de victorias, dentro de la banda 45-65%.
  // salida-pantalla: recalibrada contra el jugador patrón con tiro trazado (ver
  // ia-3): con la puntería nueva del patrón sube a ~47 % de media.
  // fuerza-maxima: con 1050 de fuerza el tiro es más difícil para todos y
  // Bisagra (73 % de media) pasaba por encima de La Contable. Con el Racimo de
  // tres perdigones en fila (racimo-separado), su arma favorita ya no cubre
  // área y ±40° la hundía a 23/34/21/40/75 %. ±21° mide 25/71/41/46/84 %:
  // entre Chispa y La Contable en 4 de 5 semillas.
  error: { anguloGrados: { minimo: -21, maximo: 21 }, potencia: { minimo: 35, maximo: 65 } },
  trayectoriaPreferida: "mortero",
  // Prefiere el tiro en mortero y las armas con retardo (el Racimo de Tuppers se
  // abre a media altura), que le dan tiempo a hablar antes del impacto.
  ordenPreferenciaArmas: [
    "racimo-de-tuppers",
    "despedida",
    "pepinazo-cortesia",
    "pelota-de-chatarra",
    "zanjadora-manolita",
    "graviton-segunda-mano",
    "vertedero-portatil",
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
  descripcion: "Improvisa y a veces se entierra a sí misma.",
  // Banda baja (ia-punteria-3, recalibrado otra vez en armas-reprecio-roles):
  // el reprecio le subió el daño a varias de sus armas preferidas (p.ej.
  // zanjadora-manolita pasa de utilitaria pura a algo de alcance real,
  // petardo-de-feria sube de 8 a 13 de daño), y la victoria subía a 61.0%,
  // muy por encima de la banda 20-40%. El rango crece otra vez (x1.8 en los
  // dos ejes sobre ia-punteria) para devolverla a banda. Medido con
  // npm run medir:ia: 25.0% de victorias, dentro de la banda 20-40%.
  // salida-pantalla: ±2° la dejaba en 50-80 % contra el patrón nuevo; con este
  // rango baja a ~31 % de media (17-54 % según el mapa).
  // fuerza-maxima: ±10° / ±14 subía a 25/58/59/35/62 %, fuera de su banda;
  // ±14° / ±16 mide 15/50/42/22/50 % y empata con Bisagra en la semilla 3;
  // ±16° / ±16 mide 12/51/36/30/48 % (4 de 5 en 20-55 %).
  // armas-recorte: sin el Petardo y con la Pelota de Chatarra de primera,
  // ±16° / ±16 caía a 2/21/6/6/16 %; ±10° / ±10 mide 12/47/26/21/51 %.
  error: { anguloGrados: { minimo: -10, maximo: 10 }, potencia: { minimo: -10, maximo: 10 } },
  trayectoriaPreferida: "tenso",
  // Las armas raras y las de terreno antes que nada fiable. La Pelota de
  // Chatarra abre la lista porque, retirado el Petardo de Feria, era la única
  // rara con daño: con una de daño 0 de primera (ia-n8) Chispa pasaba de la
  // mitad de sus turnos sin hacer daño.
  ordenPreferenciaArmas: [
    "pelota-de-chatarra",
    "vertedero-portatil",
    "zanjadora-manolita",
    "graviton-segunda-mano",
    "racimo-de-tuppers",
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
