// Issue #375 in the engines: a save loaded inside a temple past a gadget gate without its gadget is never stranded
// (src/temples/runtime.js unstrand; engine/game.js marks the load as main.js does). In the engine bundle the Unity version
// runs (engine/game.js in a bare V8 context): a save standing past the Warden's Well's Vane Room chasm without the bridge
// pen wakes on the near side, at a glyph stone; one that had found the pen keeps it and its place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './register-gadgets.js';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames) => quietly(() => { for (let i = 0; i < frames; i++) g.frame(1 / 20); });
const FLAGS = { 'prologue.done': true, 'item.backpack': true, 'item.gun': true, 'item.glider': true, 'items.v': 2, 'temple.incal.entered': true };

test('a save past the Vane Room’s chasm without the pen wakes on the near side, in the engine bundle; with the pen found, keeps it and its place', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-unstrand-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file, { pads: () => [] });
  const make = (flags, pos) => quietly(() => B.exports.createGame({ levelId: 'incal', backend, flags: { ...FLAGS, ...flags }, start: pos && { level: 'incal', pos } }));
  // where the far side's key stands (the Vane Room's chasm between), from a first look at the house
  const g0 = await make({}, null);
  const rt0 = (g0.level.temples ?? [g0.level.temple]).find((t) => t?.id === 'incal');
  assert.ok(rt0, 'the Warden’s Well is built');
  const far = rt0.piece('kG').pos.clone();   // (the great key since issue #413)
  far.x += 0.8;   // (beside the key's chest, not in it)
  const farRoom = rt0.roomNear(far);
  assert.equal(farRoom, 'vaneFar', 'that spot is past the chasm');
  g0.dispose?.();

  const g = await make({}, far.toArray());
  const P = g.player, rt = (g.level.temples ?? [g.level.temple]).find((t) => t?.id === 'incal');
  assert.ok(P.pos.distanceTo(far) < 1.5, 'the save puts him where it left him');
  await run(g, 4);
  assert.equal(rt.items.has('bridge'), false, 'no pen given: it was never found');
  const now = rt.roomNear(P.pos);
  assert.notEqual(now, 'vaneFar', `moved off the far side (${now})`);
  assert.ok(rt.marks.some((m) => m.spot.distanceTo(P.pos) < 0.8), 'at a glyph stone');
  g.dispose?.();

  // the pen found before (its chest opened): his own, and he stays
  const h = await make({ 'temple.incal.found.pen': true, 'temple.incal.lit.arW': true, 'box.incal.bridge': true }, far.toArray());
  await run(h, 4);
  const rh = (h.level.temples ?? [h.level.temple]).find((t) => t?.id === 'incal');
  assert.ok(h.player.pos.distanceTo(far) < 1.5, 'left where he stood');
  assert.equal(rh.items.has('bridge'), true, 'the pen is his');
  h.dispose?.();
});
