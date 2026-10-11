import * as THREE from 'three';
import { registerInteractable, PRIORITY } from '../interact.js';
import { makeMaterial } from '../materials.js';
import { textGeometry } from './sign-text.js';
import { Q, QUESTS, PEOPLE, THINGS, ITEMS } from './night-train-data.js';

// The night mail, alive (night-train-data.js has the words; docs/story-bible.md "The night mail").
//
//   in the Signal Market (setupNightHalt, from setupBazaar): Edda by her lamp at the night halt past the south gate,
//     the bell on its post. Ringing it (once Edda has given you her letter, or any time after) calls the Overnight
//     Train: the screen fades and the next page is the train, pulling out of the halt (?level=overnighttrain&from=bazaar).
//   aboard (setupTrainStory, the train's own story): Ambrose the conductor on the station-side porch where you boarded,
//     Solange on the last carriage's roof by her chalk mark; asking Ambrose to stop brakes the train into the market's halt
//     (level.requestStop), and once it halts the step down on the station side takes you back to the market's halt
//     (?level=bazaar&from=overnighttrain: level.arrivals, main.js).
//
// A save in either place stays where it was: the quest's stage is in the game state, the train runs on (it never
// waits at a station unless asked) and the halt's bell calls it again whenever it is rung.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Go to another place by a page load, under the ship's fade (the cinema's sheet), after `delay` s. */
export function travel(ctx, href, delay = 0.9) {
  const { ship, game } = ctx;
  game.emit?.('travel:page', { href });
  ship?.cinema?.fade?.(1, false, Math.max(0.2, delay - 0.2));
  const go = () => { try { globalThis.location.search = href; } catch { /* (node: no page) */ } };
  if (typeof setTimeout === 'function') setTimeout(go, delay * 1000); else go();
}

/** The quest and its items, defined in whichever world loads first. */
function define(quests) {
  for (const q of QUESTS) if (!quests.def(q.id)) quests.define(q);
  quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
}

// ------------------------------------------------------------------ the Signal Market's night halt

/**
 * The halt in the market (level.nightHalt, src/levels/night-halt.js: { edda, bell, lamp, heading }). Returns
 * { people, ring } or null when the market has no halt.
 */
export function setupNightHalt(ctx) {
  const { level, quests, dialogue, game, spawn, toast, sound } = ctx;
  const H = level?.nightHalt;
  if (!H) return null;
  define(quests);
  // back from the train: you stepped off at the halt (the arrival puts you on its platform: main.js level.arrivals)
  if (quests.stage(Q) === 'off') quests.advance(Q, 'off');
  const people = {};
  if (spawn) {
    people.edda = spawn(PEOPLE.edda, { route: [H.edda.clone()], heading: H.heading, speed: 0.4 });
    people.edda.facing = H.heading;
  }
  quests.locate('edda', () => people.edda?.pos ?? H.edda);
  // the board's letters, toward the market
  if (H.board && ctx.scene) {
    const m = new THREE.Mesh(textGeometry('NIGHT HALT', { width: 3.1, depth: 0.03 }).rotateY(Math.PI), makeMaterial({ color: '#3a535b', flat: true, key: 'nightmail.board' }));
    m.position.copy(H.board); m.userData.noCollide = true; m.name = 'The night halt’s board';
    ctx.scene.add(m);
  }
  quests.locate('bell', () => H.bell);
  const st = { ringing: false };
  /** Can the bell call the train for you now? Once Edda has given you the letter (or the quest is done: a ride for fun). */
  const canRing = () => !st.ringing && (quests.reached(Q, 'board') || quests.isDone(Q));
  const ring = () => {
    if (!canRing()) return false;
    st.ringing = true;
    game.set('nightmail.rang', true);
    sound?.bell?.() ?? sound?.chime?.();
    toast?.('The bell rings out down the line. Far off in the dark, a whistle answers.');
    travel(ctx, '?level=overnighttrain&from=bazaar', 2.4);
    return true;
  };
  registerInteractable({
    id: 'nightmail.bell', priority: PRIORITY.use, range: 2.6,
    prompt: () => (canRing() ? 'ring the bell for the night train' : 'look at the bell'),
    at: () => H.bell.clone().add(V(0, 0.4, 0)),
    distance: (p) => (Math.abs(p.pos.y - H.bell.y + 1.6) < 3 ? flat(p.pos, H.bell) : Infinity),
    use: () => { if (!ring()) dialogue.start(THINGS.bell, null, H.bell, H.bell); },
  });
  if (H.timetable) registerInteractable({
    id: 'nightmail.timetable', priority: PRIORITY.use, range: 2.2, prompt: 'read the timetable', at: () => H.timetable,
    distance: (p) => (Math.abs(p.pos.y - H.timetable.y + 1.4) < 3 ? flat(p.pos, H.timetable) : Infinity),
    use: () => dialogue.start(THINGS.timetable, null, H.timetable, H.timetable),
  });
  return { people, ring, canRing };
}

