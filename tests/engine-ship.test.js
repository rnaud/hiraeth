// Issue #264: the ship in the engines (engine/game.js attaches it as main.js does when the engine is played with its
// menus): a new save's opening (the prologue) plays, its letterbox, fades and subtitles as the screen's 'cine' and 'sub'
// (src/platform.js; BridgeHud.cs draws them), E at the console in its walk plays the father's message, and holding the
// skip ends it on the desert at the foot of the ramp; walking up the ramp takes you aboard, E at the holo table without
// power says so, E at the console with nothing waiting says "No new messages."; arriving by ship plays the arrival.
// engine/game.js in a bare V8 context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

// a backend that takes every op and keeps nothing (its flags and hooks left unset)
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then']);
const photos = [];
const backend = new Proxy({}, { get: (t, k) => (k === 'photo' ? (n) => photos.push(n) : UNSET.has(k) ? undefined : () => {}) });
const menusStub = () => { const shown = []; return { shown, open: false, mode: null, show(m, p) { shown.push([m, p]); }, changed() {}, action() {}, navigate() {} }; };

async function makeGame(file, o) {
  const warn = console.warn, info = console.info, log = console.log, error = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { return await loadBundle(file).exports.createGame({ levelId: 'desert', backend, ...o }); } finally { console.warn = warn; console.info = info; console.log = log; console.error = error; }
}
function run(g, frames, keys = {}, each = null) {
  const warn = console.warn; console.warn = () => {};
  try { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 20); each?.(); } } finally { console.warn = warn; }
}

test('the engine plays the ship: the opening on a new save, aboard by the ramp, the console and the table, the arrival (issue #264)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-ship-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });

  // the opening: in the ship in orbit, the letterbox down and the eyes shut, the ship's good morning
  const g = await makeGame(file, { menus: menusStub(), prologue: true });
  const scr = g.screen();
  assert.ok(g.shipScenes && g.ship.playing && g.ship.cinematic.stage === 'black', 'the prologue starts');
  assert.ok(g.player.pos.y > 1000, 'in the ship in orbit');
  assert.ok(scr.state.cine?.bars && scr.state.cine?.lids && scr.state.cine?.hud === false, JSON.stringify(scr.state.cine));
  const subs = new Set();
  run(g, 20 * 12, {}, () => { if (scr.state.sub) subs.add(`${scr.state.sub.who}: ${scr.state.sub.text}`); });
  assert.equal(g.ship.cinematic.stage, 'walk');
  assert.ok([...subs].some((s) => /^SHIP: Good morning/.test(s)), [...subs].join(' | '));
  assert.equal(g.save(), undefined);
  // the walk is his: at the console E plays the message (the cue says so; the scene's walk shows the cue)
  const m = g.ship.modelOf(g.player.pos);
  g.player.pos.copy(g.ship.world(m, m.interior.points.cockpit));
  run(g, 6);
  assert.match(g.ship.hud(), /^E /, 'E at the console');
  assert.ok(scr.state.cine?.walk, 'the cue shown through the scene');
  assert.equal(scr.state.cue?.kind, '', JSON.stringify(scr.state.cue));
  run(g, 2, { KeyE: true }); run(g, 2, { KeyE: false });
  assert.equal(g.ship.cinematic.stage, 'call');
  run(g, 20 * 8, {}, () => { if (scr.state.sub) subs.add(`${scr.state.sub.who}: ${scr.state.sub.text}`); });
  assert.ok([...subs].some((s) => /^FATHER: /.test(s) || /^: Is it on/.test(s) || /There you are/.test(s)), [...subs].join(' | '));
  // held, the skip ends it: down on the desert by the ramp, out of the ship, the screen's scene pieces gone
  run(g, 30, { Escape: true }); run(g, 20 * 4, { Escape: false });
  assert.ok(g.ship.prologue.done && !g.ship.playing, 'the opening over');
  assert.ok(g.player.pos.y < 100 && !g.ship.inside, `on the ground (${g.player.pos.y.toFixed(1)})`);
  assert.equal(scr.state.cine, null);

  // the ship as it stands: up the ramp and in; the table without power, the console with nothing waiting
  const h = await makeGame(file, { menus: menusStub() });
  const S = h.screen();
  assert.ok(h.shipScenes && !h.ship.playing);
  const a = h.ship.arrivalSpot();
  h.player.respawn(a.pos.clone()); h.player.heading = a.heading + Math.PI; h.rig.yaw = a.heading;
  run(h, 4); run(h, 40, { KeyW: true }); run(h, 20 * 8, { KeyW: false });
  assert.ok(h.ship.inside, 'aboard by walking up the ramp');
  const P = h.ship.parked.interior.points;
  h.player.pos.copy(h.ship.world(h.ship.parked, P.table)); run(h, 4);
  assert.match(h.ship.hud(), /no power/);
  run(h, 2, { KeyE: true }); run(h, 2, { KeyE: false });
  assert.ok(/^No power/.test(S.state.sub?.text ?? '') && S.state.sub.who === 'SHIP', JSON.stringify(S.state.sub));
  h.player.pos.copy(h.ship.world(h.ship.parked, P.cockpit)); run(h, 4);
  run(h, 2, { KeyE: true }); run(h, 2, { KeyE: false });
  assert.equal(S.state.sub?.text, 'No new messages.');

  // photo mode (the Start menu's, P): the world held, the camera flown, the HUD gone but for its keys; Enter saves the frame
  run(h, 20 * 4);
  h.key('KeyP', true); h.key('KeyP', false);
  assert.ok(h.photoOn && /fly/.test(S.state.photo?.hint ?? ''), JSON.stringify(S.state.photo));
  assert.equal(S.state.cue, null);
  const eye = h.camera.position.clone(), at = h.player.pos.clone();
  run(h, 10, { KeyW: true }); run(h, 1, { KeyW: false });
  assert.ok(h.camera.position.distanceTo(eye) > 3, 'the camera flown');
  assert.ok(h.player.pos.distanceTo(at) < 0.01, 'the traveller left where he stood');
  h.key('Enter', true); h.key('Enter', false);
  run(h, 1); assert.equal(S.state.photo?.hint, '', 'its keys off the picture');
  run(h, 4);
  assert.equal(photos.length, 1);
  assert.match(photos[0], /^hiraeth-desert-.*\.png$/);
  assert.match(S.state.photo?.hint ?? '', /^Photo saved/);
  h.key('Escape', true); h.key('Escape', false);
  assert.ok(!h.photoOn && S.state.photo === null, 'Esc leaves it');

  // arriving by ship (the engine started again after a flight): the arrival plays, and ends at the foot of the ramp
  const k = await makeGame(file, { menus: menusStub(), via: 'ship', arrive: true });
  assert.equal(k.ship.cinematic?.constructor?.name, 'ArrivalDirector');
  run(k, 20 * 40);
  assert.ok(!k.ship.playing && !k.ship.inside, 'the arrival over, outside');

  // a bench's plan (no menus) is as before: no ship scenes
  const b = await makeGame(file, {});
  assert.ok(!b.shipScenes && !b.ship.playing);
});
