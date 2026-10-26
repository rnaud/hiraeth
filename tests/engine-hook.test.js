// Issue #399: the grappling hook on a locked foe in the engines (Unity, Godot): engine/game.js wires the gadgets with the
// fight's foes as main.js does, so locked on (Tab) the use button (T; RT / R2 on a pad) throws the hook at the lock: a
// blot is yanked to the traveller and dazed, a furnace brute pinned where it stands. engine/game.js in a bare V8 context
// (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames, keys = {}, each = null) => quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); if (each?.() === true) return; } });
const tap = (g, code) => { run(g, 1, { [code]: true }); run(g, 1, { [code]: false }); };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

let built = null;
/** engine/game.js bundled once for the file's tests. */
const theBundle = () => (built ??= (async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-hook-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  return loadBundle(file);
})());

test('the engine throws the hook at the locked foe: a blot yanked in, a brute pinned (issue #399)', async () => {
  const B = await theBundle();
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

// Issue #432: inside a makers' house the hook takes no bare stone, in the engines as on the page: aimed at a wall of the
// Founders' Belfry the reticle is the grey cross ('nohold', BridgeHud.cs draws it), and thrown it glances off and nothing
// reels; the same aim out in the world takes.
test('the engine: a makers\' house\'s bare stone won\'t hold the hook, the world outside does (issue #432)', async () => {
  const B = await theBundle();
  let g;
  const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { g = await B.exports.createGame({ levelId: 'arzach2', backend }); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
  const rt = (g.level.temples ?? [g.level.temple]).find((t) => t?.id === 'arzach2');
  assert.ok(rt && g.gadgets, 'the Belfry and the gadgets');
  run(g, 10);
  B.exports.items.grant('hook');
  run(g, 2);
  assert.equal(g.gadgets.equipped, 'hook', 'in hand');
  const H = g.gadgets.inst.get('hook'), P = g.player, cam = g.camera;
  /** From where he stands, aim the camera at the nearest upright wall within reach; → the hook's trace. */
  const aimAtWall = () => {
    const hand = H.hand(P.pos.clone()), dir = hand.clone();
    let best = null;
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      dir.set(Math.sin(a), 0.15, Math.cos(a)).normalize();
      const hit = g.physics.rayHit(hand, dir, 20);
      if (hit && Math.abs(hit.normal.y) < 0.4 && hit.distance > 3 && (!best || hit.distance < best.distance)) best = { ...hit, dir: dir.clone() };
    }
    assert.ok(best, 'a wall in reach');
    cam.position.copy(hand).addScaledVector(best.dir, -1.5);
    cam.lookAt(best.point); cam.updateMatrixWorld();
    return H.trace();
  };
  // inside, on the house's floor
  P.teleport?.(rt.arrival.pos.clone(), P.frame.up.clone(), P.frame.fwd.clone()) ?? P.pos.copy(rt.arrival.pos);
  P.vel.set(0, 0, 0);
  run(g, 3);
  assert.ok(rt.inside(P.pos), 'in the house');
  const inside = aimAtWall();
  assert.equal(inside.slick, true, `a wall of the house: won't hold (${inside.kind})`);
  H.press(); H.update(1 / 30);
  assert.equal(g.screen().state.reticle?.kind, 'nohold', 'the grey cross, on the screen\'s state the bridge draws');
  const at = P.pos.clone();
  H.release();
  for (let k = 0; k < 30 && H.state === 'out'; k++) H.update(1 / 30);
  assert.equal(H.state, 'back', 'it glanced off');
  assert.ok(P.pos.distanceTo(at) < 0.3, 'nothing reeled him');
  // out in the world, by the door
  const out = rt.doorOut.clone();
  P.teleport?.(out, P.frame.up.clone(), P.frame.fwd.clone()) ?? P.pos.copy(out);
  run(g, 3);
  assert.ok(!rt.inside(P.pos), 'outside');
  const world = aimAtWall();
  if (world.kind === 'world') assert.equal(world.ok, true, 'the world\'s walls take it');
});
