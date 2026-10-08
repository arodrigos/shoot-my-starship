import { manejarPeticion } from "@/juego/motor/manejador";
import { esPeticion } from "@/juego/motor/protocolo";

// No hay lib "webworker" en el tsconfig (el resto del proyecto es DOM): se
// tipa solo lo que se usa del ámbito global del trabajador.
const ambito = self as unknown as {
  onmessage: ((evento: MessageEvent<unknown>) => void) | null;
  postMessage(mensaje: unknown): void;
};

ambito.onmessage = (evento) => {
  const peticion = evento.data;
  if (!esPeticion(peticion)) return;
  ambito.postMessage(manejarPeticion(peticion));
};
