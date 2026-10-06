// A/B screenshots for the ink-shadow / flat-shadow work: one build, one loaded frame, the post
// uniforms (or a material's) switched in the page between each shot, so before and after differ by
// nothing but the feature.
//   node tools/ink-shots.mjs --url http://localhost:5311/ --out /tmp/ink-work/shots --preset high \
//     --jobs tools/ink-shots.jobs.json
// Headed Chrome through Playwright, as scripts/bench/browser.mjs sets it up (muted, ANGLE Metal).
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch } from '../scripts/bench/browser.mjs';
import { prepareStorage } from '../scripts/bench/web-page.mjs';

const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1']] : a), []));
const BASE = (A.url ?? 'http://localhost:5311/').replace(/\/?$/, '/');
const out = resolve(A.out ?? '/tmp/ink-work/shots');
const preset = A.preset ?? 'high';
const [W, H] = (A.res ?? '1280x720').split('x').map(Number);
const jobs = JSON.parse(readFileSync(resolve(A.jobs), 'utf8'));
const only = A.only ? new Set(A.only.split(',')) : null;
const tag = A.tag ?? preset;
mkdirSync(out, { recursive: true });

const profile = `/tmp/.chrome-inkshots-${process.pid}`;
const { ctx, page } = await launch({ w: W, h: H, profile });
page.on('pageerror', (e) => console.error('page error:', String(e).slice(0, 300)));
const ev = (fn, arg) => page.evaluate(fn, arg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(BASE + 'manifest.webmanifest');
await prepareStorage(ev, preset);

for (const job of jobs) {
  if (only && !only.has(job.name)) continue;
  await page.goto(BASE + job.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__moebiusBooted && window.renderFrame, null, { timeout: 300000, polling: 100 });
  await sleep(job.settle ?? 6000);
  await ev(({ hour }) => {
    const p = window.preset?.(); if (p) p.dynamic = null;
    if (hour != null && window.sky) { window.sky.hour = hour; window.sky.speed = 0; window.updateSky?.(); }
    const s = document.createElement('style');
    s.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }';
    document.head.appendChild(s);
    document.querySelectorAll('body > *').forEach((e) => { if (e.tagName !== 'CANVAS' && e.querySelector('canvas')) e.style.setProperty('visibility', 'visible', 'important'); });
  }, { hour: job.hour ?? null });
  // the camera pinned where the job says, whatever the rig does with it (as scripts/bench/web-page.mjs)
  if (job.cam) await ev(({ eye, target, fov }) => {
    const { THREE, camera } = window;
    const up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
    const e = new THREE.Vector3(...eye), t = new THREE.Vector3(...target);
    const q = new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up));
    const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
    camera.updateMatrixWorld = function (force) {
      this.position.copy(e); this.quaternion.copy(q);
      if (this.fov !== fov) { this.fov = fov; this.updateProjectionMatrix(); }
      return base.call(this, force);
    };
  }, job.cam);
  await sleep(1500);
  for (const [label, snippet] of job.states) {
    if (snippet) await ev(new Function(snippet));
    await sleep(900);
    await page.screenshot({ path: join(out, `${tag}-${job.name}-${label}.png`) });
    console.log('shot', `${tag}-${job.name}-${label}`);
  }
}

await ctx.close();
