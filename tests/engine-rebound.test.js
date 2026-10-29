// Issue #774 in the engines (Unity, Godot): engine/game.js in a bare V8 context (the bundle the engines run). A cut into
// a fencer's raised shield rebounds the blade and the fencer answers at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames, keys = {}, each = null) => quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); if (each?.() === true) return i; } return null; });

let game = null;
async function engine() {
  if (game) return game;
  const file = tempPath(join(tmpdir(), `hiraeth-engine-rebound-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file);
  const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { game = await B.exports.createGame({ levelId: 'desert', backend, fight: true }); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
  return game;
}

test('the engine: a cut into a fencer\'s raised shield rebounds, and the fencer answers at once (issue #774)', async () => {
  const g = await engine();
  assert.ok(g.combat && g.foes?.on, 'the fight');
  run(g, 30);
  const [f] = g.foes.spawnKind('fencer', { n: 1, dist: 2.4 });
  g.foes.lock = f;
  // (its shield up, its own blow held off)
  run(g, 90, {}, () => { f.cool = Math.max(f.cool, 3); f.provoked = true; if (f.state !== 'chase' && f.state !== 'idle') f.state = 'chase'; return f.guardK >= 1; });
  assert.ok(f.guardK >= 1, `its shield up (${f.guardK})`);
  const B = g.tool.blade, hp = f.hp;
  run(g, 1, { KeyF: true }); run(g, 1, { KeyF: false });
  const t = run(g, 30, {}, () => B.reboundT > 0);
  assert.ok(t != null, 'the blade rebounded off the shield');
  assert.equal(f.hp, hp, 'no harm through it');
  assert.ok(!B.swinging, 'the swing stopped');
  run(g, 2);
  assert.equal(f.state, 'wind', 'it answers at once');
  assert.equal(f.atk?.id, 'bash', 'with its shield bash');
  g.foes.lock = null; quietly(() => { for (const x of g.foes.list) { x.hp = 0; x.state = 'dead'; } });
  run(g, 30);
});
