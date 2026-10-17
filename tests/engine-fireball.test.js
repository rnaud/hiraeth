// Issue #398: the ember wisp's exchange in the engines (Unity, Godot): engine/game.js in a bare V8 context (the bundle the
// engines run). Locked on, the wisp winds up and throws its fireball; the blade (F) pressed as the ball comes in sends it
// back, and the wisp, hit by its own fire, is stunned and drops low.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames, keys = {}, each = null) => quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); if (each?.() === true) return i; } return null; });
const tap = (g, code) => { run(g, 1, { [code]: true }); run(g, 1, { [code]: false }); };

test('the engine plays an exchange with the ember wisp: thrown, cut back, stunned low (issue #398)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-fireball-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file);
  let g;
  const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { g = await B.exports.createGame({ levelId: 'desert', backend, fight: true }); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
  assert.ok(g.combat && g.foes?.on, 'the fight');
  run(g, 30);
  const [f] = g.foes.spawnKind('wisp', { n: 1, dist: 9 });
  run(g, 3);
  g.foes.lock = f; run(g, 2);
  const hp = f.hp;
  // its throw
  const t = run(g, 200, {}, () => g.foes.balls.length > 0);
  assert.ok(t != null, 'it threw');
  const b = g.foes.balls[0];
  assert.ok(b.mesh?.parent, 'the ball is drawn');
  // the blade pressed as it comes in (its cut lands about 0.3 s after the press)
  run(g, 120, {}, () => b.state !== 'out' || b.pos.distanceTo(g.player.pos.clone().setY(g.player.pos.y + 1.1)) < 3.3);
  tap(g, 'KeyF');
  run(g, 40, {}, () => b.state !== 'out');
  assert.equal(b.state === 'gone' ? b.why : b.state, b.state === 'gone' ? 'struck' : 'back', `sent back (${b.state} ${b.why ?? ''})`);
  run(g, 60, {}, () => b.state === 'gone');
  assert.equal(b.why, 'struck', 'into the wisp');
  assert.ok(f.hp < hp && f.stunned > 2, `hurt and stunned (hp ${f.hp}, ${f.stunned.toFixed(1)} s)`);
  run(g, 30);
  assert.ok(f.chest.y - g.player.pos.y < 2, `down within reach (${(f.chest.y - g.player.pos.y).toFixed(2)} m)`);
});
