// Issue #264 (docs/plans/unity-default-portables.md D16): the onboarding and the skies the engines lacked, as main.js has
// them. The desert's first steps and Plumb's lines on the cue, the scout's find said with its distance, the sleeping
// observatory (its lens turned by E), the Lantern's light in the sky from the seventh world on, and the eclipse's sky.
// engine/game.js in a bare V8 context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { ORDER } from '../src/levels/names.js';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const menusStub = () => ({ shown: [], open: false, mode: null, show(m, p) { this.shown.push([m, p]); }, openShop() { return true; }, openStarMap() { return true; }, changed() {}, action() {}, navigate() {} });
const hushed = async (fn) => {
  const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
};
function run(g, frames, keys = {}, each = null) {
  const warn = console.warn; console.warn = () => {};
  try { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 20); if (each?.() === true) break; } } finally { console.warn = warn; }
}
const cueText = (g) => g.screen().state.cue?.text ?? '';

let B = null;
async function engine() {
  if (B) return B;
  const file = tempPath(join(tmpdir(), `hiraeth-engine-help-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  return (B = loadBundle(file).exports);
}

test('the desert in the engines: the first steps, the scout\'s find on the cue, the observatory', async () => {
  const E = await engine();
  const g = await hushed(() => E.createGame({ levelId: 'desert', backend, menus: menusStub() }));
  const gs = g.story.quests.game;
  gs.set('prologue.done', true);
  // Idle first-step bookkeeping remains compatible, but no unsolicited camera instruction appears.
  assert.ok(g.firstSteps, 'made in the desert before the backpack');
  g.ship.inside = false;
  const seen = [];
  run(g, 20 * 40, {}, () => { const t = cueText(g); if (t && seen.at(-1) !== t) seen.push(t); return /Look around/i.test(t); });
  assert.ok(!seen.some((t) => /Look around/i.test(t)), `no automatic camera advice: ${seen.join(' | ')}`);
  assert.ok(gs.flag('teach.look'));
  // the scout's ping: the find's line, the goal over the step and how far
  run(g, 20 * 6);
  g.scout.ping();
  let found = '';
  run(g, 20 * 4, {}, () => { const c = g.screen().state.cue; if (c?.kind === 'quest') { found = c.text; return true; } return false; });
  assert.match(found, /\d+\s*m|here|ahead|up|down/i, `the find's line: "${found}"`);
  // the sleeping observatory: Naji's sketch, the lens turned beside its dial
  assert.ok(g.expedition, 'the observatory quest made');
  // (met for real: the traveller set down beside Naji. A greeted flag set by hand is cleared by Naji's own update while
  // he is far off, src/npc.js, so whether the quest saw it came down to the order of the updates)
  const N = g.expedition.traveler, V0 = g.player.pos.constructor;
  g.player.teleport(N.pos.clone().add(new V0(1.5, 0.3, 0)), new V0(0, 1, 0), new V0(0, 0, 1));
  run(g, 20 * 20, {}, () => { N.greeted ||= 1; return !!g.expedition.state.started; });
  assert.ok(g.expedition.state.started, 'started once Naji has been met');
  const turns = g.expedition.state.turns.slice();
  const d = g.expedition.model.dials[0].getWorldPosition(g.player.pos.clone());
  g.player.pos.copy(d).y -= 1.2; g.player.pos.x += 1.5;
  g.expedition.update(0.05, g.player, { KeyE: false }, false);
  g.expedition.update(0.05, g.player, { KeyE: true }, false);
  assert.notDeepEqual(g.expedition.state.turns, turns, 'E beside a dial turns its lens');
});

test('the Lantern\'s light in the engine\'s sky from the seventh world on, and the eclipse\'s', async () => {
  const E = await engine();
  const g = await hushed(() => E.createGame({ levelId: 'perdide', backend }));
  const gs = g.story.quests.game;
  const lantern = () => g.fullLook().post.uLantern;
  assert.equal(lantern()?.[3] ?? 0, 0, 'none before six worlds');
  for (const id of ORDER.slice(0, 6)) gs.set(`world.${id}.done`, true);
  assert.ok(lantern()[3] >= 0.3, `in the sky after six: ${lantern()}`);
  assert.ok(lantern()[1] > 0.25, 'low over the skyline');
  const e = await hushed(() => E.createGame({ levelId: 'eclipse', backend }));
  e.sky.hour = 12; run(e, 2);
  const P = e.fullLook().post;
  assert.ok(P.uEclipse?.[1] > 0, `the eclipse's discs: ${P.uEclipse}`);
  assert.ok(P.uCorona?.length === 4 && P.uEclipseGlow?.length === 4);
});
