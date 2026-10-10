import { game } from '../game-state.js';
import { progressBefore } from '../debug-save.js';
import { CINEMATICS } from './catalog.js';
import { CallDirector, TakeoffDirector } from '../ship/cinematics.js';
import { callLines, callContext, recordingLabel } from '../story/calls.js';
import { ORDER, TITLES } from '../levels/names.js';
const selected = () => CINEMATICS.find(e => e.id === new URLSearchParams(location.search).get('cinematicReview'));
export async function seedReview() {
  const e = selected();
  if (!e) throw new Error('Unknown cinematic review');
  const seed = progressBefore(e.world) ?? progressBefore('bazaar');
  game.data = { flags: { ...seed?.flags, 'prologue.done': true, 'item.backpack': 1, 'ship.powered': true, 'ship.launched': true }, keepsakes: seed?.keepsakes ?? [] };
  if (e.id === 'homecoming.final') Object.assign(game.data.flags, { 'finale.met': true, 'ending.done': true, 'world.lantern.done': true });
  if (e.id === 'prologue') game.data.flags['ship.launched'] = false;
  if (e.item) { game.data.flags[`item.${e.item}`] = 0; game.data.flags[`box.${e.boxId}`] = false; }
  game.save();
}
export async function startReview(w) {
  const e = selected();
  w.sound.muted = true;
  w.sound.setVolumes(0, 0);
  w.sound.setVoices(0);
  if (w.sound.master) w.sound.master.gain.setValueAtTime(0, w.sound.ctx.currentTime);
  const state = w.cinematicReview = { paused: false, status: 'Loading', id: e.id };
  const tell = () => {
    const m = w.storyRt?.moments?.current ?? w.storyRt?.world?.state?.moment ?? w.ship?.cinematic ?? w.boxes?.scene;
    w.parent.postMessage({ type: 'cinematic-review', id: e.id, status: state.status, paused: state.paused, time: m?.t ?? 0 }, location.origin);
  };
  w.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== w.parent || event.data?.type !== 'cinematic-control') return;
    if (event.data.action === 'pause') { state.paused = !state.paused; if (w.sound.ctx) { if (state.paused) w.sound.ctx.suspend(); else w.sound.ctx.resume(); } }
    if (event.data.action === 'mute') {
      const volume = event.data.muted ? 0 : 1;
      w.sound.muted = event.data.muted; w.sound.setVolumes(volume, volume); w.sound.setVoices(volume);
      if (!event.data.muted) w.sound.start();
      if (w.sound.master) w.sound.master.gain.setTargetAtTime(w.sound.masterLevel(), w.sound.ctx.currentTime, 0.1);
    }
    tell();
  });
  const timer = setInterval(tell, 250);
  w.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  try {
    const deadline = Date.now() + 120000;
    while (!w.__moebiusBooted) { if (Date.now() > deadline) throw new Error('World loading timed out. Replay to retry.'); await new Promise(r => setTimeout(r, 100)); }
    while (w.document.getElementById('loading')) { if (Date.now() > deadline) throw new Error('Loading overlay did not close. Replay to retry.'); await new Promise(r => setTimeout(r, 50)); }
    w.story.closePage?.();
    if (e.query) { state.status = 'Playing · interactive sequences use the game controls'; return; }
    const ok = await stageCinematic(w, e);
    if (ok === false) throw new Error('The cinematic refused to start');
    state.status = 'Playing · replay to reset the scene';
  } catch (err) { state.status = `Could not play: ${err.message}`; console.error(err); }
  finally { tell(); }
}

/**
 * Stage and start one cinematic of the catalog in the world `w` is (window: its storyRt, ship, boxes, level,
 * player, items, THREE, rig, camera): the traveller put where it plays, the film started. Returns false when it
 * refused to start. The review page calls it after seeding its save; the world debug menu (src/world-debug.js)
 * calls it in the save being played.
 */
