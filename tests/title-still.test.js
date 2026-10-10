// The 100-second title (docs/systems/xbox.md): on the Xbox the title's world took 100 s to show on a first launch
// (its GPU programs compiled by ANGLE's D3D11 back end: ~1 s for each surface program, 16-28 s for the ink pass,
// two at a time) and froze the menu up to 4 s at a time meanwhile (each program's first use blocked till it was
// linked). Now: the shot's still at once (src/title-still.js), the live world only where it is worth making, each
// program's first use waiting for the driver, and the ink pass without its debug views and lite path compiled in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { liveWorld, rememberBuild, showStill, stillUrl, TITLE_SLOW_MS, SLOW_KEY } from '../src/title-still.js';
import { SHOTS } from '../src/title-shots.js';
import { firstUse } from '../src/warm-shaders.js';

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

test('the live world: never on the Xbox, not on a GPU remembered as slow; ?vista= overrides', () => {
  assert.equal(liveWorld({ xbox: true }), false, 'the Xbox keeps the still');
  assert.equal(liveWorld({ xbox: true, search: '?vista=live' }), true, 'unless asked for (testing)');
  assert.equal(liveWorld({}), true);
  assert.equal(liveWorld({ search: '?vista=still' }), false);
  const s = store();
  assert.equal(liveWorld({ storage: s, gpu: 'ANGLE (slow)' }), true, 'a GPU not seen yet builds it');
  rememberBuild(s, 'ANGLE (slow)', TITLE_SLOW_MS + 1000);
  rememberBuild(s, 'ANGLE (fast)', 3000);
  assert.equal(liveWorld({ storage: s, gpu: 'ANGLE (slow)' }), false, 'a slow build: the still next time');
  assert.equal(liveWorld({ storage: s, gpu: 'ANGLE (fast)' }), true);
  assert.deepEqual(Object.keys(JSON.parse(s.getItem(SLOW_KEY))), ['ANGLE (slow)'], 'only the slow ones are kept');
  rememberBuild(s, 'ANGLE (slow)', 2000);
  assert.equal(s.getItem(SLOW_KEY), null, 'a fast build forgets it');
  s.setItem(SLOW_KEY, 'not json');
  assert.equal(liveWorld({ storage: s, gpu: 'x' }), true, 'a broken entry is ignored');
});

test('the still: on screens wide enough for its 16:9 framing, one picture for every shot, small', () => {
  assert.equal(showStill(SHOTS[0], 1920, 1080), true);
  assert.equal(showStill(SHOTS[0], 1024, 768), true);
  assert.equal(showStill(SHOTS[0], 390, 844), false, 'a phone held upright: the paper, as before');
  assert.equal(showStill(null, 1920, 1080), false);
  for (const s of SHOTS) {
    const f = new URL(`../public/${stillUrl(s)}`, import.meta.url);
    assert.ok(existsSync(f), `${s.id}: ${stillUrl(s)} (node scripts/title-shots.mjs ${s.id} --stills)`);
    assert.ok(statSync(f).size < 400e3, `${s.id}: under 400 kB`);
  }
});

