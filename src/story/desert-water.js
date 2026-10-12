import { registerInteractable, PRIORITY } from '../interact.js';
import { THINGS } from './desert-data.js';
import { FLOOD } from '../desert-water.js';

// The memory of water (src/desert-water.js builds it; issue #167). The old qanat wells from the giant's hand to Qanat
// are to listen at: the water under the sand sounds nearer at every well you put your ear to (desert.well.heard.<n>,
// desert.wells.heard: how many, up to three, for the line), and runs loud once the tree drinks. And when the tree
// drinks (the roots, issue #161: desert.well.watched, set as you watch the water climb them) the salt pan past the
// camps floods over half a minute, the mirage over it gone; a line says so once. A save where the tree has drunk
// finds it full.
//
//   const water = setupWater(ctx)   →   { state, update(dt) } (null without it)

export const FLOOD_CUE = 'Out past the camps, the old salt pan is filling with water. It has risen in the wells too.';
/** The tree has drunk: the roots watched (or a save past it: the tree alight, the ship fed). */
export const treeDrank = (game) => !!(game.flag('desert.well.watched') || game.flag('desert.tree.lit') || game.flag('ship.powered'));

export function setupWater(ctx) {
  const { level, game, dialogue, toast } = ctx;
  const Wm = level.water;
  if (!Wm) return null;
  const cue = ctx.cue ?? ((text) => toast(text));
  const st = { t: treeDrank(game) ? FLOOD.secs : -1, told: treeDrank(game) };
  Wm.setFlood(st.t > 0 ? 1 : 0);
  game.on?.('flag:desert.well.watched', (v) => { if (v && st.t < 0) st.t = 0; });
  Wm.wells.forEach((w, i) => {
    registerInteractable({ id: `water.well${w.n}`, priority: PRIORITY.use, range: 2.8, at: () => w.look, prompt: 'listen at the well',
      distance: (p) => (Math.abs(p.pos.y - w.at.y) < 3 ? Math.hypot(p.pos.x - w.at.x, p.pos.z - w.at.z) - 1.6 : Infinity),
      use: () => {
        game.set(`desert.well.heard.${w.n}`, true);
        const heard = Wm.wells.filter((x) => game.flag(`desert.well.heard.${x.n}`)).length;
        game.set('desert.wells.heard', Math.min(3, heard));
        dialogue.start(THINGS.qanatWell, null, w.stand.clone(), w.look.clone());
      } });
    void i;
  });
  return {
    state: st,
    update(dt) {
      if (st.t < 0 || st.t >= FLOOD.secs) return;
      st.t += dt;
      Wm.setFlood(st.t / FLOOD.secs);
      if (!st.told && st.t > 1.5) { st.told = true; cue(FLOOD_CUE, 7); }
    },
  };
}
