// The title answers at once (docs/systems/ui.md, "The title screen", Boot): its menu is up and wired before
// anything heavy runs; the sound's start and the world wait for the browser's idle time and never run while
// the player is pressing; the world's build stands aside between its slices while they press; its shaders are
// compiled and first used a slice at a time (src/warm-shaders.js), never in one task with the first frame.
// The bug: the title froze 0.5-7 s as its world came in (compileAsync then the first frame, one task), and
// presses went unanswered. scripts/title-perf.mjs measures it in Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gatedSlicer, runStepsAsync } from '../src/load-steps.js';
import { warmShadersSliced, firstUse, programKind } from '../src/warm-shaders.js';
import { AudioContext as EngineAudioContext } from '../engine/webaudio.js';

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('the title draws and wires its menu first; the sound and the world wait for idle time and a pause in the presses', () => {
  const t = src('title.js');
  const at = (s) => { const i = t.indexOf(s); assert.ok(i > 0, s); return i; };
  // the sound is made without its start (opening an audio context to ask is 100-250 ms)
  assert.match(t, /new Sound\('title', \{ score: false, titleTheme: true, autoStart: false \}\)/);
  // the menu shown and the heartbeat marked before anything waits
  assert.ok(at("show('main')") < at('sound.startIfAllowed()'));
  assert.ok(at('markBooted(win)') < at('sound.startIfAllowed()'));
  // both in whenIdle: requestIdleCallback (with a timeout), put off while busy()
  assert.match(t, /const whenIdle = \(fn, timeout = \d+\) => \{[\s\S]*?if \(busy\(\)\) setTimeout\(\(\) => whenIdle\(fn, timeout\), \d+\); else fn\(\);[\s\S]*?requestIdleCallback\(go, \{ timeout \}\)/);
  assert.match(t, /whenIdle\(\(\) => \{\s*sound\.startIfAllowed\(\);\s*if \(shot\) whenIdle\(startWorld\);/);
  // every press counts: keys, pointers, touches (the capture listeners) and the pad (the Controller's activity)
  assert.match(t, /const onInput = \(e\) => \{ pressed\(\);/);
  assert.match(t, /activity: \(\) => \{ pressed\(\);/);
  assert.match(t, /const busy = \(\) => now\(\) - lastInput < TITLE_QUIET;/);
  // the world is handed busy, and builds in the gated slicer
  assert.match(t, /startTitleWorld\(\{[^}]*busy,/);
  const w = src('title-world.js');
  assert.match(w, /const slice = gatedSlicer\(\{ busy, stopped \}\);\s*await slice\.quiet\(\);/);
  assert.ok(w.indexOf('await slice.quiet()') < w.indexOf('new THREE.WebGLRenderer('), 'the context is not made under a press');
});

test('the title world never compiles in one task with its first frame', () => {
  const w = src('title-world.js');
  assert.doesNotMatch(w, /\.compileAsync\(/, 'compileAsync then render() was the freeze');
  const warm = w.indexOf('await warmShadersSliced(renderer, scene, camera, { target: gbuffer');
  const first = w.indexOf('await firstUse(renderer, step)');
  const draw = w.indexOf('try { render(); }');
  assert.ok(warm > 0 && first > warm && draw > first, 'compiled, then first used, then drawn');
  assert.match(w, /warmShadersSliced\(renderer, scene, camera, \{ target: cascades\.near\.rt, wear: shadowOverride/, 'the shadow passes\' programs too');
  assert.match(w, /warmDraw\.draw\(seen\.slice\(i, i \+ 8\)\); await step\(\); await pace\(\);/, 'what the view sees uploaded a few at a time');
  // and the long pieces of the build go in steps: the traveller's body, the sand's drifts
  assert.match(w, /await runStepsAsync\(createTravellerV1Steps\(player\.char, assets\), slice\)/);
  assert.match(src('levels/desert.js'), /yield\* sand\.close\(\)\.buildSteps\(/);
  assert.match(src('levels/desert.js'), /yield\* sand\.raiseSteps\(terrain\)/);
});

test('the gated slicer waits while the player presses, and goes on once they stop', async () => {
  let pressing = true, now = 0;
  const s = gatedSlicer({ busy: () => pressing, budget: 0, poll: 5 });
  setTimeout(() => { pressing = false; now = 1; }, 40);
  const t0 = performance.now();
  assert.equal(await s(), true);
  assert.ok(performance.now() - t0 >= 30, 'it waited for the presses to stop');
  assert.equal(now, 1);
  // not pressing: a yield and on
  const t1 = performance.now();
  await s();
  assert.ok(performance.now() - t1 < 30);
  // a cancelled build stops waiting
  let stop = false;
  const g = gatedSlicer({ busy: () => true, stopped: () => stop, budget: 0, poll: 5 });
  setTimeout(() => { stop = true; }, 20);
  await g();
  // within its budget it doesn't yield, nor ask
  let asked = 0;
  const h = gatedSlicer({ busy: () => { asked++; return true; }, budget: 1e9 });
  assert.equal(await h(), false);
  assert.equal(asked, 0);
  // it runs a world's steps as slicer() does
  function* steps() { yield; yield; return 7; }
  assert.equal(await runStepsAsync(steps(), gatedSlicer({ budget: 0 })), 7);
});

// a renderer that records what it is asked: compile() makes a program per material, the target bound at the time
function fakeRenderer() {
  const programs = new Map(), log = [];
  let target = null;
  const r = {
    log, info: { programs: [] },
    getRenderTarget: () => target,
    setRenderTarget: (t) => { target = t; },
    properties: { get: (m) => ({ currentProgram: programs.get(m) }) },
    compile(o, camera, keyScene) {
      const m = o.material;
      log.push(['compile', o.name, target, keyScene?.isScene ?? false]);
      if (!programs.has(m)) {
        const p = { ready: false, isReady() { return this.ready; }, getUniforms() { log.push(['first use', m.name]); return {}; } };
        programs.set(m, p); r.info.programs.push(p);
        setTimeout(() => { p.ready = true; }, 5);
      }
      return new Set([m]);
    },
  };
  return r;
}
const mesh = (name, material, extra = {}) => ({ name, material, isMesh: true, geometry: { attributes: {} }, ...extra });
const sceneOf = (list) => ({ traverse: (f) => list.forEach(f) });

test('the shaders are compiled one kind at a time, a slice between, with the pass\'s target, then first used a slice each', async () => {
  const r = fakeRenderer();
  const stone = { id: 1, name: 'stone' }, sand = { id: 2, name: 'sand' };
  const meshes = [mesh('a', stone), mesh('b', stone), mesh('c', sand), mesh('d', stone, { isInstancedMesh: true })];
  const scene = sceneOf(meshes);
  const slices = [];
  const slice = async () => { slices.push(r.log.length); };
  const target = { name: 'gbuffer' };
  const kinds = await warmShadersSliced(r, scene, {}, { target, slice });
  assert.equal(kinds, 3, 'stone, sand, and the instanced stone (another program)');
  assert.deepEqual(r.log.map((l) => l[1]), ['a', 'c', 'd']);
  assert.ok(r.log.every((l) => l[2] === target && l[3]), 'with the pass\'s target bound, keyed on an empty scene');
  assert.equal(r.getRenderTarget(), null, 'the target put back');
  assert.equal(slices.length, 3, 'a slice after each compile');
  assert.ok(r.info.programs.every((p) => p.ready), 'the driver waited for (polled)');
  // a material worn for the pass (the shadow maps'): one program per kind of mesh, the meshes' own put back
  const depth = { id: 9, name: 'depth' };
  await warmShadersSliced(r, scene, {}, { wear: depth, slice });
  assert.deepEqual(meshes.map((o) => o.material), [stone, stone, sand, stone]);
  assert.equal(programKind(mesh('x', depth), depth) === programKind(mesh('y', depth, { isInstancedMesh: true }), depth), false);
  // first use: every program, a slice after each
  r.log.length = 0; slices.length = 0;
  await firstUse(r, slice);
  assert.equal(r.log.filter((l) => l[0] === 'first use').length, r.info.programs.length);
  assert.equal(slices.length, r.info.programs.length);
});

test('the title\'s sound starts only when asked, on one audio context (the probe\'s own, when it runs)', async () => {
  let made = 0;
  class AC extends EngineAudioContext { constructor(o) { super(o); made++; } }
  const win = Object.assign(new EventTarget(), { AudioContext: AC, document: Object.assign(new EventTarget(), { hidden: false }) });
  const saved = { window: globalThis.window, localStorage: globalThis.localStorage };
  globalThis.window = win;
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  try {
    const { Sound } = await import('../src/audio.js');
    const s = new Sound('title', { score: false, autoStart: false });
    assert.equal(made, 0, 'no audio context while the menu comes up');
    s.startIfAllowed();
    assert.equal(made, 1, 'one context: the probe that found sound allowed is the one it plays on');
    assert.ok(s.ctx instanceof AC);
    s.startIfAllowed();
    assert.equal(made, 1, 'started: not asked again');
    s.dispose?.();
    // a world's Sound starts at once, as before
    made = 0;
    const w = new Sound('desert');
    assert.equal(made, 1);
    assert.ok(w.ctx);
    w.dispose?.();
  } finally {
    globalThis.window = saved.window; globalThis.localStorage = saved.localStorage;
  }
});

test('the title\'s recording is balanced in steps, the page answering meanwhile', async () => {
  const { prepareSoundtrack, prepareSoundtrackSteps } = await import('../src/soundtracks.js');
  const ctx = new EngineAudioContext({ sampleRate: 1000 });
  const original = ctx.createBuffer(2, 700000, 1000);
  for (let ch = 0; ch < 2; ch++) original.getChannelData(ch).fill(0.25);
  let yields = 0;
  const gen = prepareSoundtrackSteps(ctx, original);
  let r = gen.next();
  while (!r.done) { yields++; r = gen.next(); }
  assert.ok(yields >= 4, `${yields} steps`);
  const whole = prepareSoundtrack(ctx, original);
  assert.equal(r.value.length, whole.length);
  assert.equal(r.value.getChannelData(1)[123], whole.getChannelData(1)[123]);
  await sleep(0);
});
