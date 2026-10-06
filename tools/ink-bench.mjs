// What the ink shadows cost: two builds in two pages of one browser, the same view in each, timed in
// turns (a synced frame: 24 renderFrame() closed by a readPixels, the median of five, repeated and
// interleaved so a thermal drift hits both sides alike).
//   node tools/ink-bench.mjs --a http://localhost:6871/ --b http://localhost:6872/ \
//     --view "?level=references&view=22" --preset high --pairs 8
import { launch } from '../scripts/bench/browser.mjs';
import { prepareStorage } from '../scripts/bench/web-page.mjs';

const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1']] : a), []));
const preset = A.preset ?? 'high';
const [W, H] = (A.res ?? '1280x720').split('x').map(Number);
const pairs = +(A.pairs ?? 8);
const scale = A.scale ? +A.scale : (preset === 'handheld' ? 0.75 : 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { ctx, page } = await launch({ w: W, h: H, profile: `/tmp/.chrome-inkbench-${process.pid}` });
const pageB = await ctx.newPage();
await pageB.setViewportSize({ width: W, height: H });

async function open(p, base) {
  p.on('pageerror', (e) => console.error('page error:', String(e).slice(0, 200)));
  const ev = (fn, arg) => p.evaluate(fn, arg);
  await p.goto(base + 'manifest.webmanifest');
  await prepareStorage(ev, preset);
  await p.goto(base + (A.view ?? '?level=references&view=22'), { waitUntil: 'load' });
  await p.waitForFunction(() => window.__moebiusBooted && window.renderFrame, null, { timeout: 300000, polling: 100 });
  await sleep(A.settle ? +A.settle : 9000);
  await ev((scale) => {
    const pr = window.preset?.(); if (pr) pr.dynamic = null;
    window.quality.renderScale = scale; window.resize();
    window.__bench.timeGpu = false; window.sound?.setVolume?.(0);
  }, scale);
  await sleep(2500);
  return ev;
}

const evA = await open(page, (A.a ?? 'http://localhost:6871/').replace(/\/?$/, '/'));
const evB = await open(pageB, (A.b ?? 'http://localhost:6872/').replace(/\/?$/, '/'));

const timeIt = (ev) => ev(() => {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const run = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / n; };
  run(24);
  const a = [run(24), run(24), run(24), run(24), run(24)].sort((x, y) => x - y);
  return +a[2].toFixed(3);
});

const med = (xs) => { const s = [...xs].sort((x, y) => x - y); return s[s.length >> 1]; };
const a = [], b = [];
for (let i = 0; i < pairs; i++) {
  await page.bringToFront(); a.push(await timeIt(evA));
  await pageB.bringToFront(); b.push(await timeIt(evB));
}
console.log(JSON.stringify({
  view: A.view, preset, res: [W, H], scale, pairs,
  after: { median: med(a), all: a }, before: { median: med(b), all: b },
  deltaMs: +(med(a) - med(b)).toFixed(3), deltaPct: +(100 * (med(a) - med(b)) / med(b)).toFixed(1),
}));
await ctx.close();
