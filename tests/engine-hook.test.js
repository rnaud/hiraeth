// Issue #399: the grappling hook on a locked foe in the engines (Unity, Godot): engine/game.js wires the gadgets with the
// fight's foes as main.js does, so locked on (Tab) the use button (T; RT / R2 on a pad) throws the hook at the lock: a
// blot is yanked to the traveller and dazed, a furnace brute pinned where it stands. engine/game.js in a bare V8 context
// (the bundle the engines run).
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
const run = (g, frames, keys = {}, each = null) => quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); if (each?.() === true) return; } });
const tap = (g, code) => { run(g, 1, { [code]: true }); run(g, 1, { [code]: false }); };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('the engine throws the hook at the locked foe: a blot yanked in, a brute pinned (issue #399)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-hook-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file);
  const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {};
  let g;
  try { g = await B.exports.createGame({ levelId: 'desert', backend, fight: true }); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
  assert.ok(g.combat && g.foes?.on && g.gadgets, 'the fight and the gadgets');
  run(g, 30);
  B.exports.items.grant('hook');
  run(g, 2);
  assert.equal(g.gadgets.equipped, 'hook', 'in hand');
  const H = g.gadgets.inst.get('hook');

  const [blot] = g.foes.spawnKind('blot', { n: 1, dist: 7 });
  run(g, 3);
  tap(g, 'Tab'); run(g, 3);
  assert.equal(g.foes.lock, blot, 'locked on');
  const was = flat(blot.pos, g.player.pos);
  let yanked = false;
  tap(g, 'KeyT');
  run(g, 120, {}, () => { yanked ||= !!blot.yank; return yanked && !blot.yank; });
  assert.ok(yanked, 'yanked');
  const now = flat(blot.pos, g.player.pos);
  assert.ok(now < 2.6 && now < was - 2, `to him: ${was.toFixed(1)} → ${now.toFixed(1)} m`);
  assert.ok(blot.stunned > 0, 'dazed');

  // the cooldown run out, a brute: pinned
  run(g, 1, {}, () => { H.foeCool = 0; });
  blot.hp = 0; blot.state = 'dead';
  const [brute] = g.foes.spawnKind('brute', { n: 1, dist: 8 });
  run(g, 3);
  g.foes.lock = brute; run(g, 2);
  const at = brute.pos.clone();
  let pinned = false, moved = 0;
  tap(g, 'KeyT');
  run(g, 90, {}, () => { if (brute.pin) { pinned = true; moved = Math.max(moved, flat(brute.pos, at)); } return pinned && !brute.pin; });
  assert.ok(pinned, 'pinned');
  assert.ok(moved < 0.5, `held where it stood (${moved.toFixed(2)} m)`);
});