export async function stageCinematic(w, e) {
  const W = w.storyRt.world, V = (...a) => new w.THREE.Vector3(...a), up = V(0, 1, 0);
  const place = (p, offset = V(0, 0, 0)) => { if (!p) throw new Error('Missing staging position'); w.player.teleport(p.clone().add(offset), up, V(0, 0, 1)); };
  // Give the actual world a frame to pose the traveller before its camera takes over.
  const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  let ok = true;
  if (e.id.startsWith('call.')) {
    const ctx = callContext(game, { titles: TITLES, completed: ORDER, lastWorld: 'bazaar' });
    w.ship.cinematic = new CallDirector(w.ship, { n: e.n, lines: callLines(e.n, ctx), label: recordingLabel(e.n, ctx), onDone() {} });
    w.ship.cinematic.start();
  } else if (e.id === 'takeoff') {
    // (where you stand to set a course: at the holo table's open side, in the ship)
    const m = w.ship.parked; if (m) { w.ship.placePlayer(w.ship.world(m, m.interior.points.tableFoot.clone().add(V(1.2, 0, 0.2))), w.ship.worldHeading(m, -Math.PI / 2), true); await settle(); }
    w.ship.cinematic = new TakeoffDirector(w.ship, { to: 'desert', title: TITLES.desert, onDone() {} }); w.ship.cinematic.start();
  } else if (e.boxId) {
    const box = w.boxes.list.find(b => b.id === e.boxId);
    if (!box) throw new Error('No unopened box');
    w.items.revoke(box.item); game.set(`box.${box.id}`, false);
    place(box.at ?? box.pos ?? box.parts.root.position, V(0, 0, 2)); await settle();
    ok = w.boxes.open(box.id);
  } else if (e.id === 'lantern.arrive') { place(w.level.lantern.spots.isle); if (!W.state.arrived) W.arrive(); }
  else if (e.world === 'home') W[e.id.split('.')[1]]();
  else {
    const key = e.id.split('.')[1];
    if (e.world === 'desert') {
      const cave = w.level.qanat.cave;
      if (key === 'fill') {
        W.state.level = cave.levels.high; W.state.flow = 1;
        place(V(cave.poolCenter.x + cave.basinR(cave.levels.high) - 1.2, cave.origin.y + cave.levels.high - 0.3, cave.poolCenter.z));
      } else place(W.lever.postAt, V(-cave.chDir.z, 0, cave.chDir.x).normalize().multiplyScalar(-2.4));
      game.set('desert.channel.open', true); game.set('tool.empty', key === 'fill');
      await settle(); ok = w.storyRt.moments.current?.id === e.id || W.film[key]('');
    } else if (e.world === 'arzach') {
      const bird = w.player.vehicles.find(v => v.kind === 'bird' || v.constructor.name === 'Bird');
      const land = w.player.pos.clone().add(V(3, 0, 4));
      if (!bird) throw new Error('Bird unavailable');
      bird.object.visible = true;
      ok = W.film.bird({ land, said: '' }); bird.summon(land.x, land.z, 0, w.player.pos);
    } else if (e.world === 'arzach2') {
      place(w.level.arzach2.ropeFoot); await settle(); ok = W.film.bell({ said: '', shout() {} });
    } else if (e.world === 'perdide') { place(W.places.heart, V(1.6, 0, 0.4)); await settle(); ok = W.film.crystal(); }
    else if (e.world === 'perdide2') {
      place(W.pools[2].c, V(4, 0, 4)); W.light(W.pools[0]); W.light(W.pools[1]); await settle(); ok = W.light(W.pools[2]);
    } else if (e.world === 'edena') { place(W.terraces.wheelAt, V(-2, 0, 2)); await settle(); ok = W.film.terraces(); }
    else if (e.world === 'buried') { place(W.watchAt); await settle(); ok = W.film.wheel(); }
    else if (e.world === 'spheres') { place(W.pole, V(3, 0, 4)); await settle(); W.chord(); }
    else if (e.world === 'garage') { place(W.people.lune.pos, V(3, 0, 3)); await settle(); ok = W.film.signal(); }
    else if (e.world === 'bazaar') { place(V(-4, w.level.ground.heightAt(-4, -205), -205)); game.set('item.recording', 1); game.set('bazaar.antenna.tuned', true); await settle(); W.play(); }
    else if (e.world === 'incal') {
      // as in play: on the crown, the camera looking up at the light, the splinter let go (giveBack: it climbs,
      // lands at 3.6 s and the billboards say LOOK UP; calling the film alone left them blank)
      place(w.level.shaft.places.palace.crown, V(3.2, 0, 1.2)); await settle();   // (on the terrace round the needle, not in it)
      if (w.rig) w.rig.pitch = w.rig.pitchUpLimit?.() ?? -0.6;
      W.giveBack(w.camera); ok = w.storyRt.moments.current?.id === e.id;
    } else { await settle(); ok = W.film[key](); }
  }
  return ok;
}
