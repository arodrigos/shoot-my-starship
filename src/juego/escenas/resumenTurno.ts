import { buscarArma } from "@/sim/armas/catalogo";
import { esComportamientoAdherente } from "@/sim/fisica/comportamientoExtendido";
import type { EventoSimulacion } from "@/sim/partida/eventos";

// render-espacio (esp-6): el texto del panel "resultado del turno" -- un
// mensaje propio para "proyectil perdido en órbita" (grav-6), porque ese
// turno no tiene ni impacto ni fallo que describir con el resto de casos.
export function resumenTurno(eventos: readonly EventoSimulacion[]): string {
  const base = resumenBase(eventos);
  const objetos = eventos.flatMap((evento) => {
    if (evento.tipo !== "objeto-alcanza") return [];
    return evento.objeto === "corazon" ? [`¡Corazón galáctico! +${evento.cambio} de vida.`] : [`¡Tormenta solar! ${evento.cambio} de vida.`];
  });
  return [...objetos, base].join(" ");
}

function resumenBase(eventos: readonly EventoSimulacion[]): string {
  const escudoActivado = eventos.find((evento) => evento.tipo === "escudo-activado");
  if (escudoActivado) return "Escudo activado: los disparos ajenos no te harán daño durante 2 turnos tuyos.";
  const vuelo = eventos.find((evento): evento is Extract<EventoSimulacion, { tipo: "propulsores" }> => evento.tipo === "propulsores");
  if (vuelo) {
    return vuelo.motivo === "alcance" ? "Propulsores: la nave llega al límite de su alcance y se queda ahí." : "Propulsores: la nave se detiene al toparse con algo.";
  }
  const bloqueo = eventos.find((evento): evento is Extract<EventoSimulacion, { tipo: "escudo-bloquea" }> => evento.tipo === "escudo-bloquea");
  if (bloqueo) return "El escudo ha parado el golpe: sin daño.";
  // Un disparo fallido o perdido no impide que el minirobot detone en el mismo
  // turno: sin su frase el bocadillo diría "ni daño" con 40 de daño en pantalla.
  const detonacionRobot = eventos.find((evento): evento is Extract<EventoSimulacion, { tipo: "robot-detona" }> => evento.tipo === "robot-detona");
  const conRobot = (frase: string): string => (detonacionRobot ? `${frase} ${fraseRobot(detonacionRobot)}` : frase);
  const perdido = eventos.find((evento) => evento.tipo === "proyectil-perdido");
  if (perdido?.tipo === "proyectil-perdido" && perdido.arma !== undefined && esComportamientoAdherente(buscarArma(perdido.arma).comportamiento)) {
    return conRobot("El gancho no se agarra al vacío del borde: se pierde sin efecto. El turno pasa igual.");
  }
  if (perdido?.tipo === "proyectil-perdido" && perdido.arma !== undefined && buscarArma(perdido.arma).comportamiento.tipo === "minirobot") {
    return conRobot("¡Perdido! El minirobot se ha ido por el borde y no explota. El turno pasa igual.");
  }
  if (perdido?.tipo === "proyectil-perdido" && perdido.salida) {
    return conRobot("¡Perdido! Tu disparo ha salido de la pantalla. El turno pasa igual.");
  }
  if (perdido) {
    return conRobot("Tu disparo se ha quedado atrapado en órbita, sin caer nunca. El turno pasa igual.");
  }
  if (eventos.some((evento) => evento.tipo === "arma-falla")) {
    return conRobot("El arma ha fallado: ni huella ni daño este turno.");
  }
  const impacto = eventos.find(
    (evento): evento is Extract<EventoSimulacion, { tipo: "impacto" }> => evento.tipo === "impacto",
  );
  if (!impacto && eventos.some((evento) => evento.tipo === "robot-posado")) {
    return "El minirobot se ha agarrado al planeta: saltará hacia su objetivo al empezar tu próximo turno.";
  }
  if (!impacto && detonacionRobot) {
    return fraseRobot(detonacionRobot);
  }
  // Solo cuenta el empuje de la nave que alcanzó el disparo: el del minirobot
  // sobre su objetivo es otro golpe y ya lo cuenta su propia frase.
  const despedida = eventos.some(
    (evento) =>
      evento.tipo === "desplazamiento" &&
      evento.reserva !== "se-queda" &&
      (impacto?.impactoNave === undefined || evento.nave === impacto.impactoNave),
  )
    ? " La nave alcanzada salió despedida."
    : "";
  if (impacto) {
    const frase = (impacto.danio > 0 ? `Impacto directo: ${impacto.danio} de daño.` : "El disparo ha caído sin hacer daño.") + despedida;
    if (!detonacionRobot) return frase;
    return `${frase} ${fraseRobot(detonacionRobot)}`;
  }
  return "Turno resuelto.";
}

function fraseRobot(detonacion: Extract<EventoSimulacion, { tipo: "robot-detona" }>): string {
  return detonacion.danio > 0 ? `El minirobot ha saltado encima y explota: ${detonacion.danio} de daño.` : "El minirobot explota sin llegar a nadie.";
}