// ------------------------------------------------------------------ aboard the Overnight Train

/**
 * The train's own story (src/story/index.js WORLDS.overnighttrain): Ambrose, Solange, the step down at a halt, the stop
 * asked for. Needs the train level's `nightMail` ({ ambrose, mireille, stepOff, heading… }) and its run (level.run,
 * level.requestStop, level.from).
 */
export function setupTrainStory(ctx) {
  const { level, quests, dialogue, game, spawn, toast, sound } = ctx;
  const N = level?.nightMail;
  if (!N) return null;
  define(quests);
  // boarded at the halt with the letter: the conductor is the one to ask
  if (level.from === 'bazaar' && quests.stage(Q) === 'board') quests.advance(Q, 'board');
  const people = {};
  if (spawn) {
    people.ambrose = spawn(PEOPLE.ambrose, { route: [N.ambrose.clone(), N.ambrose.clone().add(V(0.8, 0, 0.3))], heading: N.bramHeading, speed: 0.3 });
    people.mireille = spawn(PEOPLE.mireille, { route: [N.mireille.clone()], heading: N.agatheHeading, seat: 0.0, speed: 0 });
    people.mireille.facing = N.agatheHeading;
  }
  quests.locate('ambrose', () => people.ambrose?.pos ?? N.ambrose);
  quests.locate('mireille', () => people.mireille?.pos ?? N.mireille);
  quests.locate('stepOff', () => N.stepOff);
  const halted = () => level.run?.phase === 'halt';
  const st = { asked: false, leaving: false };
  // asked to stop (Ambrose's words set the flag): the train brakes into the market's halt
  const ask = () => {
    if (st.asked) return;
    const at = level.requestStop?.(4);
    if (at == null) return;
    st.asked = true;
    sound?.whistle?.('train');
    toast?.('The whistle calls ahead. A minute on, the brakes take hold.');
  };
  if (game.flag('nightmail.stop')) ask();
  game.on('flag:nightmail.stop', (v) => { if (v) ask(); });
  registerInteractable({
    id: 'nightmail.stepOff', priority: PRIORITY.use, range: 2.4,
    prompt: () => (halted() ? 'step down onto the platform' : 'look out at the platform'),
    at: () => N.stepOff.clone().add(V(0, 1.2, 0)),
    enabled: () => halted() || !!game.flag('nightmail.stop'),
    distance: (p) => (Math.abs(p.pos.y - N.stepOff.y) < 2 ? flat(p.pos, N.stepOff) : Infinity),
    use: () => {
      if (!halted()) { dialogue.start(THINGS.platform, null, N.stepOff, N.stepOff); return; }
      if (st.leaving) return;
      st.leaving = true;
      game.set('nightmail.stop', false);
      travel(ctx, '?level=bazaar&from=overnighttrain', 0.9);
    },
  });
  return {
    people,
    update() {
      // the halt over and the train pulling out again: Ambrose may be asked again
      if (st.asked && level.run?.phase === 'leaving' && (level.run?.halts ?? 0) > 0) { st.asked = false; game.set('nightmail.stop', false); }
    },
  };
}
