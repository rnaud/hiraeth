// The Moon Foundry's story ("The Moon Nobody Came For"; on the route since v1.40, after the Buried Machine:
// src/levels/names.js). Its thread is its temple, the Casting-House (src/temples/moonfoundry.js; Ilse at its door with
// the founders' ledger, src/temples/moonfoundry-data.js). When the Last Founder is stopped (`temple.moonfoundry.done`)
// the world is done on the route (`world.moonfoundry.done`), its keepsake given (a pocket moon) and its page closes
// (src/levels/moon-foundry.js MOONFOUNDRY_CONTENT.story); out of the house, the first time, the moons turning to it are
// filmed (src/story/moonfoundry-moments.js). Ilse's word after it is the way on: the ledger's first moons went to a garden
// far off and fell short (the Garden of Spheres: clue.moonfoundry.spheres). Two errands of the foundry's own: Wen's count
// from the pillar's lookout, and Ottilie's mended hook to Bertil at the last furnace.

import * as THREE from 'three';
import { KEEPSAKE, QUESTS, LINES_AFTER } from './moonfoundry-people.js';
import { setupMoonFoundryMoments } from './moonfoundry-moments.js';

/** How near the Casting-House's door (m) the traveller stands, outside, when the moons are filmed. */
export const FILM_NEAR = 45;

/** The world's story: { people, update, dispose, film } (src/story/index.js WORLDS). */
export function setupMoonFoundry(ctx) {
  const { game, story, level, player, quests, npcs = [], toast = () => {} } = ctx;
  const rt = level?.temples?.find((t) => t.id === 'moonfoundry') ?? (level?.temple?.id === 'moonfoundry' ? level.temple : null);
  const film = setupMoonFoundryMoments(ctx, { rt, level });
  for (const q of QUESTS) quests?.define?.(q);
  for (const n of npcs) if (['ottilie', 'bertil', 'wen', 'dun', 'ivo'].includes(n.def?.id)) quests?.locate?.(n.def.id, () => n.pos);
  // the lookout on the pillar under the moon on its pillar (src/levels/moon-foundry.js PMOON: its platform at 0.78 of it)
  const L = level?.lookout;
  if (L && quests?.locate) { const at = new THREE.Vector3(L.x, L.y, L.z); quests.locate('lookout', () => at); }
  let closing = null;
  const finish = () => {
    if (!game.flag('world.moonfoundry.done')) {
      game.set('world.moonfoundry.done', true);
      // (the world's keepsake, as each world's main quest gives one: src/story/ending.js reads the hold)
      if (game.addKeepsake?.(KEEPSAKE)) toast('Keepsake: a pocket moon, still faintly warm.');
    }
    for (const n of npcs) if (!n.def?.talk && n.def?.lang === 'moonfoundry') { n.lines = [...LINES_AFTER]; n.lineIdx = 0; }
    closing ??= setTimeout(() => story?.complete?.(), 1500);
    closing?.unref?.();
  };
  if (game.flag('temple.moonfoundry.done')) finish();
  const off = game.on('flag:temple.moonfoundry.done', (v) => { if (v) finish(); });
  return {
    people: {},
    film,
    update() {
      // the moons, filmed once: out of the house after the Last Founder is stopped, near its door
      if (!rt?.outside || !player?.pos || !game.flag('temple.moonfoundry.done') || game.flag('moonfoundry.moment.moon')) return;
      if (rt.inside?.(player.pos) || player.pos.distanceTo(rt.outside.door.at) > FILM_NEAR) return;
      film.moon({ said: 'Over the floor the hung moons turn on their hooks, slowly, all toward the Casting-House.' });
    },
    dispose() { off?.(); if (closing) clearTimeout(closing); },
  };
}
