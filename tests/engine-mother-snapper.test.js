// Issue #373 in the engines (#264: the Unity and Godot versions run engine/game.js, the temples' own guardians and
// the fluid tool as the page does): the Mother Snapper in Lorn's Hush-House, the traveller 12 m off her, in the middle of
// her hall. In her second phase, as she rears to snap, her head looms within the push's reach of him and the tool's own
// push (FluidTool.push, its cone) answers it: she reels open; the cold in her open mouth then calms her, the glob is
// not dull and the screen's guardian bar (BridgeHud.cs draws it) goes down; a glob on her leaves takes nothing and is
// dull. Before, from there her head reared 9 m off and the push never reached it. engine/game.js in a bare V8 context.
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

test('the engine’s Mother Snapper: from the middle of her hall her head looms within the push as she rears to snap, the tool’s push opens her, the cold in her mouth calms her and the bar shows it (issue #373)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-snapper-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const g = await hushed(() => loadBundle(file).exports.createGame({ levelId: 'perdide', backend, fight: true }));
  const S = g.screen();
  run(g, 10);
  const T = (g.level.temples ?? []).find((t) => t.def?.id === 'perdide' && t.guardian);
  assert.ok(T, 'the Hush-House and its Mother');
  const G = T.guardian, m = G.model, P = g.player, V = m.pos.constructor;
  const f = new V(Math.sin(m.heading), 0, Math.cos(m.heading)), spot = m.pos.clone().addScaledVector(f, 12).setY(G.arena.y + 0.3);
  const stand = () => { P.teleport(spot, new V(0, 1, 0), f.clone().negate()); P.vel?.set(0, 0, 0); };
  stand();
  P.opts.health = false;
  assert.ok(run(g, 300, () => { stand(); return G.state === 'fight'; }), `she wakes and fights (${G.state})`);
  // her second phase, as yet unanswered: it asks for the push as she rears to snap
  G.meter = G.floor = G.def.phases[0].to; G.answered?.clear(); G.stop(); G.cool = 0.5;
  assert.ok(G.asking && G.phase.asks.verb === 'push');
  assert.ok(run(g, 30 * 40, () => { stand(); return G.attack && G.phase.asks.moves.includes(G.attack.id) && !G.struck && G.at > 0.6; }), 'she rears to snap');
  const chest = P.pos.clone().add(new V(0, 1.15, 0)), reach = chest.distanceTo(m.mouth) - (m.mouthR ?? 1.2);
  assert.ok(reach < 6, `her head within the push's 6 m (${reach.toFixed(1)} m past her jaws' edge)`);
  // the tool's push, aimed at her head
  const t = g.tool;
  assert.ok(t?.push, 'the tool');
  t.aimDir.copy(m.mouth).sub(chest).normalize(); t.camK = 1;
  const hits = t.push();
  assert.ok(hits.length > 0 && !G.asking && G.state === 'open', `the push meets her head and she reels open (${hits.length} hit, ${G.state})`);
  run(g, 3);
  const fill0 = S.state.guardian?.fill;
  assert.ok(fill0 > 0, JSON.stringify(S.state.guardian));
  const m0 = G.meter, info = {};
  G.landed('mouth', 'stun', null, info);
  assert.ok(G.meter > m0 && !info.dull, `the cold in her open mouth calms her, a bright splash (${m0} → ${G.meter})`);
  run(g, 3);
  assert.ok(S.state.guardian.fill < fill0 - 0.1, `the bar goes down (${fill0} → ${S.state.guardian.fill})`);
  run(g, 10, () => !G.attack);
  const leaves = {}, m1 = G.meter;
  if (!G.attack) { G.landed('body', 'stun', null, leaves); assert.ok(leaves.dull && G.meter === m1, 'a glob on her leaves between moves takes nothing, dull'); }
});
