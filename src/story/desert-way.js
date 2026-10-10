import * as THREE from 'three';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { THINGS } from './desert-data.js';

// The fire-bearers' way, Qanat to the Givers' Hearth: a 1.65 km ride from marked stone to marked
// stone (src/desert-sites.js hearthStones). Three things to stop for on it (wayPlaces; drawn in
// src/desert-hearth.js `way`), none of them a quest, all of them seen from the bike:
//
//   the keepers' bowl  a bronze bowl at the foot of the second stone, whose mark is dull. Shoot
//                      fluid into it: it fills and glows, and the stone's mark wakes like the rest
//                      (desert.way.bowl). The tank is full by then: the first shot fired at
//                      something that answers, out in the open.
//   the cold camp      halfway: a ring of blackened stones, two poles, a stone of tallies (three
//                      days out, three home: desert.way.camp).
//   the bell           near the end, a few metres off the way: a glint in the sand that flashes as
//                      the sun catches it. A small bronze bell like the Speaker's; ring it. The
//                      Speaker hears of it (desert.way.bell, desert.way.told).
//
// Most riders go straight from Marrow's hollow toward the butte's chimney, and the stones run off to the
// north of that, so the straight ride has its own two (src/desert-sites.js ridePlaces, level design audit
// v1.9): Yara the salt-carrier in her sunshade's shade a third of the way (src/levels/content.js), and a
// sand-skiff's wreck two thirds of the way (desert.ride.wreck), and (v1.15) the tusk gate four fifths of the way,
// right over the ride where the red rocks begin, with the Givers' jar in its shade (desert.ride.tusks). The stones then lead home: the way back
// to Qanat passes the bowl and the camp you rode wide of on the way out.
//
// Called out on the ride (October 2026: the ride was "empty" at 34 m/s, the three blinked past): heading
// toward one of them on the errand (stages hearth, stone, light) and within CALL.range, a line names it
// once, ahead of you, while there is still time to stop (CALLS; not once it is done: the bowl filled, the
// camp seen, the bell rung). The butte itself is named once as it comes up on the way out.
//
//   const way = setupWay(ctx)   →   { update(dt, t), fillBowl() } (null without the Hearth)

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** How far ahead a place on the way is named, and how near is too near to bother (you are there). */
export const CALL = { range: 130, near: 18, hearth: 320, show: 6 };
/** What is named, as it comes up ahead (no lore: what you would see from the saddle). */
export const CALLS = {
  bowl: 'Ahead, at the foot of the next marked stone: a bronze bowl, dry, and the mark on the stone above it dull.',
  camp: 'Off the way ahead: a ring of blackened stones and two poles leaning together. Somebody camped here once.',
  bell: 'Something glints in the sand ahead, a few metres off the way.',
  shade: 'A red pennant over the dunes ahead: somebody’s sunshade, the only shade out here.',
  wreck: 'Ahead, a mast leans out of the sand with a rag of sail on it.',
  tusks: 'Ahead, two great tusks stand out of the sand, leaning together until their tips cross: a gate, and shade under it.',
  hearth: 'Ahead, on its hill of red rock: the Givers’ Hearth, a dark slit near the top of its chimney.',
};
const ERRAND = ['hearth', 'stone', 'light'];

