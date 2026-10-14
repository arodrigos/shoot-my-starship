// El proyecto usa jsdom solo en este test y no trae @types/jsdom: se declara
// lo mínimo que se usa en vez de añadir una dependencia de tipos.
declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, opciones?: { url?: string; pretendToBeVisual?: boolean });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly window: any;
  }
}
