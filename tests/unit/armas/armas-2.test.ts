import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;

function hashDeMascara(datos: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(datos)).digest("hex");
}

test("armas-2: el catálogo tiene al menos 10 armas y ninguna produce el mismo par (huella, efecto) bajo idénticas condiciones", () => {
  assert.equal(CATALOGO_ARMAS.length >= 10, true, "el catálogo debe tener al menos 10 armas (diseño aprobado: 10)");

  const mascaraBase = crearMascaraPlana(ANCHO, ALTO, 900);
  const origenX = 300;
  const objetivoX = 1200;
  // Raíz "de lobo alto" del solucionador exacto: cualquier ángulo llega a
  // ALGÚN sitio, pero solo uno que impacte cerca del objetivo distingue de
  // verdad la caída de daño por distancia de cada arma (un impacto lejano
  // daría 0 en todas por igual, sin distinguir nada).
  const [{ anguloGrados, potencia }] = resolverSolucionesBalisticas(origenX, 0, objetivoX, 0, 1.0);

  const firmas = new Map<string, string>();
  for (const arma of CATALOGO_ARMAS) {
    // Fiabilidad < 1 (Petardo de Feria) introduce una tirada de azar que no
    // debe decidir "falla" con esta semilla: si lo hiciera, este arma
    // aportaría un vector todo-ceros, indistinguible de cualquier otra
    // arma que fallase, y este criterio no es el que comprueba armas-6.
    const resultado = resolverDisparo({
      mascara: mascaraBase,
      gravedad: 1.0,
      deriva: 0,
      aleatorio: crearEstadoAleatorio(1),
      arma,
      origenX,
      anguloGrados,
      potencia,
      objetivoX,
      objetivoY: 900,
      ancho: ANCHO,
      alto: ALTO,
    });
    assert.equal(resultado.fallo, false, `${arma.id}: la semilla elegida no debe hacer fallar el disparo en esta prueba`);

    const vector = JSON.stringify({
      danio: resultado.danioObjetivo,
      danioPropio: resultado.danioPropio,
      desplazamiento: resultado.desplazamientoObjetivoPx,
      puntos: resultado.puntosDeImpacto.map((p) => [Math.round(p.x), Math.round(p.y)]),
    });
    const firma = `${hashDeMascara(resultado.mascara.datos)}|${vector}`;

    const colision = firmas.get(firma);
    assert.equal(colision, undefined, `${arma.id} produce exactamente la misma huella y efecto que ${colision}`);
    firmas.set(firma, arma.id);
  }

  assert.equal(firmas.size, CATALOGO_ARMAS.length);
});
