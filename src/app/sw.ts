import { Serwist, type PrecacheEntry } from "serwist";
import { entradaPrecacheable, respuestaPrecacheable } from "@/juego/pwa/filtroPrecache";

declare const self: { __SW_MANIFEST: (PrecacheEntry | string)[]; location: { origin: string } };

// skipWaiting a false a propósito (la guía oficial lo trae a true): una
// versión nueva solo se activa cuando el usuario pulsa Recargar. clientsClaim
// solo actúa al activarse, así que en la primera instalación toma la página
// sin recargarla.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST.filter(entradaPrecacheable),
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  // El juego es procedimental, sin binarios ni URLs externas: todo está en el
  // precache, así que no hay nada que cachear en tiempo de ejecución.
  runtimeCaching: [],
  precacheOptions: {
    cleanupOutdatedCaches: true,
    plugins: [
      {
        cacheWillUpdate: async ({ response }) => (respuestaPrecacheable(response, self.location.origin) ? response : null),
      },
    ],
  },
});

serwist.addEventListeners();
