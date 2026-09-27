// Se importa (nunca vía --import global: nucleo-3 exige window/document
// undefined en TODO el resto de la suite) como PRIMERA línea de cada test
// que necesite de verdad tocar una clase de src/juego -- Phaser detecta su
// "dispositivo" (Device.OS/Browser/Features) de forma incondicional en el
// momento de importarse -- toca window/document/canvas sin comprobar antes
// si existen, así que CUALQUIER test que importe (aunque sea de forma
// transitiva) una clase de src/juego revienta con "window is not defined"
// en Node puro, sin distinguir si esa clase usa de verdad el DOM o no.
//
// La alternativa sería no testear en absoluto la lógica de esas clases
// (perdiendo proy-2/esp-1, que comprueban matemática real de vuelo, no
// render) o forzarlas todas a e2e con navegador real (pagar Playwright por
// cada fórmula). En vez de eso, se les da a Phaser el DOM mínimo que jsdom
// puede ofrecer -- sigue siendo un DOM real (no un mock a medida de estas
// pruebas), solo que sin GPU, que es exactamente lo que la "escena de
// mentira" de estos tests ya asumía que bastaba.
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost/" });

for (const propiedad of Object.getOwnPropertyNames(dom.window)) {
  if (propiedad in globalThis) continue; // no pisar navigator/otros globals nativos de Node
  try {
    globalThis[propiedad] = dom.window[propiedad];
  } catch {
    // getters de solo lectura ya presentes en globalThis: se ignoran
  }
}
if (!("window" in globalThis)) globalThis.window = dom.window;
