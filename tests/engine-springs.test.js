// Issue #433: inside a makers' house the spring boots give only the tap's hop, in the engines as on the page: wound
// fully on the Founders' Belfry's floor and let go, the traveller goes no higher than a hop; the same full wind out in the
// world, by its door, throws him over 10 m up. engine/game.js in a bare V8 context (the bundle the engines run).
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

test('the engine: the spring boots hop inside a makers\' house and launch full outside (issue #433)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-springs-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = await loadBundle(file);
  let g;
  await (async () => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { g = await B.exports.createGame({ levelId: 'arzach2', backend }); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } })();
  const rt = (g.level.temples ?? [g.level.temple]).find((t) => t?.id === 'arzach2');
  assert.ok(rt && g.gadgets, 'the Founders\' Belfry and the gadgets');
  run(g, 10);
  B.exports.items.grant('springs');
  run(g, 2);
  assert.equal(g.gadgets.equipped, 'springs', 'worn');
  const P = g.player;
  /** Stand at `at`, wind fully (use held 1.2 s), let go: how high he went over where he stood. */
  const launch = (at) => {
    P.teleport?.(at.clone(), P.frame.up.clone(), P.frame.fwd.clone()) ?? P.pos.copy(at);
    P.vel.set(0, 0, 0);
    run(g, 40, {}, () => P.onGround && P.vel.length() < 0.1);
    assert.ok(P.onGround, 'on the ground');
    const y0 = P.pos.y;
    run(g, 36, { KeyT: true });
    let top = y0;
    run(g, 1, { KeyT: false });
    run(g, 150, {}, () => { top = Math.max(top, P.pos.y); return P.onGround && P.vel.y <= 0 && top > y0 + 0.5; });
    return top - y0;
  };
  const inside = launch(rt.arrival.pos);
  assert.ok(rt.inside(P.pos), 'in the house');
  assert.ok(inside > 1 && inside < 3, `a hop in the house: ${inside.toFixed(1)} m`);
  const outside = launch(rt.doorOut);
  assert.ok(!rt.inside(P.pos), 'outside');
  assert.ok(outside > 10, `the full launch out in the world: ${outside.toFixed(1)} m`);
});
