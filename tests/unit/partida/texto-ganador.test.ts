import { test } from "node:test";
import assert from "node:assert/strict";
import { contarHumanos, etiquetaMinirobot, textoGanador } from "@/juego/textosPartida";

test("textoGanador: tabla de casos", () => {
  const casos: ReadonlyArray<[Parameters<typeof textoGanador>[0], string]> = [
    [{ ganador: "Tú", ganadorEsHumano: true, humanos: 1 }, "¡Has ganado!"],
    [{ ganador: "Almirante Bisagra", ganadorEsHumano: false, humanos: 1 }, "Gana Almirante Bisagra"],
    [{ ganador: "Luis", ganadorEsHumano: true, humanos: 2 }, "Gana Luis"],
    [{ ganador: null, ganadorEsHumano: false, humanos: 1 }, "Empate"],
  ];
  for (const [datos, esperado] of casos) assert.equal(textoGanador(datos), esperado);
});

test("etiquetaMinirobot: segunda persona solo para el único humano", () => {
  assert.equal(etiquetaMinirobot("Tú", true, 1), "Tu minirobot");
  assert.equal(etiquetaMinirobot("Almirante Bisagra", false, 1), "Minirobot de Almirante Bisagra");
  assert.equal(etiquetaMinirobot("Ana", true, 2), "Minirobot de Ana");
});

test("contarHumanos cuenta solo los asientos humanos", () => {
  const h = { tipo: "humano", nombre: "a", personalidad: null } as const;
  const ia = { tipo: "ia", nombre: "b", personalidad: null } as const;
  assert.equal(contarHumanos([h, ia, h]), 2);
});
