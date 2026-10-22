// Issue #264: the ship in the engines (engine/game.js attaches it as main.js does when the engine is played with its
// menus): a new save's opening (the prologue) plays, its letterbox, fades and subtitles as the screen's 'cine' and 'sub'
// (src/platform.js; BridgeHud.cs draws them), E at the console in its walk plays the father's message, and holding the
// skip ends it on the desert at the foot of the ramp; walking up the ramp takes you aboard, E at the holo table without
// power says so, E at the console with nothing waiting says "No new messages."; arriving by ship plays the arrival.
// engine/game.js in a bare V8 context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

// a backend that takes every op and keeps nothing (its flags and hooks left unset)
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then']);
const photos = [];
const backend = new Proxy({}, { get: (t, k) => (k === 'photo' ? (n) => photos.push(n) : UNSET.has(k) ? undefined : () => {}) });
const menusStub = () => { const shown = [], shops = []; return { shown, shops, open: false, mode: null, show(m, p) { shown.push([m, p]); }, openShop(panel, e) { shops.push(e); return true; }, changed() {}, action() {}, navigate() {} }; };

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

  // the opening: in the ship in orbit, the letterbox down and the eyes shut, Plumb's good morning
  const g = await makeGame(file, { menus: menusStub(), prologue: true });
  const scr = g.screen();
  assert.ok(g.shipScenes && g.ship.playing && g.ship.cinematic.stage === 'black', 'the prologue starts');
  assert.ok(g.player.pos.y > 1000, 'in the ship in orbit');
  assert.ok(scr.state.cine?.bars && scr.state.cine?.lids && scr.state.cine?.hud === false, JSON.stringify(scr.state.cine));
  const subs = new Set();
  run(g, 20 * 12, {}, () => { if (scr.state.sub) subs.add(`${scr.state.sub.who}: ${scr.state.sub.text}`); });
  assert.equal(g.ship.cinematic.stage, 'walk');
  assert.ok([...subs].some((s) => /^PLUMB: Good morning/.test(s)), [...subs].join(' | '));
  assert.equal(g.save(), undefined);
  // the walk is his: at the console E plays the message (its prompt floats by the voicemail button, issue #350: it was the cue at the top)
  const m = g.ship.modelOf(g.player.pos);
  g.player.pos.copy(g.ship.world(m, m.interior.points.cockpit));
  run(g, 6);
  assert.match(g.ship.hud(), /^E /, 'E at the console');
  assert.ok(scr.state.cine?.walk, 'the cue shown through the scene');
  assert.equal(scr.state.prompt?.text, 'voicemail', JSON.stringify(scr.state.prompt));
  assert.ok(new THREE.Vector3(...scr.state.prompt.at).distanceTo(g.ship.world(m, m.interior.points.voicemail)) < 0.5, 'over the button');
  assert.ok(!scr.state.cue?.text, `not the cue at the top (${JSON.stringify(scr.state.cue)})`);
  run(g, 2, { KeyE: true }); run(g, 2, { KeyE: false });
  assert.equal(g.ship.cinematic.stage, 'call');
  run(g, 20 * 8, {}, () => { if (scr.state.sub) subs.add(`${scr.state.sub.who}: ${scr.state.sub.text}`); });
  assert.ok([...subs].some((s) => /^FATHER: /.test(s) || /^: Is it on/.test(s) || /There you are/.test(s)), [...subs].join(' | '));
  // held, the skip ends it: down on the desert by the ramp, out of the ship, the screen's scene pieces gone
  run(g, 30, { Escape: true }); run(g, 20 * 4, { Escape: false });
  assert.ok(g.ship.prologue.done && !g.ship.playing, 'the opening over');
  assert.ok(g.player.pos.y < 100 && !g.ship.inside, `on the ground (${g.player.pos.y.toFixed(1)})`);
  assert.equal(scr.state.cine, null);
  // the first step out's drift into the rig's framing over, the camera his again: it follows him as he walks off
  // (the reveal's last shot was left as the ship's camera, which held the view still for good: seen on the Retroid)
  run(g, 20 * 5);
  assert.equal(g.ship.cam, null, 'no shot left over the rig');
  const before = g.camera.position.clone();
  run(g, 30, { KeyW: true }); run(g, 2, { KeyW: false });
  assert.ok(g.camera.position.distanceTo(before) > 1, 'the camera follows him');

  // the ship as it stands: up the ramp and in; the table without power, the console with nothing waiting
  const hm = menusStub(), travelled = [];
  const h = await makeGame(file, { menus: hm, onTravel: (to) => travelled.push(to) });
  // Anselm's shop asked for (his "Show me what you have", or -shop thrum): the menus' sheet opened on his wares
  assert.ok(h.openShop('thrum'));
  run(h, 2);
  assert.equal(hm.shops[0]?.kind, 'fragments', JSON.stringify(hm.shops[0]?.shop));
  assert.ok(hm.shops[0].logic.view().length >= 5, 'his upgrades');
  const S = h.screen();
  assert.ok(h.shipScenes && !h.ship.playing);
  const a = h.ship.arrivalSpot();
  h.player.respawn(a.pos.clone()); h.player.heading = a.heading + Math.PI; h.rig.yaw = a.heading;
  run(h, 4); run(h, 40, { KeyW: true }); run(h, 20 * 8, { KeyW: false });
  assert.ok(h.ship.inside, 'aboard by walking up the ramp');
  // no weather aboard (issue #348: the rain fell in its rooms in Lorn in the Unity preview, the ship never registered
  // as indoors in the engines): a downpour and a sandstorm outside, none of it drawn in here, no wisp of sand in its rooms
  h.weather.mode = 'rain'; run(h, 20 * 3);
  assert.ok(h.shelter.indoor > 0.99, `indoors (${h.shelter.indoor})`);
  assert.ok(h.post.uniforms.uRain.value < 0.01, `no rain drawn aboard (${h.post.uniforms.uRain.value})`);
  h.weather.mode = 'storm'; run(h, 20 * 3);
  assert.ok(h.post.uniforms.uStorm.value < 0.01, `no sandstorm drawn aboard (${h.post.uniforms.uStorm.value})`);
  h.weather.mode = 'auto';
  const P = h.ship.parked.interior.points;
  h.player.pos.copy(h.ship.world(h.ship.parked, P.table)); run(h, 4);
  assert.match(h.ship.hud(), /no power/);
  run(h, 2, { KeyE: true }); run(h, 2, { KeyE: false });
  assert.ok(/^No power/.test(S.state.sub?.text ?? '') && S.state.sub.who === 'PLUMB', JSON.stringify(S.state.sub));
  h.player.pos.copy(h.ship.world(h.ship.parked, P.cockpit)); run(h, 4);
  run(h, 2, { KeyE: true }); run(h, 2, { KeyE: false });
  assert.match(S.state.sub?.text ?? '', /^No power/, 'the next interaction does not replace an unread status');
  let heardConsole = false;
  run(h, 20 * 8, {}, () => { heardConsole ||= S.state.sub?.who === 'PLUMB' && S.state.sub?.text === 'No new messages.'; });
  assert.ok(heardConsole, 'Plumb answers the console after the first status has been read');
  // the rooms as the web's ?aboard= puts him in them (the bridge's -aboard photographs each): in that room, the ship's
  // inside, no room of another name
  for (const room of ['cockpit', 'main', 'cabin', 'hold']) {
    assert.ok(h.goAboard(room), room);
    run(h, 3);
    assert.ok(h.ship.inside, `${room}: aboard`);
    assert.ok(h.player.pos.distanceTo(h.ship.roomSpot(room).pos) < 0.5, `${room}: where ?aboard= puts him`);
  }
  assert.equal(h.goAboard('attic'), false);
  // the console's round screen and the wall pictures drawn as the web's (engine/raster.js: the page's canvases draw in the
  // engines), each a texture the backend sends; the screen redrawn ten times a second (src/ship/portrait.js CallScreen.fps)
  const cs = h.ship.parked.callScreen;
  assert.ok(cs?.texture && cs.canvas.width === 256, 'the screen a canvas texture, 256 px in the engines');
  const v0 = cs.texture.version;
  run(h, 9);
  assert.ok(cs.texture.version - v0 >= 2 && cs.texture.version - v0 <= 5, `redrawn ~10 times a second: ${cs.texture.version - v0} in 0.3 s`);
  const pictures = [];
  h.ship.parked.group.traverse((o) => { const t = o.material?.uniforms?.uHasMap?.value > 0.5 ? o.material.uniforms.uMap.value : null; if (t?.image?.data && t !== cs.texture) pictures.push(t.image); });
  const inked = (img) => { let n = 0; for (let i = 0; i < img.data.length; i += 4) if (img.data[i] < 90) n++; return n; };
  assert.ok(pictures.length >= 4 && pictures.every((p) => inked(p) > 100), `the wall pictures drawn: ${pictures.map(inked).join(', ')}`);
  run(h, 20 * 2);

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

  // a fragment of the singing light walked into (src/fragments.js, the Unity-default plan's D3): found and saved; the Worlds
  // page counts it
  const fr = h.fragments.list.find((f) => !f.found);
  assert.ok(fr, 'the desert\'s fragments placed');
  h.player.respawn(fr.pos.clone().setY(fr.pos.y - 0.9)); run(h, 6);
  assert.ok(fr.found && h.story.quests.game.flag(`frag.desert.${fr.i}`), 'taken');
  assert.ok(h.menuSources().worlds().fragmentsAll?.found >= 1, 'counted on the Worlds page');

  // the take-off (the Worlds page's Travel here, with power and the desert's core gadgets): its warp is the screen's
  // 'warp', the next world's name on it (BridgeHud.cs DrawWarp keeps it through the restart), then the engine starts
  // again there (onTravel); the page's canvas drew it alone before
  const gs = h.story.quests.game;
  gs.set('ship.powered', true);
  for (const id of ['backpack', 'doublejump', 'gun', 'sword', 'shield']) gs.set(`item.${id}`, true);
  h.player.pos.copy(h.ship.world(h.ship.parked, P.table)); run(h, 4);
  assert.equal(S.state.warp, null);
  h.ship.travel('arzach');
  assert.ok(h.ship.playing, 'the take-off plays');
  let warpAt = -1;
  for (let i = 0; i < 20 * 14 && !travelled.length; i++) { run(h, 1); if (warpAt < 0 && S.state.warp) warpAt = i; }
  assert.ok(warpAt > 0, 'the warp shown');
  assert.equal(S.state.warp.title, 'Vael', JSON.stringify(S.state.warp));
  assert.ok(Number.isInteger(S.state.warp.id));
  assert.deepEqual(travelled, ['arzach'], 'then the engine goes on to the next world');

  // arriving by ship (the engine started again after a flight): the arrival plays, and ends at the foot of the ramp
  const k = await makeGame(file, { menus: menusStub(), via: 'ship', arrive: true });
  assert.equal(k.ship.cinematic?.constructor?.name, 'ArrivalDirector');
  // (40 s at most; it ends at about 20 s, and once it is over with him outside he stands at the ramp's foot, nothing
  // left to play: the run stops there, the same verdict. Not before it has been seen playing: one that never started
  // gets the whole 40 s, as before.)
  for (let i = 0, seen = false; i < 20 * 40 && !(seen && !k.ship.playing && !k.ship.inside); i++) { run(k, 1); seen ||= k.ship.playing; }
  assert.ok(!k.ship.playing && !k.ship.inside, 'the arrival over, outside');

  // (a bench's plan, no menus, is as before, no ship scenes: tests/bench-start.test.js checks it on its plan, the same
  // game, rather than build the desert a fifth time here)
});
