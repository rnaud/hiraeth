// The Mother Snapper in the engines (#264: the Unity and Godot versions run engine/game.js, the temples' own guardians
// and pieces as the page does), outwitted since v1.83 (issue #409; her fight before, issue #373): in Lorn's Hush-House,
// the traveller by her hall's door, out of her hearing: she strikes at the jangling pendulums; frosted, they fall
// silent and the screen's guardian bar (BridgeHud.cs draws it) goes down; her root's crystal is covered by her head
// till a flat note turns it away; the lullaby rung low to high leaves her weary. engine/game.js in a bare V8 context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const hushed = async (fn) => {
  const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
};
const run = (g, frames, each = null) => { const w = console.warn; console.warn = () => {}; try { for (let i = 0; i < frames; i++) { g.frame(1 / 30); if (each?.()) return true; } } finally { console.warn = w; } return false; };

test('the engine’s Mother Snapper, outwitted: she strikes at the jangling pendulums, frosted they fall silent and the bar goes down, her root’s crystal covered by her head till a flat note turns it away, the lullaby sung low to high, weary (issue #409)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-snapper-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const g = await hushed(() => loadBundle(file).exports.createGame({ levelId: 'perdide', backend, fight: true }));
  const S = g.screen();
  run(g, 10);
  const T = (g.level.temples ?? []).find((t) => t.def?.id === 'perdide' && t.guardian);
  assert.ok(T, 'the Hush-House and its Mother');
  const G = T.guardian, m = G.model, P = g.player, V = m.pos.constructor, C = T.motherCrystals;
  // (by her hall's door, inside it: out of her hearing)
  const spot = G.arena.center.clone().add(new V(-G.arena.r + 3, 0.3, 0));
  const stand = () => { P.teleport(spot, new V(0, 1, 0), new V(1, 0, 0)); P.vel?.set(0, 0, 0); };
  stand();
  P.opts.health = false;
  assert.ok(run(g, 300, () => { stand(); return G.state === 'fight'; }), `she wakes and listens (${G.state})`);
  assert.ok(run(g, 30 * 15, () => { stand(); return G.attack && G.heardWhy === 'jangle'; }), 'she strikes at a jangling pendulum');
  run(g, 3);
  const fill0 = S.state.guardian?.fill;
  assert.ok(fill0 > 0.95, JSON.stringify(S.state.guardian));
  for (const s of C.swings) s.hit('stun');
  assert.ok(C.swings.every((s) => s.frost), 'frosted silent');
  assert.ok(run(g, 30 * 10, () => { stand(); return G.phaseIndex === 1 && G.state === 'fight'; }), 'hushed');
  run(g, 3);
  assert.ok(S.state.guardian.fill < fill0 - 0.3, `the bar goes down (${fill0} → ${S.state.guardian.fill})`);
  const off = () => Math.hypot(m.mouth.x - C.root.center.x, m.mouth.z - C.root.center.z) > C.cover;
  run(g, 30 * 3, () => { stand(); return false; });
  assert.ok(!off(), 'her head over her root');
  C.root.hit('shoot');
  assert.equal(C.root.taken, false, 'covered');
  C.notes[3].hit('shoot');
  assert.equal(G.heardWhy, 'flat', 'a flat note: she strikes at it');
  assert.ok(run(g, 30 * 8, () => { stand(); return !G.attack && off(); }), 'her head off her root');
  for (const n of C.notes) n.hit('shoot');
  assert.ok(C.notes.every((n) => n.taken), 'the lullaby rings true');
  assert.ok(run(g, 30 * 4, () => { stand(); return G.state === 'weary'; }), `weary (${G.meter.toFixed(2)})`);
});
