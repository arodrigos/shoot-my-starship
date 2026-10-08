import { test, expect } from "@playwright/test";

test("diag-perfil", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 640 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto("/");
  await page.getByTestId("boton-jugar").click();
  await page.waitForSelector("#game-container canvas");
  await page.waitForFunction(() => window.__debug.control?.puedeDisparar === true, undefined, { timeout: 90000 });
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.start");
  await page.waitForTimeout(5000);
  const { profile } = await cdp.send("Profiler.stop");
  const propio = new Map<number, number>();
  const nodos = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => propio.set(id, (propio.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const porFuncion = new Map<string, number>();
  for (const [id, t] of propio) {
    const n = nodos.get(id)!;
    const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`;
    porFuncion.set(k, (porFuncion.get(k) ?? 0) + t);
  }
  const top = [...porFuncion].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, t]) => `${Math.round(t / 1000)}ms ${k}`);
  expect(top.join(" || ")).toBe("");
});