export function setupWay(ctx) {
  const { level, dialogue, game, sound, toast, player } = ctx;
  // (said at once on the line under the view, as the drone says what it found: main.js passes `cue`; toasts
  // wait their turn, and "ahead" said late is behind you. A toast where there is no cue: the tests)
  const callLine = ctx.cue ?? ((text) => toast(text));
  const W = level.hearth?.way, M = level.hearth?.materials, R = level.hearth?.ride;
  if (!W) return null;
  const filled = () => !!game.flag('desert.way.bowl');
  const st = { glow: filled() ? 1 : 0, called: new Set(), prev: null };
  // the places named on the ride, and when each is worth naming
  const callAt = [
    { id: 'bowl', at: W.bowl.at, open: () => !filled() },
    { id: 'camp', at: W.camp.at, open: () => !game.flag('desert.way.camp') },
    { id: 'bell', at: W.bell.at, open: () => !game.flag('desert.way.bell') },
    // (the straight ride out, where the marked stones run off to the north: src/desert-sites.js ridePlaces)
    ...(R ? [{ id: 'shade', at: R.shade.at, range: 110, open: () => !game.flag('met.yara') }, { id: 'wreck', at: R.wreck.at, range: 110, open: () => !game.flag('desert.ride.wreck') }] : []),
    ...(R?.tusks ? [{ id: 'tusks', at: R.tusks.at, range: 140, open: () => !game.flag('desert.ride.tusks') }] : []),
    { id: 'hearth', at: level.hearth.doorFront, range: CALL.hearth, open: () => game.flag('quest.desert.power') === 'hearth' },
  ];
  const callOut = (pos) => {
    // which way you are going: from where you were a couple of metres back
    if (!st.prev) { st.prev = pos.clone(); return null; }
    const mx = pos.x - st.prev.x, mz = pos.z - st.prev.z, moved = Math.hypot(mx, mz);
    if (moved < 2) return null;
    st.prev.copy(pos);
    if (moved > 40) return null;   // (a teleport, a doorway: no direction to speak of)
    if (!ERRAND.includes(game.flag('quest.desert.power')) || dialogue.open) return null;
    for (const c of callAt) {
      if (st.called.has(c.id) || !c.open()) continue;
      const d = flat(pos, c.at);
      if (d > (c.range ?? CALL.range) || d < CALL.near) continue;
      // ahead of you: moving toward it
      if ((c.at.x - pos.x) * mx + (c.at.z - pos.z) * mz < 0.7 * d * moved) continue;
      st.called.add(c.id);
      callLine(CALLS[c.id], CALL.show);
      return c.id;
    }
    return null;
  };
  const near = (at, r = 3.2) => (p) => (Math.abs(p.pos.y - at.y) < 3 ? flat(p.pos, at) : Infinity);
  const look = (def, at, prompt, lookAt) => registerInteractable({ id: `way.${def.id}`, priority: PRIORITY.use, range: 3.2, at: () => at, prompt,
    distance: near(at), use: () => dialogue.start(def, null, at.clone(), lookAt?.clone() ?? null) });
  look(THINGS.wayBowl, W.bowl.at, 'look at the bronze bowl', W.bowl.top);
  look(THINGS.wayCamp, W.camp.at, 'look at the cold camp', W.camp.look);
  look(THINGS.wayBell, W.bell.at, 'pick up what glints', W.bell.at.clone().add(new THREE.Vector3(0, 0.2, 0)));
  if (R) look(THINGS.rideWreck, R.wreck.stand, 'look at the wreck', R.wreck.look);
  if (R?.tusks) look(THINGS.rideTusks, R.tusks.stand, 'look at the jar in the shade', R.tusks.look);

  const fillBowl = () => {
    if (filled()) return false;
    game.set('desert.way.bowl', true);
    sound.chime?.();
    toast('The bowl takes the fluid, and the dull mark on the stone above it wakes. The keepers lit their way home like this.');
    return true;
  };
  // any fluid fills it (the push only rocks the water that isn't there)
  registerTarget({ kind: 'wayBowl', radius: 0.75, position: () => W.bowl.top, enabled: () => !filled(),
    onHit: (mode) => (mode === 'push' ? false : fillBowl()) });

  return {
    fillBowl,
    callOut,
    called: st.called,
    update(dt, t, camPos = null) {
      if (player?.pos) callOut(player.pos);
      // the bowl's water and the stone's mark come up together
      st.glow = Math.min(1, st.glow + (filled() ? dt / 1.6 : -st.glow));
      W.bowl.fluid.visible = st.glow > 0.01;
      W.bowl.fluid.scale.setScalar(0.4 + 0.6 * st.glow);
      if (M?.wayMark?.uniforms?.uGlow) M.wayMark.uniforms.uGlow.value = 0.05 + 0.8 * st.glow;
      // the bell's glint: the sun catches it every couple of seconds (seen from the saddle)
      const flash = Math.max(0, Math.sin(t * 1.9)) ** 14;
      // (bigger with distance, so it reads as a point of light from the way, and stays small at your feet)
      const far = camPos ? THREE.MathUtils.clamp(camPos.distanceTo(W.bell.at) / 14, 0.45, 3) : 1;
      W.bell.glint.scale.setScalar((0.3 + 1.1 * flash) * far);
      W.bell.glint.visible = !game.flag('desert.way.bell') || flash > 0.02;
    },
  };
}
