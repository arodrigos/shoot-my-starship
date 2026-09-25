import { crearEstadoAleatorio, siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import type { TipoEventoHumor } from "@/sim/partida/eventos";
import { frasesPara } from "@/contenido/bancoReacciones";

// humor-3: selector "bolsa de sorteo" (shuffle-bag) por combinación de
// personalidad y tipo de evento -- cada combinación tiene su propia bolsa,
// que se reparte entera y barajada antes de repetir ninguna frase, así que
// en cualquier ventana de N consecutivas (N = tamaño del banco) no hay dos
// iguales. Reutiliza el PRNG puro de src/sim/aleatorio (mulberry32) en vez
// de Math.random para que el criterio ("con dos semillas distintas") se
// pueda comprobar en Node sin depender del entorno -- no es una exigencia de
// determinismo de partida (la elección de frase no afecta a la simulación,
// a diferencia de la repetición instantánea de humor-6), solo de test.
export interface SelectorFrases {
  elegir(personalidadId: string, tipoEvento: TipoEventoHumor): string;
}

function barajar(banco: readonly string[], aleatorioInicial: EstadoAleatorio): { bolsa: string[]; estado: EstadoAleatorio } {
  const bolsa = [...banco];
  let aleatorio = aleatorioInicial;
  for (let i = bolsa.length - 1; i > 0; i--) {
    const paso = siguienteAleatorio(aleatorio);
    aleatorio = paso.estado;
    const j = Math.floor(paso.valor * (i + 1));
    [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]];
  }
  return { bolsa, estado: aleatorio };
}

export function crearSelectorFrases(semilla: number): SelectorFrases {
  let aleatorio = crearEstadoAleatorio(semilla);
  const bolsas = new Map<string, string[]>();
  const ultimaDispensada = new Map<string, string>();

  return {
    elegir(personalidadId, tipoEvento) {
      const clave = `${personalidadId}:${tipoEvento}`;
      let bolsa = bolsas.get(clave);
      if (!bolsa || bolsa.length === 0) {
        const banco = frasesPara(personalidadId, tipoEvento);
        const resultado = barajar(banco, aleatorio);
        bolsa = resultado.bolsa;
        aleatorio = resultado.estado;

        // Se dispensa por el final (pop): si la primera de la bolsa nueva
        // coincide con la última dispensada de la bolsa anterior, el banco
        // repetiría de inmediato en el cruce entre dos ciclos -- exactamente
        // lo que "no se repite ninguna hasta haber agotado el banco" prohíbe.
        // Con al menos 6 frases por combinación siempre hay otra posición
        // con la que intercambiar.
        const anterior = ultimaDispensada.get(clave);
        const ultimaPosicion = bolsa.length - 1;
        if (anterior !== undefined && bolsa[ultimaPosicion] === anterior && bolsa.length > 1) {
          [bolsa[ultimaPosicion], bolsa[0]] = [bolsa[0], bolsa[ultimaPosicion]];
        }
      }
      const frase = bolsa.pop();
      if (frase === undefined) {
        throw new Error(`crearSelectorFrases: banco vacío para "${clave}"`);
      }
      bolsas.set(clave, bolsa);
      ultimaDispensada.set(clave, frase);
      return frase;
    },
  };
}
