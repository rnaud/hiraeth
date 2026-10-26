// Issue #655 in the engines: a house whose ending is its guardian's trial (src/temples/trial-flow.js) plays its
// introduction at the special door in Unity as on the page: engine/game.js runs the same story, its moment on the ship's
// cinema (the screen's 'cine' letterbox), the guardian asleep through it and awake after it. engine/game.js in a bare V8
// context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { HELPER_OPENING } from '../src/temples/helper-cinematics.js';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const menusStub = () => ({ shown: [], open: false, mode: null, show(m, p) { this.shown.push([m, p]); }, openShop() { return true }, changed() {}, action() {}, navigate() {} });
const hushed = async (fn) => {
  const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
};

test('the engine plays a trial’s introduction at the special door, then wakes the guardian (issue #655)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-trial-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const g = await hushed(() => loadBundle(file).exports.createGame({ levelId: 'incal', backend, menus: menusStub() }));
  const rt = g.level.temples?.find((t) => t.id === 'incal') ?? g.level.temple;
  assert.ok(rt?.guardian && rt.holdWake, 'the Warden’s Well, its trial hooked to the story');
  const G = rt.guardian, scr = g.screen();
  await hushed(() => { for (let i = 0; i < 10; i++) g.frame(1 / 20); });
  // just inside the hall, on its door's side
  const door = rt.piece(rt.def.arenaDoor).group.getWorldPosition(G.arena.center.clone());
  const to = door.sub(G.arena.center).setY(0).normalize();
  const at = G.arena.center.clone().addScaledVector(to, G.arena.r - 2.5); at.y = G.arena.y + 0.3;
  g.player.teleport(at, g.player.frame.up.clone(), g.player.frame.fwd.clone());
  let bars = false, slept = true, t = 0, played = false;
  await hushed(() => {
    for (; t < 1; t += 1 / 20) g.frame(1 / 20);
    played = g.story.moments.current?.id === 'temple.incal.trial.opening';
    for (; t < HELPER_OPENING.context + HELPER_OPENING.guide + 3 && g.story.moments.playing; t += 1 / 20) {
      g.frame(1 / 20);
      bars ||= !!scr.state.cine?.bars;
      if (g.story.moments.playing && G.state !== 'sleep') slept = false;
    }
    for (let i = 0; i < 10; i++) g.frame(1 / 20);
  });
  assert.ok(played, 'the introduction plays at the crossing');
  assert.ok(bars, 'in the letterbox (the screen’s cine)');
  assert.ok(slept, 'the guardian sleeps through it');
  assert.ok(['wake', 'fight'].includes(G.state), `and wakes after it (${G.state})`);
  assert.equal(rt.logic.isOpen(rt.def.arenaDoor), false, 'its door shut behind');
  assert.ok(!g.story.quests.game.flag('temple.incal.done'), 'nothing completed');
});