test('the title shows the still at once and makes the live world only where liveWorld says', () => {
  const t = src('title.js');
  assert.match(t, /const still = showStill\(shot, win\.innerWidth, win\.innerHeight\)/);
  assert.match(t, /still\.onload = \(\) => \{[^}]*root\.classList\.add\('still-on'\)/);
  assert.match(t, /if \(shot && liveWorld\(\{ xbox: isXboxApp, search: [^)]*\}\)\) whenIdle\(startWorld\);/);
  assert.match(t, /skip: \(gpu\) => !liveWorld\(\{ search: [^}]*storage: ls, gpu \}\)/, 'the GPU remembered as slow is skipped');
  assert.match(t, /rememberBuild\(ls, v\.gpu, /, 'each build\'s time remembered');
  assert.match(t, /if \(shot\.mirror\) still\.style\.transform = 'scaleX\(-1\)'/, 'mirrored as the canvas is');
  const w = src('title-world.js');
  assert.match(w, /if \(skip\(gpu\)\) \{ renderer\.dispose\(\); renderer\.forceContextLoss\(\); return null; \}/);
  const css = readFileSync(new URL('../src/menus.css', import.meta.url), 'utf8');
  assert.match(css, /#title\.still-on img\.still \{ opacity: 1; \}/);
  assert.match(css, /#title\.still-on \.land \{ display: none; \}/, 'the still, not the drawn land');
  assert.ok(css.indexOf('#title.still-on .paper') > css.indexOf('#title.vista-wait .paper'), 'the still wins over the waiting paper');
});

test('a program is first used only once the driver says it is linked (no blocking query)', async () => {
  let ready = false, asked = 0, polls = 0;
  const p = { isReady: () => { polls++; return ready; }, getUniforms: () => { asked++; assert.ok(ready, 'asked before it was linked'); } };
  setTimeout(() => { ready = true; }, 40);
  await firstUse({ info: { programs: [p, { getUniforms: () => { asked++; } }] } }, async () => {});
  assert.equal(asked, 2);
  assert.ok(polls > 1, 'it polled');
  // never linked (a lost context): it gives up after `wait` and goes on
  const stuck = { isReady: () => false, getUniforms: () => { asked++; } };
  await firstUse({ info: { programs: [stuck] } }, async () => {}, { wait: 30 });
  assert.equal(asked, 3);
  // the title and the game's load first use them before their warm draws ask for them
  const w = src('title-world.js');
  assert.ok(w.indexOf('await firstUse(renderer, step)') < w.indexOf("onStage('uploads')"));
  const m = src('main.js');
  assert.ok(m.indexOf('await firstUse(renderer, slice)') > 0 && m.indexOf('await firstUse(renderer, slice)') < m.indexOf('const warmDraw = new WarmDraw('));
  // the passage warm-up: the first view whatever it takes; past it, a new kind only if its first draw (as long as the
  // view's took on average) still fits the budget (the Xbox: 1-15 s each, docs/systems/performance.md)
  assert.match(m, /const first = i < seen\.length;\s*if \(!first && performance\.now\(\) - t0 > PASSAGE\.loadBudget\) break;/);
  assert.match(m, /if \(ks\.length && \(fresh\.size \+ ks\.length\) \* per > left\) return false;/);
});

test('the ink pass compiles its debug views and its lite path in only when asked for', async () => {
  const p = src('post.js');
  assert.doesNotMatch(p, /uDebug == \d/, 'a debug view is DEBUG_VIEW(n): compiled out without INK_DEBUG');
  assert.doesNotMatch(p, /uPostLite > 0\.5/, 'the lite path is POST_LITE: one or the other compiled in');
  assert.match(p, /#ifdef INK_DEBUG\s*#define DEBUG_VIEW\(n\) \(uDebug == n\)\s*#else\s*#define DEBUG_VIEW\(n\) false/);
  const { createPost } = await import('../src/post.js');
  const post = createPost(), m = post.scene.children[0].material;
  assert.deepEqual(m.defines, {});
  const v = m.version;
  post.uniforms.uPostLite.value = 1;
  assert.deepEqual(Object.keys(m.defines), ['INK_LITE']);
  assert.ok(m.version > v, 'recompiled');
  post.uniforms.uDebug.value = 9;
  assert.deepEqual(Object.keys(m.defines).sort(), ['INK_DEBUG', 'INK_LITE']);
  post.uniforms.uDebug.value = 0; post.uniforms.uPostLite.value = 0;
  assert.deepEqual(m.defines, {});
});

test('a warm draw\'s programs are compiled first, each pass with its target and override worn, then put back', async () => {
  const THREE = await import('three');
  const { WarmDraw } = await import('../src/passage.js');
  const seen = [];
  let target = 'none';
  const R = {
    getRenderTarget: () => target, setRenderTarget: (t) => { target = t; },
    compile: (scene) => { const out = new Set(); scene.traverse((o) => { if (o.material) { seen.push([target, o.material.name]); out.add(o.material); } }); return out; },
  };
  const override = new THREE.MeshBasicMaterial({ name: 'depth' });
  const own = new THREE.MeshBasicMaterial({ name: 'own' });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), own);
  const wd = new WarmDraw(R, new THREE.Scene(), { passes: [{ target: 'gbuffer', camera: new THREE.PerspectiveCamera() }, { target: 'shadow', camera: new THREE.PerspectiveCamera(), override }] });
  const mats = wd.compile([mesh]);
  assert.deepEqual(seen, [['gbuffer', 'own'], ['shadow', 'depth']]);
  assert.deepEqual([...mats].map((m) => m.name), ['own', 'depth']);
  assert.equal(mesh.material, own, 'its own material back');
  assert.equal(target, 'none', 'the target put back');
  assert.equal(wd.holder.children.length, 0);
});
