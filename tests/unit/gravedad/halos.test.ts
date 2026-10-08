import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { aceleracionPozo, radiosHalo } from "@/sim/gravedad/halos";
import { masaPlaneta, type Planeta } from "@/sim/gravedad/planetas";

const ANCHO = 1920;
const ALTO = 1080;

function planeta(radio: number, densidad: number, cx = 900, cy = 500): Planeta {
  return { id: 1, cx, cy, radio, densidad, pixelesVivos: Math.PI * radio * radio };
}

// El multiplicador de gravedad del universo escala la densidad (conGravedad) y
// un cráter escala los píxeles vivos: ambos son «masa viva / masa de nacimiento».
const arbitrarioPozo = fc.record({
  radio: fc.double({ min: 40, max: 110, noNaN: true }),
  densidad: fc.double({ min: 0.6, max: 1.5, noNaN: true }),
  fraccion: fc.double({ min: 0.25, max: 4, noNaN: true }),
});

function pozoVivo(p: { radio: number; densidad: number; fraccion: number }): { vivo: Planeta; referencia: number } {
  const nacimiento = planeta(p.radio, p.densidad);
  return { vivo: { ...nacimiento, densidad: p.densidad * p.fraccion }, referencia: masaPlaneta(nacimiento) };
}

test("hal-1: cada anillo k cumple |a(r_k) - a_sup·2^-(k+1)| ≤ 1 % del objetivo, para cualquier pozo y multiplicador", () => {
  fc.assert(
    fc.property(arbitrarioPozo, (p) => {
      const { vivo, referencia } = pozoVivo(p);
      for (const anillo of radiosHalo(vivo, referencia, ANCHO, ALTO)) {
        const real = aceleracionPozo(vivo, anillo.r);
        assert.ok(Math.abs(real - anillo.aceleracion) <= 0.01 * anillo.aceleracion, `nivel ${anillo.nivel}: ${real} vs ${anillo.aceleracion}`);
      }
    }),
    { numRuns: 200 },
  );
});

test("hal-1: los radios crecen y la opacidad decrece estrictamente con el radio", () => {
  fc.assert(
    fc.property(arbitrarioPozo, (p) => {
      const { vivo, referencia } = pozoVivo(p);
      const anillos = radiosHalo(vivo, referencia, ANCHO, ALTO);
      for (let i = 1; i < anillos.length; i++) {
        assert.ok(anillos[i].r > anillos[i - 1].r);
        assert.ok(anillos[i].opacidad < anillos[i - 1].opacidad);
      }
    }),
    { numRuns: 200 },
  );
});

test("hal-1: hay entre 3 y 4 anillos con masa viva entre ¼ y 4× la de nacimiento", () => {
  fc.assert(
    fc.property(arbitrarioPozo, (p) => {
      const { vivo, referencia } = pozoVivo(p);
      const n = radiosHalo(vivo, referencia, ANCHO, ALTO).length;
      assert.ok(n >= 3 && n <= 4, `anillos: ${n}`);
    }),
    { numRuns: 200 },
  );
});

test("hal-2: con gravedad ×2 el anillo 0 crece y con ÷2 mengua (la física lo fija, no un factor a mano)", () => {
  const nacimiento = planeta(80, 1);
  const referencia = masaPlaneta(nacimiento);
  const base = radiosHalo(nacimiento, referencia, ANCHO, ALTO);
  const doble = radiosHalo({ ...nacimiento, densidad: 2 }, referencia, ANCHO, ALTO);
  const mitad = radiosHalo({ ...nacimiento, densidad: 0.5 }, referencia, ANCHO, ALTO);
  // El suavizado de Aarseth (eps = radio) hace que cerca del planeta el
  // anillo crezca más que √2 (≈1,55 en r_0); lejos tiende a √2.
  const razon = doble[0].r / base[0].r;
  assert.ok(razon > 1.3 && razon < 1.7, `razón x2: ${razon}`);
  const ultima = doble[3].r / base[3].r;
  assert.ok(Math.abs(ultima - Math.SQRT2) / Math.SQRT2 < 0.05, `razón x2 lejos: ${ultima}`);
  const m = mitad.find((a) => a.nivel === 1)!.r / base[1].r;
  assert.ok(m < 1 / 1.2 && m > 0.5, `razón ÷2: ${m}`);
});

test("hal-2: un cráter que baja la masa viva hace menguar el anillo 1", () => {
  const nacimiento = planeta(80, 1);
  const referencia = masaPlaneta(nacimiento);
  const entero = radiosHalo(nacimiento, referencia, ANCHO, ALTO);
  const herido = radiosHalo({ ...nacimiento, pixelesVivos: nacimiento.pixelesVivos * 0.6 }, referencia, ANCHO, ALTO);
  assert.ok(herido.find((a) => a.nivel === 1)!.r < entero[1].r);
});

test("hal-1: si un nivel cae fuera de la diagonal del mundo se omite y quedan 3", () => {
  const nacimiento = planeta(110, 1.5);
  const referencia = masaPlaneta(nacimiento);
  const enMundoPequeno = radiosHalo(nacimiento, referencia, 600, 350);
  const completo = radiosHalo(nacimiento, referencia, ANCHO, ALTO);
  assert.equal(completo.length, 4);
  assert.equal(enMundoPequeno.length, 3);
  assert.ok(enMundoPequeno.every((a) => a.r <= Math.hypot(600, 350)));
});
