import { game } from '../game-state.js';
import { progressBefore } from '../debug-save.js';
import { CINEMATICS } from './catalog.js';
import { CallDirector, TakeoffDirector } from '../ship/cinematics.js';
import { callLines, callContext, recordingLabel } from '../story/calls.js';
import { ENDING_WORLDS } from '../story/ending.js';
import { ORDER, TITLES } from '../levels/names.js';
import { BELL } from '../story/arzach2-moments.js';
import { DESERT_QUEST_V } from '../story/desert-data.js';
import { wayOut, finaleFlag, FINALES } from '../temples/finale.js';
const selected = () => CINEMATICS.find(e => e.id === new URLSearchParams(location.search).get('cinematicReview'));
export async function seedReview() {
  const e = selected();
  if (!e) throw new Error('Unknown cinematic review');
  seedReviewEntry(e);
}
/** The save a cinematic of the catalog plays on, written to the active slot (the page's review, the engines' sequences: engine/sequences.js). */
export function seedReviewEntry(e) {
  const seed = progressBefore(e.world) ?? progressBefore('bazaar');
  game.data = { flags: { ...seed?.flags, 'prologue.done': true, 'item.backpack': 1, 'ship.powered': true, 'ship.launched': true }, keepsakes: seed?.keepsakes ?? [] };
  if (e.id === 'homecoming.final') Object.assign(game.data.flags, { 'finale.met': true, 'ending.done': true, 'world.lantern.done': true });
  if (e.id === 'prologue') game.data.flags['ship.launched'] = false;
  // (the desert's films on the desert's own save: its quest's version set, or the old-save step (desert.js migrateDesertQuest)
  //  reads the seeded ship.powered as a save past the tree and lights it before the stone is set: the QC, v1.66)
  if (e.world === 'desert') game.data.flags['desert.quest.v'] = DESERT_QUEST_V;
  if (e.item) { game.data.flags[`item.${e.item}`] = 0; game.data.flags[`box.${e.boxId}`] = false; }
  // (a house's ending: inside it, its guardian not yet resolved, its film not yet seen; the logic's store, .boss)
  if (e.temple) Object.assign(game.data.flags, { [`temple.${e.temple}.entered`]: true, [`temple.${e.temple}.done`]: false, [`temple.${e.temple}.boss`]: null, [finaleFlag(e.temple)]: false });
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
    while (!w.__hiraethBooted) { if (Date.now() > deadline) throw new Error('World loading timed out. Replay to retry.'); await new Promise(r => setTimeout(r, 100)); }
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
 * refused to start. The review page calls it after seeding its save; the dev menu (src/dev-menu.js)
 * calls it in the save being played.
 */
/** The worlds whose climax is filmed outside their temple once its guardian is done: the temple's id. */
const TEMPLE_MOMENTS = { glassdunes: 'garage', underwater: 'underwater', moonfoundry: 'moonfoundry', spacecity: 'spacecity' };

export async function stageCinematic(w, e) {
  const W0 = w.storyRt.world, W = W0, V = (...a) => new w.THREE.Vector3(...a), up = V(0, 1, 0);
  const place = (p, offset = V(0, 0, 0)) => { if (!p) throw new Error('Missing staging position'); w.player.teleport(p.clone().add(offset), up, V(0, 0, 1)); };
  // Give the actual world a frame to pose the traveller before its camera takes over.
  const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  let ok = true;
  if (e.id.startsWith('call.')) {
    // (recording n after the n-th world on the route, as in play: its word that world's; past the last on the reel,
    //  the reel's oldest side, the last one heard: every one from the 6th on played the last recording's words before)
    const done = typeof e.n === 'number' ? ORDER.slice(0, Math.min(e.n, ORDER.length)) : ORDER;
    if (typeof e.n === 'number' && e.n > ENDING_WORLDS) game.set('calls.home', true);
    const ctx = callContext(game, { titles: TITLES, completed: done, lastWorld: done.at(-1) ?? 'bazaar' });
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
    // (a box behind a yard's gate: in play its puzzle holds the gate open as you walk in, so open it here too; it
    //  opened through the bars, QC v1.66, issue #292)
    for (const g of w.gadgets?.world?.gates ?? []) {
      if (g.object.getWorldPosition(V()).distanceTo(box.pos) > 6) continue;
      g.held = 1; g.open = 1; g.object.position.copy(g.base).addScaledVector(up, -g.travel); g.object.updateMatrixWorld();
    }
    place(box.at ?? box.pos ?? box.parts.root.position, V(0, 0, 2)); await settle();
    ok = w.boxes.open(box.id);
  } else if (e.temple) {
    // a house's ending (src/temples/finale.js), as play has it: in its arena between the keeper and the way out, every
    // door of the way in open (the logic forced: the puzzles behind you done), the keeper woken and resolved, which
    // plays the film (runtime.js onBossResolved → the story's onFinale). The QC of v1.85 found them off the page (#490)
    const T = w.level.temples?.find((t) => t.id === e.temple) ?? (w.level.temple?.id === e.temple ? w.level.temple : null);
    const G = T?.guardian, way = T && wayOut(T);
    if (!G?.model?.pos || !way) throw new Error(`No guardian or way out in ${e.temple}`);
    const L = T.logic;
    for (const [id, el] of Object.entries(L.def.elements)) {
      if (id === way.id || id === T.def.arenaDoor || el.type !== 'door' || JSON.stringify(el.opens ?? {}).includes('resolved')) continue;
      L.force(id, true);
    }
    if (!e.opening) FINALES[e.temple]?.stage?.(T);   // (the house as play leaves it at its guardian's end: the Engine-House's ball in the teeth, #562)
    // (set open at once and silent, as they stand long after play opened them one by one: all at once, their clunks and
    // rushes at the film's first second made the Casting-House's ending, with eleven of them, the loudest of the QC, #563)
    T.applyDoors(true);
    const c = G.model.pos, door = way.piece.group.position;
    const dir = V(door.x - c.x, 0, door.z - c.z).normalize();
    if (!e.opening) {
      place(c.clone().addScaledVector(dir, Math.min(6, G.arena.r * 0.5)).setY(G.arena.y + 0.1));
      w.player.heading = Math.atan2(-dir.x, -dir.z);
    } else {
      // its introduction (src/temples/trial-flow.js, #655): as you come through its door, just inside the hall's rim
      // on that side, the keeper asleep; the trial's gate is asked as the guardian would ask it
      const d = T.piece(T.def.arenaDoor)?.group?.getWorldPosition(V()) ?? door;
      const to = V(d.x - c.x, 0, d.z - c.z).normalize();
      place(G.arena.center.clone().addScaledVector(to, G.arena.r - 2.5).setY(G.arena.y + 0.1));
      w.player.heading = Math.atan2(-to.x, -to.z);
      await settle(); await settle();
      T.holdWake?.();
      return w.storyRt.moments.current?.id === `temple.${e.temple}.trial.opening`;
    }
    await settle(); await settle();
    G.wake(); G.resolve();
    ok = w.storyRt.moments.current?.id === `temple.${e.temple}.finale`;
  } else if (e.id === 'lantern.arrive') { place(w.level.lantern.spots.isle); if (!W.state.arrived) W.arrive(); }
  else if (e.world === 'home') W[e.id.split('.')[1]]();
  else {
    // (by the id's part, not the level: a merged world films each part's climax from that part's story, Vael II's bell
    //  and Lorn II's pools in Vael and Lorn; staged by e.world they played Vael's bird and Lorn's crystal: QC v1.66)
    const [part, key] = e.id.split('.');
    const W = W0.parts?.[part] ?? W0;
    if (part === 'desert') {
      const cave = w.level.qanat.cave, city = w.level.qanat.city;
      if (key === 'lit') {
        // as in play: the water up, the spark-stone in the pack, in front of the roots (city.rootsLook) as you set it
        // (and the water seen climbing the roots, desert.well.watched: else its own watch holds the stage and the film refuses)
        game.set('desert.channel.open', true); game.set('desert.well.watched', true); game.set('item.stone', 1);
        place(city.rootsLook); await settle(); W.setStone();
        return w.storyRt.moments.current?.id === e.id;
      }
      if (key === 'fill') {
        W.state.level = cave.levels.high; W.state.flow = 1;
        place(V(cave.poolCenter.x + cave.basinR(cave.levels.high) - 1.2, cave.origin.y + cave.levels.high - 0.3, cave.poolCenter.z));
      } else place(cave.bone.position, V(-cave.chDir.z, 0, cave.chDir.x).normalize().multiplyScalar(-2.4));   // (beside the drain's debris, where you pull it out: the lever went with issue #158)
      game.set('desert.channel.open', true); game.set('tool.empty', key === 'fill');
      await settle(); ok = w.storyRt.moments.current?.id === e.id || W.film[key]('');
    } else if (part === 'arzach') {
      const bird = w.player.vehicles.find(v => v.kind === 'bird' || v.constructor.name === 'Bird');
      const land = w.player.pos.clone().add(V(3, 0, 4));
      if (!bird) throw new Error('Bird unavailable');
      bird.object.visible = true;
      ok = W.film.bird({ land, said: '' }); bird.summon(land.x, land.z, 0, w.player.pos);
    } else if (part === 'arzach2') {
      // (an arm's length from the rope toward the open side, as you pull it: on its foot, the rope ran through him, QC v1.66)
      place(w.level.arzach2.ropeFoot, V(Math.sin(BELL.OUT), 0, Math.cos(BELL.OUT)).multiplyScalar(0.9)); await settle(); ok = W.film.bell({ said: '', shout() {} });
    } else if (part === 'perdide') { place(W.places.heart, V(1.6, 0, 0.4)); await settle(); ok = W.film.crystal(); }
    else if (part === 'perdide2') {
      place(W.pools[2].c, V(4, 0, 4)); W.light(W.pools[0]); W.light(W.pools[1]); await settle(); ok = W.light(W.pools[2]);
    } else if (e.world === 'edena') { place(W.terraces.wheelAt, V(-2, 0, 2)); await settle(); ok = W.film.terraces(); }
    else if (e.world === 'buried') { place(W.watchAt); await settle(); ok = W.film.wheel(); }
    else if (e.world === 'spheres') { place(W.pole, V(3, 0, 4)); await settle(); W.chord(); }
    else if (e.world === 'garage') { place(W.people.lune.pos, V(3, 0, 3)); await settle(); ok = W.film.signal(); }
    else if (e.world === 'bazaar') { place(w.level.signal.places.console, V(0, 0, 1.4));   // (at the console up the tower, where you play it: from the square, his face shot was against a wall, QC v1.66)
       game.set('item.recording', 1); game.set('bazaar.antenna.tuned', true); await settle(); W.play(); }
    else if (e.world === 'incal') {
      // as in play: on the crown, the camera looking up at the light, the splinter let go (giveBack: it climbs,
      // lands at 3.6 s and the billboards say LOOK UP; calling the film alone left them blank)
      place(w.level.shaft.places.palace.crown, V(3.2, 0, 1.2)); await settle();   // (on the terrace round the needle, not in it)
      if (w.rig) w.rig.pitch = w.rig.pitchUpLimit?.() ?? -0.6;
      W.giveBack(w.camera); ok = w.storyRt.moments.current?.id === e.id;
    } else if (TEMPLE_MOMENTS[e.world]) {
      // as in play: out of the temple once its guardian is done, a few steps from its door, the world's change shown (the
      // whales in at the glass, the cables taut, the moons turned, the clock keeping time). They were filmed from the
      // landing, the world unchanged: the cinematics QC, v1.43
      const id = TEMPLE_MOMENTS[e.world];
      game.set(`temple.${id}.done`, true);
      const T = w.level.temples?.find((t) => t.id === id) ?? w.level.temple, d = T?.outside?.door;
      place(d?.at, V(Math.sin(d?.heading ?? 0) * 4, 0.1, Math.cos(d?.heading ?? 0) * 4));
      W.whalesIn?.();
      await settle(); await settle();
      ok = w.storyRt.moments.current?.id === e.id || W.film[key]('');
    } else { await settle(); ok = W.film[key](); }
  }
  return ok;
}
