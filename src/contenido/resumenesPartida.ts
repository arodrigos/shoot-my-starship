// voz-resumenes: plantillas del locutor de partida. Solo hablan de los
// personajes del juego (repo público). Cada situación tiene al menos seis, para
// que "no repetir en 5 resúmenes seguidos" siempre tenga alguna disponible.
//
// Huecos: {lider} nombre de quien más integridad tiene, {vida} su integridad,
// {ventaja} puntos que saca al segundo, {otro} nombre de la nave que protagoniza
// la situación (racha, crédito) y {n} el número asociado (fallos seguidos).
export type SituacionResumen = "empate" | "lider-claro" | "reñido" | "racha-fallos" | "muerte-subita" | "sin-credito";

export const PLANTILLAS_RESUMEN: Readonly<Record<SituacionResumen, readonly string[]>> = {
  empate: [
    "Empate en cabeza con {vida} de vida: aquí nadie se atreve a ganar.",
    "Empate técnico a {vida}. Si esto fuera un tango, sería el más aburrido.",
    "Van empatados a {vida} de vida. El empate manda, el público bosteza.",
    "Empate a {vida}: los dos fallan con idéntica elegancia.",
    "Marcador de empate, {vida} cada uno. Alguien tendrá que disparar de verdad.",
    "Empate a {vida} de integridad. La física, neutral como Suiza.",
  ],
  "lider-claro": [
    "{lider} manda con {vida} de vida y {ventaja} de ventaja. Los demás, a rezar.",
    "Va ganando {lider}, con {ventaja} puntos de ventaja. Los demás disparan, pero al aire.",
    "{lider} lidera con {vida} de vida. Que alguien le avise de que no hace falta presumir.",
    "Ventaja de {ventaja} para {lider}. Esto ya huele a victoria con lacito.",
    "{lider} domina la partida con {vida} de vida. El resto, de espectadores.",
    "Por ahora gana {lider} por {ventaja} puntos. Los demás aún pueden fingir sorpresa.",
  ],
  reñido: [
    "Partida reñidísima: {lider} va por delante, pero solo por {ventaja} puntos.",
    "{lider} lidera con {vida} de vida, pero la ventaja es de {ventaja}. Un estornudo y se acabó.",
    "Qué tensión: gana {lider} por apenas {ventaja} puntos.",
    "{lider} manda por la mínima, {ventaja} de ventaja. Cualquiera puede darle la vuelta.",
    "Todo abierto: {lider} se adelanta con {vida} de vida y {ventaja} de margen.",
    "Pelea pareja: {lider} gana, pero con {ventaja} de ventaja no se compra ni un café.",
  ],
  "racha-fallos": [
    "{otro} lleva {n} fallos seguidos. Gana {lider}, que apenas tiene que esforzarse.",
    "Racha de {n} fallos para {otro}. Mientras, {lider} manda con {vida} de vida.",
    "{otro} encadena {n} fallos: el planeta ya se siente halagado. Va ganando {lider}.",
    "A {otro} le salen {n} fallos seguidos. {lider} sonríe con {vida} de vida.",
    "{n} tiros perdidos de {otro}. {lider} lidera y no piensa avisarle.",
    "{otro} no acierta ni por error: {n} fallos. {lider} va primero con {vida}.",
  ],
  "muerte-subita": [
    "La muerte súbita está a la vuelta de la esquina. Va ganando {lider} con {vida} de vida.",
    "Se acerca la muerte súbita y {lider} manda con {vida}. Que nadie se duerma.",
    "Pronto todos perderán vida solos. {lider} llega primero, con {vida}.",
    "Queda poco para la muerte súbita: {lider} lidera con {ventaja} de ventaja.",
    "La muerte súbita asoma y {lider} sigue arriba con {vida} de vida.",
    "Ojo, que la muerte súbita viene a cobrar. Gana {lider}, por ahora.",
  ],
  "sin-credito": [
    "{otro} se ha quedado sin crédito: a tirar con lo que tenga. Gana {lider}.",
    "Sin un céntimo para {otro}. Mientras, {lider} manda con {vida} de vida.",
    "{otro} agotó el presupuesto y ahora solo puede soñar. Lidera {lider}.",
    "Crédito a cero para {otro}. {lider} va primero con {vida} y su saldo aguanta.",
    "{otro} está en números rojos, y {lider} en cabeza con {vida}.",
    "La cartera de {otro} está vacía. {lider} gana por {ventaja} puntos.",
  ],
};
