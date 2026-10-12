import { registerInteractable, PRIORITY } from '../interact.js';
import { THINGS } from './desert-data.js';

// The walking dunes (src/desert-dunes.js builds them; issue #167). Each visit to the desert the dunes have walked:
// the world is built with the visit's count (desert.dunes.visit, read by src/levels/desert.js) and two of the four
// ruins stand clear of their dunes, a different two next time (DUNE_VISITS). Setting the story up counts this visit,
// so the next build is the next one. A ruin that stands clear is a thing to look at: one line.
//
//   const dunes = setupDunes(ctx)   →   { visit } (null without the dunes)

export const RUIN_LOOKS = {
  stair: { def: THINGS.ruinStair, prompt: 'look at the doorway' },
  tower: { def: THINGS.ruinTower, prompt: 'look at the tower' },
  caravan: { def: THINGS.ruinCaravan, prompt: 'look at the carts' },
  arcade: { def: THINGS.ruinArcade, prompt: 'look at the arches' },
};

export function setupDunes(ctx) {
  const { level, game, dialogue } = ctx;
  const D = level.dunes;
  if (!D) return null;
  game.set('desert.dunes.visit', (D.visit ?? 0) + 1);
  for (const r of D.ruins) {
    if (!r.open) continue;
    const L = RUIN_LOOKS[r.id];
    registerInteractable({ id: `dunes.${r.id}`, priority: PRIORITY.use, range: 3.4, at: () => r.look, prompt: L.prompt,
      distance: (p) => (Math.abs(p.pos.y - r.stand.y) < 4 ? Math.hypot(p.pos.x - r.look.x, p.pos.z - r.look.z) : Infinity),
      use: () => dialogue.start(L.def, null, r.stand.clone(), r.look.clone()) });
  }
  // the lookout up the sandfall mesa (issue #181): the view over the ride, one look
  const O = D.lookout;
  if (O) registerInteractable({ id: 'dunes.lookout', priority: PRIORITY.use, range: 3.4, at: () => O.look, prompt: 'look out',
    distance: (p) => (Math.abs(p.pos.y - O.stand.y) < 3 ? Math.hypot(p.pos.x - O.look.x, p.pos.z - O.look.z) : Infinity),
    use: () => dialogue.start(THINGS.lookout, null, O.stand.clone(), O.look.clone()) });
  return { visit: D.visit };
}
