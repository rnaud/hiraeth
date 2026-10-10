// The City Floating in Space's story ("The Note That Passed"; on the route since v1.40, before the Signal Market:
// src/levels/names.js). Its thread is its temple, the Mooring-House on its own island (src/temples/spacecity.js; Joss the
// moorer at its door, src/temples/spacecity-data.js). When the Anchor-Warden is resolved (`temple.spacecity.done`) the
// world is done on the route (`world.spacecity.done`), its keepsake given (what the cables are for) and its page closes
// (src/levels/space-city.js SPACECITY_CONTENT.story); out of the house, the first time, the cables drawing taut are
// filmed (src/story/spacecity-moments.js). Joss's word after it is the way on: the planet's hum on the cables carries a
// broadcast from a market of a thousand signs where one tower is silent (the Signal Market: clue.spacecity.bazaar). Two
// errands of the city's own: Madame Sel's notes to Tamar on the Towers, and one of Kip's lamps hung up the Balcony's mast.

import * as THREE from 'three';
import { KEEPSAKE, QUESTS, LINES_AFTER } from './spacecity-people.js';
import { setupSpaceCityMoments } from './spacecity-moments.js';

/** How near the Mooring-House's door (m) the traveller stands, outside, when the cables are filmed. */
export const FILM_NEAR = 40;

/** The world's story: { people, update, dispose, film } (src/story/index.js WORLDS). */
export function setupSpaceCity(ctx) {
  const { game, story, level, player, quests, npcs = [], toast = () => {} } = ctx;
  const rt = level?.temples?.find((t) => t.id === 'spacecity') ?? (level?.temple?.id === 'spacecity' ? level.temple : null);
  const film = setupSpaceCityMoments(ctx, { rt });
  for (const q of QUESTS) quests?.define?.(q);
  for (const n of npcs) if (['tamar', 'sel', 'kip', 'nima'].includes(n.def?.id)) quests?.locate?.(n.def.id, () => n.pos);
  // the crow's nest on the Balcony's lamp-mast (src/levels/space-city.js level.mastTop): Kip's lamp is hung there
  const E = level?.mastTop;
  if (E && quests?.locate) { const at = new THREE.Vector3(E.x, E.y, E.z); quests.locate('mast', () => at); }
  const offLamp = game.on?.('quest', (e) => { if (e?.id === 'spacecity.lamp' && e.stage === 'done') quests?.take?.('kiplamp'); }) ?? null;
  let closing = null;
  const finish = () => {
    if (!game.flag('world.spacecity.done')) {
      game.set('world.spacecity.done', true);
      // (the world's keepsake, as each world's main quest gives one: src/story/ending.js reads the hold)
      if (game.addKeepsake?.(KEEPSAKE)) toast('Keepsake: what the cables are for. Not holding: listening.');
    }
    for (const n of npcs) if (!n.def?.talk && n.def?.lang === 'spacecity') { n.lines = [...LINES_AFTER]; n.lineIdx = 0; }
    closing ??= setTimeout(() => story?.complete?.(), 1500);
    closing?.unref?.();
  };
  if (game.flag('temple.spacecity.done')) finish();
  const off = game.on('flag:temple.spacecity.done', (v) => { if (v) finish(); });
  return {
    people: {},
    film,
    update() {
      // the cables, filmed once: out of the house after the Anchor-Warden is resolved, near its door
      if (!rt?.outside || !player?.pos || !game.flag('temple.spacecity.done') || game.flag('spacecity.moment.cables')) return;
      if (rt.inside?.(player.pos) || player.pos.distanceTo(rt.outside.door.at) > FILM_NEAR) return;
      film.cables({ said: 'Under the islands the cables draw taut, and lamps run along them toward the city.' });
    },
    dispose() { off?.(); offLamp?.(); if (closing) clearTimeout(closing); },
  };
}
