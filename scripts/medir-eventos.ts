// evt-1 con el lote largo de semillas. Fuera del CI rápido: el test de
// tests/unit/universo-eventos.test.ts corre la misma comprobación con 50.
// Uso: PRUEBA_LARGA=1 npm run medir:eventos
import { comprobarCalendarioDeEventos, NUM_SEMILLAS_EVT_1_LARGO } from "../tests/utils/calendarioEventos";

if (process.env.PRUEBA_LARGA !== "1") {
  console.error("medir-eventos: es una prueba larga; lánzala con PRUEBA_LARGA=1.");
  process.exit(1);
}

comprobarCalendarioDeEventos(NUM_SEMILLAS_EVT_1_LARGO);
console.log(`medir-eventos: ${NUM_SEMILLAS_EVT_1_LARGO} semillas de evt-1 sin fallos.`);
