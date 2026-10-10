// The Glass Dunes' story (on the route since October 2026, in the Sealed Hangar's place: src/levels/names.js): the
// world's one thread is its temple, the Clock-House (src/temples/garage.js, its words src/temples/garage-data.js:
// Wim at its door starts its quest). When the Clockwork Foreman keeps time again (set right or stopped: the
// temple's `temple.garage.done`), the world is done on the route (`world.glassdunes.done`), its keepsake given
// (Wim's tick) and its page closes (src/levels/glass-dunes.js GLASS_CONTENT.story). Out of the house, the first
// time, the clock over its door is filmed coming round (src/story/glassdunes-moments.js). Wim's word after it is
// the way on: the slow time comes from a great wheel under another desert (the Buried Machine: clue.glassdunes.buried).

import { KEEPSAKE } from './glassdunes-people.js';
import { setupGlassDunesMoments } from './glassdunes-moments.js';

/** How near the Clock-House's door (m) the traveller stands, outside, when its clock is filmed. */
export const FILM_NEAR = 45;

/** The world's story: { people, update, dispose, film } (src/story/index.js WORLDS). */
export function setupGlassDunes(ctx) {
  const { game, story, level, player, toast = () => {} } = ctx;
  const rt = level?.temples?.find((t) => t.id === 'garage') ?? (level?.temple?.id === 'garage' ? level.temple : null);
  const film = setupGlassDunesMoments(ctx, { rt });
  let closing = null;
  const finish = () => {
    if (!game.flag('world.glassdunes.done')) {
      game.set('world.glassdunes.done', true);
      // (the world's keepsake, as each world's main quest gives one: src/story/ending.js reads the hold)
      if (game.addKeepsake?.(KEEPSAKE)) toast('Keepsake: Wim’s tick. Every clock in the dunes keeps the same time.');
    }
    closing ??= setTimeout(() => story?.complete?.(), 1500);
    closing?.unref?.();
  };
  if (game.flag('temple.garage.done')) finish();
  const off = game.on('flag:temple.garage.done', (v) => { if (v) finish(); });
  return {
    people: {},
    film,
    update() {
      // the clock, filmed once: out of the house after the Foreman keeps time, near its door
      if (!rt?.outside || !player?.pos || !game.flag('temple.garage.done') || game.flag('glassdunes.moment.clock')) return;
      if (rt.inside?.(player.pos) || player.pos.distanceTo(rt.outside.door.at) > FILM_NEAR) return;
      film.clock({ said: 'Over the door, the clock keeps time. Out in the sand the great cogs turn with it.' });
    },
    dispose() { off?.(); if (closing) clearTimeout(closing); },
  };
}
