// humor-sistemico: el parte de guerra final. EstadisticasPartida se acumula
// en la cáscara (Partida.ts) turno a turno a partir de los mismos eventos
// que ya emite avanzar() -- este módulo no conoce Phaser ni el navegador,
// solo recibe el resumen y decide la medalla, para poder probarlo en Node
// sin un navegador (humor-7).
export interface EstadisticasPartida {
  readonly disparos: number;
  readonly fallos: number;
  readonly autoimpactos: number;
  readonly danioHechoAlEnemigo: number;
  readonly pixelesDestruidos: number;
}

export function estadisticasIniciales(): EstadisticasPartida {
  return { disparos: 0, fallos: 0, autoimpactos: 0, danioHechoAlEnemigo: 0, pixelesDestruidos: 0 };
}

export interface ParteDeGuerra {
  readonly medalla: string;
  readonly texto: string;
}

// Cuatro ramas con precedencia fija, de la más específica (y más graciosa) a
// la más genérica -- una partida puede cumplir varias a la vez (p.ej. ganar
// sin fallar Y habiéndose autoimpactado una vez con un arma de
// daño-y-autodaño), así que el orden decide cuál se cuenta, no una lista sin
// prioridad. Los tres primeros ejemplos son los del diseño; el cuarto existe
// para que ninguna partida se quede sin parte, y sigue derivando el texto de
// números reales en vez de ser un remate fijo disfrazado.
export function generarParteDeGuerra(estadisticas: EstadisticasPartida): ParteDeGuerra {
  if (estadisticas.autoimpactos > 0) {
    return {
      medalla: "Cruz del Fuego Amigo",
      texto: `Concedida por ganar la partida tras impactarse a sí mismo ${estadisticas.autoimpactos} ${estadisticas.autoimpactos === 1 ? "vez" : "veces"}.`,
    };
  }
  if (estadisticas.disparos > 0 && estadisticas.fallos === 0) {
    return {
      medalla: "Mención de Puntería Sospechosa",
      texto: `Concedida por acertar los ${estadisticas.disparos} disparos de la partida sin fallar ni uno.`,
    };
  }
  if (estadisticas.pixelesDestruidos > estadisticas.danioHechoAlEnemigo) {
    return {
      medalla: "Mérito Geológico",
      texto: `Concedida por destruir ${estadisticas.pixelesDestruidos} píxeles de mundo, más que los ${estadisticas.danioHechoAlEnemigo} puntos de daño hechos al enemigo.`,
    };
  }
  return {
    medalla: "Medalla al Mérito de Combate",
    texto: `Concedida por ganar tras ${estadisticas.disparos} disparos y ${estadisticas.danioHechoAlEnemigo} puntos de daño hechos al enemigo.`,
  };
}
