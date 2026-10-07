// The people's posing reads world matrices it knows are current instead of recomputing them (src/world-read.js):
// the same poses to the float. Two copies of the game (the Unity bundle in two bare V8 contexts, as tests/engine-unity
// runs it), one posing as before (__POSE_EXACT__: every getWorldPosition and getWorldQuaternion recomputing up its
// parents), the other as now, in lockstep on the same clock and the same random numbers through the camps (people
// walking, sitting round the fires, carrying, their capes' colliders), a conversation and a walk: every bone's world
// matrix compared every frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';

const VIEWS = JSON.parse(readFileSync(new URL('../scripts/bench/viewpoints.json', import.meta.url), 'utf8')).views;

function game(file, exact) {
  let t = 0, done = false;
  const BridgeHost = {
    Now: () => (t += 0.001), ReadFile: null, StorageGet: () => null, StorageSet() {}, StorageRemove() {},
    Geometry() {}, Material() {}, FaceKeys() {}, Cloth() {}, Create() {}, SetMesh() {}, Frame() {}, Look() {}, Screen() {}, ApplyMs: () => 0,
    Keys: () => '', Pad: () => null, MouseLook: () => null, Shot() {}, WriteText() {}, LastFrameCpuMs: () => 0, LastFrameGpuMs: () => 0, Exit() { done = true; },
    AudioRate: () => 0, AudioQueued: () => 0, Audio() {},
  };
  // (the same random numbers in both, from the start)
  let seed = 11;
  const M = Object.create(Math); M.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const { exports, readFile, ctx } = loadBundle(file, {}, { CS: { Memento: { Bridge: { BridgeHost } } }, setTimeout: undefined, setInterval: undefined, clearTimeout: undefined, clearInterval: undefined, __POSE_EXACT__: exact, Math: M });
  BridgeHost.ReadFile = readFile;
  return { exports, ctx, step(dt) { t = Math.floor(t / 16.667 + 1) * 16.667; exports.frame(dt); }, get done() { return done; } };
}

test('the people posed as before: every bone\'s world matrix the same, frame after frame', { timeout: 600000 }, async () => {
  const file = join(tmpdir(), `memento-pose-${process.pid}.js`);
  await bundle('unity', { out: [file] });
  const src = readFileSync(file, 'utf8').replace('S.game = game;', 'S.game = game; globalThis.__G = game;');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(file, src);
  const log = console.log, warn = console.warn, info = console.info;
  console.log = console.warn = console.info = () => {};
  try {
    const views = VIEWS.filter((v) => (v.world ?? 'desert') === 'desert' && v.name === 'camps');
    const args = JSON.stringify({ level: 'desert', views, settle: 1, talk: 'any', walk: 2, sound: false });
    // (POSE_REF: another bundle for the reference side, the game as it was: a one-off check against older code)
    let ref = file;
    if (process.env.POSE_REF) { ref = join(tmpdir(), `memento-pose-ref-${process.pid}.js`); writeFileSync(ref, readFileSync(process.env.POSE_REF, 'utf8').replace('S.game = game;', 'S.game = game; globalThis.__G = game;')); }
    const A = game(ref, true), B = game(file, false);
    A.exports.start(args); B.exports.start(args);
    for (let i = 0; i < 4000 && !(A.ctx.__G && B.ctx.__G); i++) { await new Promise((r) => setImmediate(r)); A.step(1 / 60); B.step(1 / 60); }
    assert.ok(A.ctx.__G && B.ctx.__G, 'both games ready');
    const bones = (G) => { const L = []; G.scene.traverse((o) => { if (o.isBone) L.push(o); }); return L; };
    let worst = 0, frames = 0, count = 0;
    for (let f = 0; f < 420 && !A.done; f++) {
      A.step(1 / 60); B.step(1 / 60);
      const a = bones(A.ctx.__G), b = bones(B.ctx.__G);
      assert.equal(a.length, b.length, `frame ${f}: the same skeletons`);
      for (let i = 0; i < a.length; i++) {
        const x = a[i].matrixWorld.elements, y = b[i].matrixWorld.elements;
        for (let k = 0; k < 16; k++) { const d = Math.abs(x[k] - y[k]); if (d > worst) worst = d; }
      }
      frames++; count = a.length;
    }
    console.log = log;
    assert.ok(frames > 300 && count > 500, `${frames} frames of ${count} bones`);
    assert.ok(worst < 1e-5, `the poses differ by ${worst}`);
  } finally { console.log = log; console.warn = warn; console.info = info; }
});
