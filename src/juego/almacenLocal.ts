// En modo privado, con el almacenamiento bloqueado o con la cuota agotada,
// localStorage lanza (al accederse o en getItem/setItem/removeItem) y fuera
// del navegador ni siquiera existe `window`. Ninguno de esos casos puede
// tumbar el juego: leer cae al valor por defecto de cada sitio y escribir
// solo hace que el ajuste no persista, un fallo visible y sin consecuencias.
export function leerAlmacen<T>(leer: () => T, porDefecto: T): T {
  try {
    return leer();
  } catch {
    return porDefecto;
  }
}

// Devuelve si la escritura llegó a completarse, para el sitio que necesite
// distinguirlo; el resto puede ignorarlo.
export function escribirAlmacen(escribir: () => void): boolean {
  try {
    escribir();
    return true;
  } catch {
    return false;
  }
}
