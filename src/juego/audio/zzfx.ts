// Sintetizador de efectos basado en ZzFX 1.4.0 (buildSamples / zzfxG).
// ZzFX © Frank Force (KilledByAPixel), licencia MIT:
// https://github.com/KilledByAPixel/ZzFX
//
// Copia tipada y sin efectos al importar: no crea ningún AudioContext y el
// azar (la "randomness" del tono) entra por parámetro, para que el mismo
// array dé siempre las mismas muestras y no haya Math.random en el código.
export type ParametrosZzfx = readonly number[];

export const FRECUENCIA_MUESTREO_ZZFX = 44100;
const VOLUMEN_ZZFX = 0.3;
const PI2 = Math.PI * 2;

const signo = (v: number): number => (v < 0 ? -1 : 1);

export function construirMuestras(parametros: ParametrosZzfx, aleatorio: () => number, frecuenciaMuestreo: number = FRECUENCIA_MUESTREO_ZZFX): Float32Array<ArrayBuffer> {
  const p = (indice: number, porDefecto: number): number => {
    const valor = parametros[indice];
    return typeof valor === "number" && Number.isFinite(valor) ? valor : porDefecto;
  };
  const sr = frecuenciaMuestreo;
  let volumen = p(0, 1);
  const aleatoriedad = p(1, 0.05);
  let frecuencia = p(2, 220);
  let ataque = p(3, 0);
  let sostenido = p(4, 0);
  let liberacion = p(5, 0.1);
  const forma = p(6, 0);
  const curvaForma = p(7, 1);
  let deslizamiento = p(8, 0);
  let deltaDeslizamiento = p(9, 0);
  let saltoTono = p(10, 0);
  let tiempoSalto = p(11, 0);
  let tiempoRepeticion = p(12, 0);
  const ruido = p(13, 0);
  let modulacion = p(14, 0);
  const bitCrush = p(15, 0);
  let retardo = p(16, 0);
  const volumenSostenido = p(17, 1);
  let caida = p(18, 0);
  const tremolo = p(19, 0);
  const filtro = p(20, 0);

  const abs = Math.abs;
  const inicioDeslizamiento = (deslizamiento *= (500 * PI2) / sr ** 2);
  let frecuenciaInicial = (frecuencia *= ((1 + aleatoriedad * (aleatorio() * 2 - 1)) * PI2) / sr);
  const salida: number[] = [];
  let t = 0;
  let tm = 0;
  let i = 0;
  let j = 1;
  let r = 0;
  let c = 0;
  let s = 0;

  // Filtro biquad paso-bajo/alto (mismo cálculo que ZzFX).
  const calidad = 2;
  const w = (PI2 * abs(filtro) * 2) / sr;
  const cos = Math.cos(w);
  const alfa = Math.sin(w) / 2 / calidad;
  const a0 = 1 + alfa;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alfa) / a0;
  const b0 = (1 + signo(filtro) * cos) / 2 / a0;
  const b1 = -(signo(filtro) + cos) / a0;
  const b2 = b0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  ataque = ataque * sr + 9;
  caida *= sr;
  sostenido *= sr;
  liberacion *= sr;
  retardo *= sr;
  deltaDeslizamiento *= (500 * PI2) / sr ** 3;
  modulacion *= PI2 / sr;
  saltoTono *= PI2 / sr;
  tiempoSalto *= sr;
  tiempoRepeticion = (tiempoRepeticion * sr) | 0;
  volumen *= VOLUMEN_ZZFX;

  const longitud = (ataque + caida + sostenido + liberacion + retardo) | 0;
  const cruceBits = (bitCrush * 100) | 0;
  for (; i < longitud; salida[i++] = s * volumen) {
    if (cruceBits === 0 || !(++c % cruceBits)) {
      s = forma
        ? forma > 1
          ? forma > 2
            ? forma > 3
              ? forma > 4
                ? Number((t / PI2) % 1 < curvaForma / 2) * 2 - 1
                : Math.sin(t ** 3)
              : Math.max(Math.min(Math.tan(t), 1), -1)
            : 1 - ((((2 * t) / PI2) % 2) + 2) % 2
          : 1 - 4 * abs(Math.round(t / PI2) - t / PI2)
        : Math.sin(t);
      s =
        (tiempoRepeticion ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / tiempoRepeticion) : 1) *
        (forma > 4 ? s : signo(s) * abs(s) ** curvaForma) *
        (i < ataque
          ? i / ataque
          : i < ataque + caida
            ? 1 - ((i - ataque) / caida) * (1 - volumenSostenido)
            : i < ataque + caida + sostenido
              ? volumenSostenido
              : i < longitud - retardo
                ? ((longitud - i - retardo) / liberacion) * volumenSostenido
                : 0);
      s = retardo ? s / 2 + (retardo > i ? 0 : ((i < longitud - retardo ? 1 : (longitud - i) / retardo) * (salida[(i - retardo) | 0] ?? 0)) / 2 / volumen) : s;
      if (filtro) {
        const y = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = s) - a2 * y2 - a1 * (y2 = y1);
        s = y1 = y;
      }
    }
    const f = (frecuencia += deslizamiento += deltaDeslizamiento) * Math.cos(modulacion * tm++);
    t += f - f * ruido * (1 - (((Math.sin(i) + 1) * 1e9) % 2));
    if (j && ++j > tiempoSalto) {
      frecuencia += saltoTono;
      frecuenciaInicial += saltoTono;
      j = 0;
    }
    if (tiempoRepeticion && !(++r % tiempoRepeticion)) {
      frecuencia = frecuenciaInicial;
      deslizamiento = inicioDeslizamiento;
      j = j || 1;
    }
  }

  // Una muestra fuera de [-1, 1] o no finita saturaría o rompería el
  // AudioBuffer: se acota aquí, en la frontera, en vez de fiarse de los datos.
  const muestras = new Float32Array(salida.length);
  for (let k = 0; k < salida.length; k++) {
    const v = salida[k];
    muestras[k] = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
  }
  return muestras;
}
