// La máscara del terreno son hasta ~1 M de bytes con rachas largas (aire y
// planeta). Un JSON de números la haría pesar varios MB y no cabría en
// localStorage; pares (valor, longitud de racha) en varint y base64 la bajan
// a una fracción. Formato: varint(longitud total) y después, por racha,
// 1 byte de valor + varint(longitud). La longitud total va delante para
// reservar el buffer de una vez y para detectar cadenas truncadas.

// Tope de decodificación: una cadena corrupta no puede pedir gigas de memoria.
export const MAX_BYTES_DECODIFICADOS = 16_000_000;

function escribirVarint(salida: number[], valor: number): void {
  let resto = valor;
  while (resto >= 0x80) {
    salida.push((resto % 0x80) | 0x80);
    resto = Math.floor(resto / 0x80);
  }
  salida.push(resto);
}

function aBase64(bytes: readonly number[]): string {
  let binario = "";
  // Por trozos: String.fromCharCode(...bytes) revienta la pila con listas grandes.
  for (let i = 0; i < bytes.length; i += 8192) {
    binario += String.fromCharCode(...bytes.slice(i, i + 8192));
  }
  return btoa(binario);
}

export function codificarRle(datos: Uint8Array): string {
  const bytes: number[] = [];
  escribirVarint(bytes, datos.length);
  let i = 0;
  while (i < datos.length) {
    const valor = datos[i];
    let fin = i + 1;
    while (fin < datos.length && datos[fin] === valor) fin += 1;
    bytes.push(valor);
    escribirVarint(bytes, fin - i);
    i = fin;
  }
  return aBase64(bytes);
}

// Lanza ante una cadena que no es un RLE coherente: quien lee datos externos
// (validar.ts) lo envuelve y lo convierte en un descarte.
export function decodificarRle(cadena: string): Uint8Array {
  const binario = atob(cadena);
  let posicion = 0;
  const leerVarint = (): number => {
    let valor = 0;
    let multiplicador = 1;
    for (let grupo = 0; grupo < 8; grupo += 1) {
      if (posicion >= binario.length) throw new Error("rle: cadena truncada");
      const byte = binario.charCodeAt(posicion);
      posicion += 1;
      valor += (byte & 0x7f) * multiplicador;
      if (byte < 0x80) return valor;
      multiplicador *= 0x80;
    }
    throw new Error("rle: varint demasiado largo");
  };

  const total = leerVarint();
  if (total > MAX_BYTES_DECODIFICADOS) throw new Error("rle: longitud declarada excesiva");
  const salida = new Uint8Array(total);
  let escritos = 0;
  while (posicion < binario.length) {
    const valor = binario.charCodeAt(posicion);
    posicion += 1;
    const racha = leerVarint();
    if (racha === 0 || escritos + racha > total) throw new Error("rle: racha fuera de la longitud declarada");
    salida.fill(valor, escritos, escritos + racha);
    escritos += racha;
  }
  if (escritos !== total) throw new Error("rle: faltan bytes");
  return salida;
}
