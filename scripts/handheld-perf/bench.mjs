// node scripts/handheld-perf/bench.mjs <scenario> [toggle,...] [scale=0.75]
// What each feature costs: stand still in a scenario at a fixed render scale, then for each toggle time
// a tight loop of the game's own renderFrame() (synced by a one-pixel readPixels), so the 60 Hz cap
// doesn't hide the difference. `ms` is the frame's cost with CPU and GPU overlapping, `submit` the
// same frames without waiting for the GPU. Compare toggles with `base`, not with the live frame time
// (the loop runs about twice the game's own frame time).
import { ourPage, prepare, fullscreen, BASE, sleep } from './lib.mjs';
import { SCENARIOS } from './scenarios.mjs';

const [name = 'qanat', list = 'base,noShadow,noNear,noFar,postAlbedo,noCrowd,noFlora,scale05', scale = '0.75'] = process.argv.slice(2);
// [switch it off, switch it back on]
const TOGGLES = {
  base: ['', ''],
  noShadow: ['preset().nearEvery = preset().farEvery = 1e9', 'Object.assign(preset(), window.__every)'],
  noNear: ['preset().nearEvery = 1e9', 'Object.assign(preset(), window.__every)'],
  noFar: ['preset().farEvery = 1e9', 'Object.assign(preset(), window.__every)'],
  postAlbedo: ['post.uniforms.uDebug.value = 2', 'post.uniforms.uDebug.value = 0'],   // the ink pass reduced to one fetch
  postFull: ['post.uniforms.uPostLite.value = 0', 'post.uniforms.uPostLite.value = 1'],
  noFlora: ['window.__ff = preset().floraFar; preset().floraFar = 0.0001', 'preset().floraFar = window.__ff'],
  noCrowd: ['window.__cr = crowd && { ...crowd.range }; if (crowd) crowd.range.far = 0', 'if (crowd) Object.assign(crowd.range, window.__cr)'],
  noNpc: ['npcs.forEach((n) => (n.object.visible = false))', 'npcs.forEach((n) => (n.object.visible = true))'],
  scale05: ['quality.renderScale = 0.5; resize()', `quality.renderScale = ${scale}; resize()`],
  scale06: ['quality.renderScale = 0.6; resize()', `quality.renderScale = ${scale}; resize()`],
};
const page = await ourPage();
await prepare(page);
const sc = SCENARIOS[name];
await page.goto(BASE + '?' + sc.q);
await page.waitFor('!!window.__moebiusBooted', 300000, 250);
await fullscreen(page);
await sleep(sc.settle ?? 5000);
if (sc.setup) { await page.eval(sc.setup); await sleep(3000); }
await page.eval(`window.__every = { nearEvery: preset().nearEvery, farEvery: preset().farEvery }; preset().dynamic = null; quality.renderScale = ${scale}; resize(); 1`);
await sleep(1500);
for (const tg of list.split(',')) {
  const [on, off] = TOGGLES[tg];
  if (on) await page.eval(on + '; 1');
  await sleep(700);
  const r = await page.eval(() => {
    const gl = renderer.getContext(), px = new Uint8Array(4);
    const run = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / n; };
    run(4);
    const a = [run(12), run(12), run(12)].sort((x, y) => x - y);
    const t0 = performance.now();
    for (let i = 0; i < 8; i++) renderFrame();
    return { ms: +a[1].toFixed(2), submit: +((performance.now() - t0) / 8).toFixed(2), calls: renderer.info.render.calls, ktris: Math.round(renderer.info.render.triangles / 1000) };
  });
  if (off) await page.eval(off + '; 1');
  console.log(tg.padEnd(11), JSON.stringify(r));
}
page.close();
process.exit(0);
