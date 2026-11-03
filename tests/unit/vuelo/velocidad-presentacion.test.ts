import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  acelerarHastaImpacto,
  alternarAnimacionesRapidas,
  animacionesRapidasActivas,
  CLAVE_ANIMACIONES_RAPIDAS,
  fijarFasePresentacion,
  obtenerEstadoPresentacion,
  obtenerFactorPresentacion,
  reiniciarVelocidadPresentacionParaPruebas,
  type FasePresentacion,
} from "../../../src/juego/vuelo/velocidadPresentacion";

const almacen = new Map<string, string>();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => void almacen.set(k, v),
    },
  },
});

beforeEach(() => {
  almacen.clear();
  reiniciarVelocidadPresentacionParaPruebas();
});

const FASES: readonly FasePresentacion[] = ["apuntado", "vuelo", "turno-ia", "post-impacto", "relevo", "remate"];
const EXCLUIDAS: readonly FasePresentacion[] = ["apuntado", "post-impacto", "relevo", "remate"];

test("vel-1: el botón existe solo en vuelo y turno-ia; el toque lleva a ×3 y el impacto lo borra", () => {
  assert.equal(obtenerEstadoPresentacion().botonVisible, false);
  acelerarHastaImpacto();
  assert.equal(obtenerFactorPresentacion(), 1, "un toque fuera de fase no se guarda");
  fijarFasePresentacion("vuelo");
  assert.deepEqual(obtenerEstadoPresentacion(), { factor: 1, fase: "vuelo", origen: null, botonVisible: true });
  acelerarHastaImpacto();
  acelerarHastaImpacto();
  assert.equal(obtenerEstadoPresentacion().origen, "toque");
  assert.equal(obtenerFactorPresentacion(), 3);
  fijarFasePresentacion("post-impacto");
  fijarFasePresentacion("vuelo");
  assert.equal(obtenerFactorPresentacion(), 1);
});

test("vel-3 (invariante): en apuntado, post-impacto, relevo y remate el factor es 1 con cualquier secuencia de toques", () => {
  fc.assert(
    fc.property(fc.array(fc.oneof(fc.constantFrom(...FASES).map((f) => ({ f })), fc.constant({ toque: true })), { maxLength: 40 }), fc.boolean(), (pasos, ajuste) => {
      reiniciarVelocidadPresentacionParaPruebas();
      almacen.clear();
      if (ajuste) alternarAnimacionesRapidas();
      let fase: FasePresentacion = "apuntado";
      for (const paso of pasos) {
        if ("f" in paso) {
          fase = paso.f;
          fijarFasePresentacion(fase);
        } else acelerarHastaImpacto();
        if (EXCLUIDAS.includes(fase)) {
          assert.equal(obtenerFactorPresentacion(), 1);
          assert.equal(obtenerEstadoPresentacion().botonVisible, false);
        }
      }
      // Tras salir a una fase excluida y volver a vuelo, el toque no sobrevive.
      fijarFasePresentacion("post-impacto");
      fijarFasePresentacion("vuelo");
      assert.equal(obtenerFactorPresentacion(), ajuste ? 3 : 1);
    }),
  );
});

test("vel-1: un toque en turno-ia sigue valiendo en el vuelo de la IA", () => {
  fijarFasePresentacion("turno-ia");
  acelerarHastaImpacto();
  fijarFasePresentacion("vuelo");
  assert.equal(obtenerFactorPresentacion(), 3);
});

test("vel-4: el ajuste se guarda y un valor corrupto cuenta como desactivado", () => {
  assert.equal(animacionesRapidasActivas(), false);
  assert.equal(alternarAnimacionesRapidas(), true);
  assert.equal(almacen.get(CLAVE_ANIMACIONES_RAPIDAS), "1");
  fijarFasePresentacion("vuelo");
  assert.deepEqual([obtenerFactorPresentacion(), obtenerEstadoPresentacion().origen], [3, "ajuste"]);
  fijarFasePresentacion("apuntado");
  assert.equal(obtenerFactorPresentacion(), 1, "el ajuste tampoco acelera fuera de vuelo");

  for (const basura of ["", "true", "2", "{", "yes", "0"]) {
    almacen.set(CLAVE_ANIMACIONES_RAPIDAS, basura);
    reiniciarVelocidadPresentacionParaPruebas();
    assert.equal(animacionesRapidasActivas(), false, `valor ${JSON.stringify(basura)}`);
  }
  almacen.set(CLAVE_ANIMACIONES_RAPIDAS, "1");
  reiniciarVelocidadPresentacionParaPruebas();
  assert.equal(animacionesRapidasActivas(), true);
});
