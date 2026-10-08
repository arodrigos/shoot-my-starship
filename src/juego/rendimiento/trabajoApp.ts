// respuesta-200ms: separa lo que cuesta la APP en un toque de lo que cuesta
// pintar el lienzo. En el CI el lienzo WebGL lo rasteriza la CPU y ocupa
// 250-430 ms por fotograma aunque la partida esté quieta; juzgarlo ahí
// suspendería siempre. Todo es puro para probarlo con datos generados.

export interface Intervalo {
  readonly inicio: number;
  readonly fin: number;
}

export interface ScriptLoaf {
  readonly inicio: number;
  readonly duracion: number;
}

export interface FotogramaLoaf {
  readonly inicio: number;
  readonly fin: number;
  readonly scripts: readonly ScriptLoaf[];
  // Instante en que arranca el tramo de estilo, maquetación, pintado y entrega.
  // 0 si el navegador no lo da.
  readonly inicioEstiloMaquetacion: number;
}

function fusionar(intervalos: readonly Intervalo[]): Intervalo[] {
  const orden = intervalos.filter((i) => i.fin > i.inicio).sort((a, b) => a.inicio - b.inicio);
  const fusion: Intervalo[] = [];
  for (const i of orden) {
    const ultimo = fusion[fusion.length - 1];
    if (ultimo && i.inicio <= ultimo.fin) {
      fusion[fusion.length - 1] = { inicio: ultimo.inicio, fin: Math.max(ultimo.fin, i.fin) };
    } else {
      fusion.push(i);
    }
  }
  return fusion;
}

function recortar(intervalos: readonly Intervalo[], ventana: Intervalo): Intervalo[] {
  return intervalos.map((i) => ({ inicio: Math.max(i.inicio, ventana.inicio), fin: Math.min(i.fin, ventana.fin) })).filter((i) => i.fin > i.inicio);
}

function longitud(intervalos: readonly Intervalo[]): number {
  return intervalos.reduce((suma, i) => suma + (i.fin - i.inicio), 0);
}

function interseccion(a: readonly Intervalo[], b: readonly Intervalo[]): Intervalo[] {
  const salida: Intervalo[] = [];
  for (const x of a) {
    for (const y of b) {
      const inicio = Math.max(x.inicio, y.inicio);
      const fin = Math.min(x.fin, y.fin);
      if (fin > inicio) salida.push({ inicio, fin });
    }
  }
  return salida;
}

export function solapa(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const mitad = orden.length >> 1;
  return orden.length % 2 === 1 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
}

export function tramoEstilo(f: FotogramaLoaf): number {
  return f.inicioEstiloMaquetacion > 0 ? Math.max(0, f.fin - f.inicioEstiloMaquetacion) : 0;
}

// Mediana del tramo de estilo y pintado en los fotogramas que no tocan
// ninguna interacción. 0 si no hay ninguno.
export function calcularBaseMaquetacion(fotogramas: readonly FotogramaLoaf[], ventanas: readonly Intervalo[]): number {
  const reposo = fotogramas.filter((f) => !ventanas.some((v) => solapa(f, v)));
  return mediana(reposo.map(tramoEstilo));
}

// Tiempo de render de Phaser que cae dentro de la ventana.
export function calcularRenderLienzo(ventana: Intervalo, renders: readonly Intervalo[]): number {
  return longitud(fusionar(recortar(renders, ventana)));
}

// JS de la app dentro de la ventana (scripts de LoAF sin el render de Phaser,
// sin contar dos veces ningún intervalo) más, por fotograma de la ventana, el
// estilo y la maquetación que exceden de un fotograma en reposo.
export function calcularTrabajoApp(ventana: Intervalo, fotogramas: readonly FotogramaLoaf[], renders: readonly Intervalo[], baseMaquetacion: number): number {
  const solapados = fotogramas.filter((f) => solapa(f, ventana));
  const scripts = fusionar(recortar(solapados.flatMap((f) => f.scripts.map((s) => ({ inicio: s.inicio, fin: s.inicio + s.duracion }))), ventana));
  const render = fusionar(recortar(renders, ventana));
  const js = longitud(scripts) - longitud(interseccion(scripts, render));
  const exceso = solapados.reduce((suma, f) => suma + Math.max(0, tramoEstilo(f) - baseMaquetacion), 0);
  return Math.min(Math.max(0, js + exceso), Math.max(0, ventana.fin - ventana.inicio));
}
