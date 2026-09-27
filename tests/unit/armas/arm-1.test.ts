import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisparo } from "@/sim/armas/resolver";
import { crearEstadoAleatorio } from "@/sim/aleatorio";
import { CATALOGO_ARMAS } from "@/sim/armas/catalogo";
import { resolverSolucionesBalisticas } from "@/sim/balistica/solucionador";
import type { Arma } from "@/sim/armas/tipos";
import { crearMascaraPlana } from "../../utils/terrenoPlano";

const ANCHO = 1920;
const ALTO = 1080;

// arm-1: al menos 10 armas declaradas, todas con los ejes nuevos leídos de
// forma genérica (ninguna tiene por qué declararlos: son opcionales).
test("arm-1: el catálogo tiene 10 armas o más", () => {
  assert.equal(CATALOGO_ARMAS.length >= 10, true, `el catálogo tiene ${CATALOGO_ARMAS.length} armas`);
});

// Arma inventada SOLO en este test, con los ejes nuevos rellenos, para
// probar que resolverDisparo la resuelve igual que a cualquiera del
// catálogo real -- sin tocar resolver.ts ni catalogo.ts para hacerlo andar.
const ARMA_INVENTADA: Arma = {
  id: "arma-inventada-arm-1",
  nombre: "Arma Inventada de Arm-1",
  descripcion: "No existe en el catálogo real: solo prueba que el resolutor es genérico sobre los ejes nuevos.",
  comportamiento: { tipo: "impacto-simple" },
  huella: { tipo: "circular", radio: 18, signo: "restar" },
  efecto: { tipo: "danio", radioEfectoPx: 40, danioMaximo: 15 },
  fiabilidad: 1,
  coste: 999,
  penetracionPx: 0,
  dispersionGrados: 0,
  disparosSimultaneos: { cantidad: 1, aperturaGrados: 0 },
  inmuneAGravedad: false,
};

test("arm-1: un arma inventada solo en el test, con los ejes nuevos declarados, se resuelve sin tocar el resolutor", () => {
  const mascara = crearMascaraPlana(ANCHO, ALTO, 900);
  const [solucion] = resolverSolucionesBalisticas(300, 900, 900, 900, 1);
  const resultado = resolverDisparo({
    mascara,
    gravedad: 1,
    deriva: 0,
    aleatorio: crearEstadoAleatorio(1),
    arma: ARMA_INVENTADA,
    origenX: 300,
    anguloGrados: solucion.anguloGrados,
    potencia: solucion.potencia,
    objetivoX: 900,
    objetivoY: 900,
    ancho: ANCHO,
    alto: ALTO,
  });

  assert.equal(resultado.fallo, false);
  assert.equal(resultado.puntosDeImpacto.length, 1);
  assert.equal(resultado.danioObjetivo > 0, true);
});
