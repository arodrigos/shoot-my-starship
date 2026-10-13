import { chromium } from "@playwright/test";
const URL = "https://shoot-my-starship-git-dev-arodrigosalas-projects.vercel.app";
const OUT = "/home/claude-user/work/20261010-141942-d875/refutador-capturas";
const SES = "/home/claude-user/work/20261010-141942-d875/sesion-vercel.json";
const sizes = [[360,640],[820,1180],[1180,820]];
const b = await chromium.launch();
const res = {};
for (const [w,h] of sizes) {
  const ctx = await b.newContext({ storageState: SES, viewport:{width:w,height:h}, hasTouch: true, isMobile: w<1000 });
  const p = await ctx.newPage();
  const errs=[]; p.on("pageerror", e=>errs.push(String(e)));
  await p.goto(URL + "/", { waitUntil: "networkidle" });
  await p.waitForSelector('[data-testid="boton-jugar"]', {timeout: 30000});
  await p.screenshot({ path: `${OUT}/inicio-${w}x${h}.png` });
  const m = await p.evaluate(() => {
    const j = document.querySelector('[data-testid="boton-jugar"]').getBoundingClientRect();
    const mu = document.querySelector('[data-testid="inicio-toggle-musica"]').getBoundingClientRect();
    return { scrollY, ih: innerHeight, jugar:[j.top,j.bottom,j.width,j.height], musica:[mu.top,mu.bottom,mu.width,mu.height], ariaMus: document.querySelector('[data-testid="inicio-toggle-musica"]').getAttribute("aria-pressed") };
  });
  await p.click('[data-testid="inicio-toggle-musica"]');
  m.ariaTras = await p.getAttribute('[data-testid="inicio-toggle-musica"]', "aria-pressed");
  await p.click('[data-testid="boton-jugar"]');
  await p.waitForSelector("#game-container canvas", {timeout: 30000});
  await p.waitForFunction(() => window.__debug?.control?.puedeDisparar === true, undefined, { timeout: 60000 }).catch(()=>{});
  await p.waitForTimeout(1500);
  m.musicaPartida = await p.evaluate(() => { try { return window.__debug.musica?.(); } catch(e) { return String(e); } });
  await p.screenshot({ path: `${OUT}/partida-${w}x${h}.png` });
  m.errs = errs;
  res[`${w}x${h}`] = m;
  await ctx.close();
}
console.log(JSON.stringify(res, null, 1));
await b.close();
