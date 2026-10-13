import { chromium } from "@playwright/test";
const URL = "https://shoot-my-starship-git-dev-arodrigosalas-projects.vercel.app";
const OUT = "/home/claude-user/work/20261010-141942-d875/refutador-capturas";
const SES = "/home/claude-user/work/20261010-141942-d875/sesion-vercel.json";
const b = await chromium.launch();
const out = {};
async function arrancar(w,h){
  const ctx = await b.newContext({ storageState: SES, viewport:{width:w,height:h}, hasTouch:true, isMobile: w<1000 });
  const p = await ctx.newPage();
  await p.goto(URL + "/?modo=barra-libre", { waitUntil: "networkidle" });
  await p.click('[data-testid="boton-jugar"]');
  await p.waitForSelector("#game-container canvas");
  await p.waitForFunction(() => window.__debug?.terreno?.listo === true && window.__debug.control !== undefined && window.__debug.cargarEscenario !== undefined && (window.__debug.planetas?.length ?? 0) > 0, undefined, {timeout:60000});
  if (await p.getByTestId("ayuda-cerrar").isVisible().catch(()=>false)) await p.getByTestId("ayuda-cerrar").click();
  await p.waitForFunction(() => window.__debug.control.puedeDisparar === true, undefined, { timeout: 60000 });
  return {ctx,p};
}
const silueta = (p) => p.evaluate(() => window.__debug.naves.map((n,i)=>{
  if (n.integridad<=0) return {i, muerta:true};
  const pts=[{x:n.x,y:n.y}]; for (let r of [12,18,22]) for (let g=0; g<360; g+=30) pts.push({x:n.x+r*Math.cos(g*Math.PI/180), y:n.y+r*Math.sin(g*Math.PI/180)});
  const s=window.__debug.terreno.comprobarPuntos(pts); return {i, x:Math.round(n.x), y:Math.round(n.y), integ:n.integridad, solidos:s.filter(Boolean).length, centro:s[0]};
}));
console.error("inicio");
// Caso dedo-1 con toques reales
for (const [w,h] of [[360,640]]) { try {
  const {ctx,p} = await arrancar(w,h);
  await p.evaluate(() => { const n=window.__debug.naves; window.__debug.cargarEscenario({naves:[{x:window.__debug.mundo.ancho/2,y:window.__debug.mundo.alto*0.45,integridad:150},{x:n[1].x,y:n[1].y,integridad:150}],arma:"pepinazo-cortesia",anguloGrados:45,potencia:50}); });
  await p.waitForFunction(() => window.__debug.control.ajuste.potencia === 50 && window.__debug.control.puedeDisparar === true, undefined, {timeout:15000});
  const plegar = p.getByTestId("consola-plegar"); if (await plegar.isVisible().catch(()=>false)) await plegar.click();
  const caja = await p.locator("#game-container canvas").boundingBox();
  const est = await p.evaluate(({x,y,w,h}) => { const n=window.__debug.naves[0], m=window.__debug.mundo; return {x:x+(n.x/m.ancho)*w, y:y+(n.y/m.alto)*h}; }, {x:caja.x,y:caja.y,w:caja.width,h:caja.height});
  const cdp = await ctx.newCDPSession(p);
  const tp = (type,x,y)=>cdp.send("Input.dispatchTouchEvent",{type, touchPoints: type==="touchEnd"?[]:[{x,y,id:1}]});
  await tp("touchStart", est.x+100, est.y);
  await p.waitForTimeout(200);
  const f0 = await p.evaluate(()=>window.__debug.flechaApuntado);
  const aj0 = await p.evaluate(()=>window.__debug.control.ajuste);
  const nx = f0 ? f0.naveX : est.x, ny = f0 ? f0.naveY : est.y;
  const dx = nx+100, dy = ny;
  // recolocar
  await tp("touchEnd"); await tp("touchStart", dx, dy); await p.waitForTimeout(100);
  for (let k=1;k<=8;k++) { await tp("touchMove", dx, dy-5*k); await p.waitForTimeout(16); }
  await p.waitForTimeout(150); await p.screenshot({ path: `${OUT}/dedo-lateral-${w}x${h}.png` });
  await tp("touchEnd"); await p.evaluate(()=>window.__debug.fijarApuntado?.(45,50)); await p.waitForTimeout(200);
  const r = {};
  for (const [pasos, tam] of [[1,160],[32,5]]) {
    await p.evaluate(()=>window.__debug.fijarApuntado?.(45,50)); await p.waitForTimeout(200);
    const ini = await p.evaluate(()=>({...window.__debug.control.ajuste}));
    await tp("touchStart", dx, dy); await p.waitForTimeout(80);
    for (let k=1;k<=pasos;k++) { await tp("touchMove", dx, dy-tam*k); await p.waitForTimeout(16); }
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/dedo-barrido-${pasos}pasos-${w}x${h}.png` });
    r[pasos] = { ini, fin: await p.evaluate(()=>({...window.__debug.control.ajuste})), et: await p.evaluate(()=>window.__debug.flechaApuntado?.etiqueta) };
    await tp("touchEnd"); await p.waitForTimeout(100);
  }
  out["barrido"+w] = r;
  await tp("touchEnd");
  await p.waitForTimeout(150);
  await ctx.close(); continue;
  await p.getByTestId("disparar").click();
  await p.waitForTimeout(120);
  const proy = await p.evaluate(()=>window.__debug.proyectil);
  out["dedo"+w] = { est, f0: f0 && {naveX:f0.naveX,naveY:f0.naveY,et:f0.etiqueta}, aj0, aj1, aj2, f2: f2 && {et:f2.etiqueta, ex:f2.etiquetaX, ey:f2.etiquetaY, nx:f2.naveX, ny:f2.naveY}, scrollY, proy, lat: await p.evaluate(()=>window.__debug.latencias?.()?.slice(-3)) };
  await ctx.close();
} catch(e) { out["dedo"+w] = String(e); } }
console.log(JSON.stringify(out,null,0));
await b.close();
