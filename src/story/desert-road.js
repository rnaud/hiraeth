import * as THREE from 'three';
import { registerInteractable, PRIORITY } from '../interact.js';
import { THINGS } from './desert-data.js';

// The pilgrims' road home (src/desert-road.js builds its cairns and the resting stone). While the tree is cold its
// lamps are dead. When the tree catches (desert.tree.lit), Qanat lights them for its guest: a little after the
// lighting, one after another from the main gate down to the landing, and a line says so once. A save with the tree
// already burning finds them all lit. The resting stone on the last dune's crest is a thing to look at.
//
//   const road = setupRoad(ctx)   →   { update(dt, t), lit: (i) => bool, state } (null without the road)

/** Seconds after the tree catches before the first lamp (the lighting plays first), and between lamps down the road. */
export const ROAD_LAMPS = { after: 14, gap: 0.9, radius: 9 };
export const ROAD_CUE = 'Down from the gate, one after another, lamps catch on the old pilgrims’ cairns: a road of little fires, west over the dunes to your ship.';

/** How many lamps are lit, t seconds after the tree caught. */
export const lampsLit = (t, n, { after = ROAD_LAMPS.after, gap = ROAD_LAMPS.gap } = {}) => Math.max(0, Math.min(n, Math.floor((t - after) / gap) + 1));

export function setupRoad(ctx) {
  const { level, game, dialogue, toast } = ctx;
  const R = level.road;
  if (!R) return null;
  const cue = ctx.cue ?? ((text) => toast(text));
  const treeLit = () => !!game.flag('desert.tree.lit');
  // (lit before this world loaded: all of them at once)
  const st = { t: treeLit() ? 1e9 : -1, told: treeLit(), shown: 0 };
  const show = (n) => {
    R.cairns.forEach((c, i) => { const on = i < n; c.flame.visible = on; c.light.w = on ? ROAD_LAMPS.radius : 0; });
    st.shown = n;
  };
  show(treeLit() ? R.cairns.length : 0);
  game.on?.('flag:desert.tree.lit', (v) => { if (v && st.t < 0) st.t = 0; if (!v) { st.t = -1; show(0); } });

  const at = R.rest.look;
  registerInteractable({ id: 'road.rest', priority: PRIORITY.use, range: 2.6, at: () => at, prompt: 'look at the resting stone',
    distance: (p) => (Math.abs(p.pos.y - at.y) < 3 ? Math.hypot(p.pos.x - at.x, p.pos.z - at.z) : Infinity),
    use: () => dialogue.start(THINGS.roadStone, null, R.rest.at.clone(), at.clone().add(new THREE.Vector3(0, 0.2, 0))) });

  return {
    state: st,
    lit: (i) => i < st.shown,
    update(dt, t) {
      if (st.t < 0) return;
      st.t += dt;
      const n = lampsLit(st.t, R.cairns.length);
      if (n !== st.shown) show(n);
      if (n > 0 && !st.told) { st.told = true; cue(ROAD_CUE, 7); }
      // a flicker: each flame a little taller and shorter, out of step with its neighbours
      for (let i = 0; i < st.shown; i++) R.cairns[i].flame.scale.set(1, 0.85 + 0.25 * Math.abs(Math.sin(t * 3.1 + i * 1.9)), 1);
    },
  };
}
