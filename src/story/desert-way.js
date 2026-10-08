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
//   const way = setupWay(ctx)   →   { update(dt, t), fillBowl() } (null without the Hearth)

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function setupWay(ctx) {
  const { level, dialogue, game, sound, toast } = ctx;
  const W = level.hearth?.way, M = level.hearth?.materials;
  if (!W) return null;
  const filled = () => !!game.flag('desert.way.bowl');
  const st = { glow: filled() ? 1 : 0 };
  const near = (at, r = 3.2) => (p) => (Math.abs(p.pos.y - at.y) < 3 ? flat(p.pos, at) : Infinity);
  const look = (def, at, prompt, lookAt) => registerInteractable({ id: `way.${def.id}`, priority: PRIORITY.use, range: 3.2, at: () => at, prompt,
    distance: near(at), use: () => dialogue.start(def, null, at.clone(), lookAt?.clone() ?? null) });
  look(THINGS.wayBowl, W.bowl.at, 'look at the bronze bowl', W.bowl.top);
  look(THINGS.wayCamp, W.camp.at, 'look at the cold camp', W.camp.look);
  look(THINGS.wayBell, W.bell.at, 'pick up what glints', W.bell.at.clone().add(new THREE.Vector3(0, 0.2, 0)));

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
    update(dt, t, camPos = null) {
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
