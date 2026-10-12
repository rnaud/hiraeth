// The people's rigs walked once a frame (issue #111: src/matrix-cache.js updateChain; animator.js, humanoid.js,
// player.js, npc.js, characters/tripo-walk.js: a joint's parents made for its read rather than the joint's whole subtree
// walked after it turns, and no walk again of what was just walked) give exactly what the walks from each root gave.
// Two copies of the Unity game in lockstep on the same clock and random numbers, one walking as before (__POSE_WALKS__),
// the other as now: every object's world matrix and every frame's command stream to Unity (BridgeHost.Frame: the
// transforms, the bones, the capes' and the overshirt's packets) compared, bit for bit, at the City-Shaft's crowd (the
// four nearest people as full rigs, the traveller standing with the shield's bracer on his hand), walking on, and at the
// desert's camps talking to someone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';

const WORLDS = JSON.parse(readFileSync(new URL('../scripts/bench/viewpoints-worlds.json', import.meta.url), 'utf8')).worlds;
const DESERT = JSON.parse(readFileSync(new URL('../scripts/bench/viewpoints.json', import.meta.url), 'utf8')).views;

function game(file, walks) {
  let t = 0, done = false;
  const G = { last: null };
  const BridgeHost = {
    Now: () => (t += 0.001), ReadFile: null, StorageGet: () => null, StorageSet() {}, StorageRemove() {},
    Geometry() {}, Material() {}, FaceKeys() {}, Cloth() {}, Create() {}, SetMesh() {}, Cape() {}, CapeState: () => null,
    Frame(buf) { G.last = new Uint32Array(buf.slice(0)); }, Look() {}, Screen() {}, ApplyMs: () => 0,
    Keys: () => '', Pad: () => null, MouseLook: () => null, Shot() {}, WriteText() {}, LastFrameCpuMs: () => 0, LastFrameGpuMs: () => 0, Exit() { done = true; },
    AudioRate: () => 0, AudioQueued: () => 0, Audio() {},
  };
  let seed = 11;
  const M = Object.create(Math); M.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const { exports, readFile, ctx } = loadBundle(file, {}, { CS: { Hiraeth: { Bridge: { BridgeHost } } }, setTimeout: undefined, setInterval: undefined, clearTimeout: undefined, clearInterval: undefined, __POSE_WALKS__: walks, Math: M });
  BridgeHost.ReadFile = readFile;
  return Object.assign(G, { exports, ctx, step(dt) { t = Math.floor(t / 16.667 + 1) * 16.667; exports.frame(dt); }, get done() { return done; } });
}

let file = null;
async function lockstep(args, frames) {
  if (!file) {
    file = join(tmpdir(), `hiraeth-pose-walks-${process.pid}.js`);
    await bundle('unity', { out: [file] });
    writeFileSync(file, readFileSync(file, 'utf8').replace('S.game = game;', 'S.game = game; globalThis.__G = game;'));
  }
  const log = console.log, warn = console.warn, info = console.info;
  console.log = console.warn = console.info = () => {};
  try {
    const A = game(file, true), B = game(file, false);
    A.exports.start(JSON.stringify(args)); B.exports.start(JSON.stringify(args));
    for (let i = 0; i < 6000 && !(A.ctx.__G && B.ctx.__G); i++) { await new Promise((r) => setImmediate(r)); A.step(1 / 60); B.step(1 / 60); }
    assert.ok(A.ctx.__G && B.ctx.__G, 'both games ready');
    const all = (G) => { const L = []; G.scene.traverse((o) => L.push(o)); return L; };
    let n = 0, objects = 0, bones = 0;
    for (let f = 0; f < frames && !A.done; f++) {
      A.step(1 / 60); B.step(1 / 60);
      assert.deepEqual(B.last, A.last, `frame ${f}: the same commands to Unity`);
      const a = all(A.ctx.__G), b = all(B.ctx.__G);
      assert.equal(a.length, b.length, `frame ${f}: the same scene`);
      for (let i = 0; i < a.length; i++) {
        const x = a[i].matrixWorld.elements, y = b[i].matrixWorld.elements;
        for (let k = 0; k < 16; k++) if (x[k] !== y[k]) assert.fail(`frame ${f}: ${a[i].name || a[i].type}'s world matrix differs (${x[k]} / ${y[k]})`);
      }
      n++; objects = a.length; bones = a.filter((o) => o.isBone).length;
    }
    return { n, objects, bones };
  } finally { console.log = log; console.warn = warn; console.info = info; }
}

test('the City-Shaft\'s crowd, standing and walking: every matrix and every command as with the walks', { timeout: 600000 }, async () => {
  const views = WORLDS.incal.views.filter((v) => v.name === 'crowd');
  const r = await lockstep({ level: 'incal', views, settle: 1, bench: 2, walk: 2, sound: false }, 300);
  assert.ok(r.n >= 300 && r.bones > 500, JSON.stringify(r));
});

test('the desert\'s camps, talking to someone: every matrix and every command as with the walks', { timeout: 600000 }, async () => {
  const views = DESERT.filter((v) => (v.world ?? 'desert') === 'desert' && v.name === 'camps');
  const r = await lockstep({ level: 'desert', views, settle: 1, talk: 'any', walk: 2, sound: false }, 300);
  assert.ok(r.n >= 300 && r.bones > 500, JSON.stringify(r));
});
