// Issue #436: inside a makers' house the wings glide steeper, in the engines as on the page: opened over the Founders'
// Belfry's floor they come down a metre for every HOUSE_GLIDE.ratio on (or steeper); opened out in the world by its door,
// the open world's glide (15 m/s on, 2.4 down). engine/game.js in a bare V8 context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { HOUSE_GLIDE } from '../src/player.js';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames, keys = {}, each = null) => quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); if (each?.() === true) return; } });

test('the engine: the wings glide steeper inside a makers\' house and as before outside (issue #436)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-wings-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = await loadBundle(file);
  let g;
  await (async () => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { g = await B.exports.createGame({ levelId: 'arzach2', backend }); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } })();
  const rt = (g.level.temples ?? [g.level.temple]).find((t) => t?.id === 'arzach2');
  assert.ok(rt, 'the Founders\' Belfry');
  run(g, 10);
  for (const id of ['backpack', 'doublejump', 'glider']) B.exports.items.grant(id);
  run(g, 2);
  const P = g.player;
  assert.ok(P.canGlide, 'the wings');
  assert.ok(P.houses?.includes(rt), 'the house knows him (its runtime connected)');
  /** Opened `up` m over `at`, held 0.5 s: { heavy, ratio } (m on for each metre down, at the end). */
  const glide = (at, up) => {
    P.teleport?.(at.clone().setY(at.y + up), P.frame.up.clone(), P.frame.fwd.clone()) ?? P.pos.copy(at).setY(at.y + up);
    P.vel.set(0, -1, 0); P.onGround = false;
    let heavy = false;
    run(g, 15, { Space: true }, () => { heavy ||= !!P.glideHeavy; return P.onGround || P.pos.y < at.y + 1.5; });   // (read before he lands)
    const out = { heavy, gliding: P.gliding, dy: P.pos.y - at.y, ground: P.onGround, ratio: Math.hypot(P.vel.x, P.vel.z) / Math.max(1e-3, -P.vel.y) };
    run(g, 1, { Space: false });
    return out;
  };
  const inside = glide(rt.arrival.pos, 8);
  assert.ok(inside.gliding && inside.heavy, `gliding in the house: the heavier glide (${JSON.stringify(inside)})`);
  assert.ok(inside.ratio <= HOUSE_GLIDE.ratio + 0.3, `steep in the house: ${inside.ratio.toFixed(2)} m on a metre down`);
  const outside = glide(rt.doorOut, 14);
  assert.ok(outside.gliding && !rt.inside(P.pos) && !outside.heavy, 'outside: the open world\'s glide');
  assert.ok(outside.ratio > 4, `outside, as before: ${outside.ratio.toFixed(2)} m on a metre down`);
});
