import { crearEstadoAleatorio, siguienteAleatorio, type EstadoAleatorio } from "@/sim/aleatorio";
import type { CategoriaBroma } from "@/sim/partida/categoriaBroma";
import { bancoDisparoDe, bancoImpactoDe, type IdVoz } from "@/contenido/bancoBromas";

// hum-2: mismo algoritmo de "bolsa de sorteo" que selectorFrases.ts
// (humor-sistemico) -- se reparte el banco entero barajado antes de repetir
// ninguna frase, así que en cualquier ventana de hasta N consecutivas
// (N = tamaño del banco de esa combinación) no hay dos iguales, y agotar la
// bolsa la rebaraja en vez de devolver un hueco vacío. No se reutiliza
// crearSelectorFrases porque esa está indexada por TipoEventoHumor (7
// valores fijos de humor-sistemico) y esta lo está por CategoriaBroma (las
// siete nuevas) además de por el banco de disparo, que no tiene categoría.
export interface SelectorBromas {
  elegirDisparo(voz: IdVoz): string;
  elegirImpacto(voz: IdVoz, categoria: CategoriaBroma): string;
  // arma-mosca (mos-5): misma bolsa de sorteo, indexada por arma en vez de
  // por voz -- el llamante (Partida.ts) solo la invoca cuando el arma
  // disparada declara `bromaPropia`, así que aquí no hace falta ninguna
  // condición sobre qué arma es.
  elegirDisparoArma(armaId: string, banco: readonly string[]): string;
  elegirImpactoArma(armaId: string, banco: readonly string[]): string;
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

export function crearSelectorBromas(semilla: number): SelectorBromas {
  let aleatorio = crearEstadoAleatorio(semilla);
  const bolsas = new Map<string, string[]>();
  const ultimaDispensada = new Map<string, string>();

  function elegir(clave: string, banco: readonly string[]): string {
    if (banco.length === 0) {
      throw new Error(`crearSelectorBromas: banco vacío para "${clave}"`);
    }
    let bolsa = bolsas.get(clave);
    if (!bolsa || bolsa.length === 0) {
      const resultado = barajar(banco, aleatorio);
      bolsa = resultado.bolsa;
      aleatorio = resultado.estado;

      // Igual que selectorFrases.ts: evita que la primera frase de la bolsa
      // nueva coincida con la última dispensada de la anterior, que sería
      // una repetición inmediata en el cruce entre dos ciclos.
      const anterior = ultimaDispensada.get(clave);
      const ultimaPosicion = bolsa.length - 1;
      if (anterior !== undefined && bolsa[ultimaPosicion] === anterior && bolsa.length > 1) {
        [bolsa[ultimaPosicion], bolsa[0]] = [bolsa[0], bolsa[ultimaPosicion]];
      }
    }
    const frase = bolsa.pop();
    if (frase === undefined) {
      throw new Error(`crearSelectorBromas: banco vacío para "${clave}"`);
    }
    bolsas.set(clave, bolsa);
    ultimaDispensada.set(clave, frase);
    return frase;
  }

  return {
    elegirDisparo(voz) {
      return elegir(`disparo:${voz}`, bancoDisparoDe(voz));
    },
    elegirImpacto(voz, categoria) {
      return elegir(`impacto:${voz}:${categoria}`, bancoImpactoDe(voz, categoria));
    },
    elegirDisparoArma(armaId, banco) {
      return elegir(`disparo-arma:${armaId}`, banco);
    },
    elegirImpactoArma(armaId, banco) {
      return elegir(`impacto-arma:${armaId}`, banco);
    },
  };
}
