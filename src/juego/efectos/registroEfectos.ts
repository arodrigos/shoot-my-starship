// presupuesto-render (pre-1): registro único de efectos visuales. Cada
// efecto declara aquí su techo de partículas, su techo de objetos vivos y
// si reutiliza un pool en vez de crear y destruir GameObjects por evento --
// ANTES de que exista un solo píxel nuevo. Con los ocho paquetes electivos
// de este refinamiento por delante (explosiones por capas, escombros,
// cráteres, estelas, paralaje...), sin este cimiento "no perder
// rendimiento" sería una promesa, no algo que CI pueda comprobar.
export interface EfectoVisual {
  readonly id: string;
  readonly descripcion: string;
  readonly techoParticulas: number;
  readonly techoObjetosVivos: number;
  readonly reutilizaPool: boolean;
}

// Los tres emisores que ya existían antes de este bloque (imp-12, proy-4):
// se dan de alta aquí con los mismos topes que ya tenían en el código, no se
// inventa ninguno nuevo. crearEmisorRegistrado.ts es el único punto por el
// que se les permite nacer.
export const REGISTRO_EFECTOS = {
  "explosion-con-danio": {
    id: "explosion-con-danio",
    descripcion: "Impacto que hace daño: fogonazo naranja, un `explode()` por impacto.",
    techoParticulas: 24,
    techoObjetosVivos: 24,
    reutilizaPool: false,
  },
  "explosion-sin-danio": {
    id: "explosion-sin-danio",
    descripcion: "Impacto sin daño (imp-12): fogonazo gris apagado, más pequeño que el de daño.",
    techoParticulas: 8,
    techoObjetosVivos: 8,
    reutilizaPool: false,
  },
  "estela-proyectil": {
    id: "estela-proyectil",
    descripcion: "Estela del proyectil en vuelo (proy-4): pool de tamaño fijo, nunca crece con la duración del vuelo.",
    techoParticulas: 40,
    techoObjetosVivos: 40,
    reutilizaPool: true,
  },
  "roce-chispazo": {
    id: "roce-chispazo",
    descripcion:
      "contacto-honesto (con-3): el roce no detona (no hay huella ni cráter) -- una chispa breve y mínima, distinta de las dos explosiones, para que no se lea como un impacto que no ha ocurrido.",
    techoParticulas: 4,
    techoObjetosVivos: 4,
    reutilizaPool: false,
  },
  // explosiones-por-capas (exl-1..exl-5): destello y onda son `graphics`
  // (Arc), no emisores de partículas -- su techoParticulas es 0 a propósito,
  // pero se dan de alta igual que las demás porque pre-1 exige que TODO
  // efecto visual declare su techo antes de existir, no solo los que crean
  // un emisor de partículas.
  "destello-explosion": {
    id: "destello-explosion",
    descripcion: "Capa 1 de la explosión por capas: disco breve que se abre y se apaga casi al instante.",
    techoParticulas: 0,
    techoObjetosVivos: 1,
    reutilizaPool: false,
  },
  "onda-de-choque": {
    id: "onda-de-choque",
    descripcion: "Capa 2: anillo que crece y se desvanece, más lento y más amplio que el destello.",
    techoParticulas: 0,
    techoObjetosVivos: 1,
    reutilizaPool: false,
  },
  "escombros-impacto": {
    id: "escombros-impacto",
    descripcion: "Capa 3: escombros con rebote (gravityY + bounce) y desvanecimiento, un `.explode()` por impacto.",
    techoParticulas: 16,
    techoObjetosVivos: 16,
    reutilizaPool: false,
  },
  "humo-residual": {
    id: "humo-residual",
    descripcion: "Capa 4: humo que flota y se desvanece después de que escombros y onda ya han terminado.",
    techoParticulas: 10,
    techoObjetosVivos: 10,
    reutilizaPool: false,
  },
  "marca-terreno": {
    id: "marca-terreno",
    descripcion:
      "Capa 5: huella persistente del impacto sobre el terreno. No es un emisor de partículas -- es un pool de graphics de tamaño fijo (la más antigua se recicla al llegar al techo), por eso reutilizaPool=true con techoParticulas=0.",
    techoParticulas: 0,
    techoObjetosVivos: 8,
    reutilizaPool: true,
  },
} as const satisfies Record<string, EfectoVisual>;

export type IdEfectoVisual = keyof typeof REGISTRO_EFECTOS;

export function efectosRegistrados(): readonly EfectoVisual[] {
  return Object.values(REGISTRO_EFECTOS);
}

export function techoTotalParticulas(): number {
  return efectosRegistrados().reduce((total, efecto) => total + efecto.techoParticulas, 0);
}
