// The City Floating in Space's story ("The Note That Passed"; on the route since v1.40, before the Signal Market:
// src/levels/names.js). Its thread is its temple, the Mooring-House on its own island (src/temples/spacecity.js; Joss the
// moorer at its door, src/temples/spacecity-data.js). When the Anchor-Warden is resolved (`temple.spacecity.done`) the
// world is done on the route (`world.spacecity.done`), its keepsake given (what the cables are for) and its page closes
// (src/levels/space-city.js SPACECITY_CONTENT.story); out of the house, the first time, the cables drawing taut are
// filmed (src/story/spacecity-moments.js). Joss's word after it is the way on: the planet's hum on the cables carries a
// broadcast from a market of a thousand signs where one tower is silent (the Signal Market: clue.spacecity.bazaar). Two
// errands of the city's own, each done where its goal is (issue #137): Madame Sel's notes laid on the cables under the
// Towers (the cables' own talk, THINGS.cables), and one of Kip's lamps hung up the Balcony's mast. Since v1.57 (issue #194)
// the cables are felt at the great cable's clamp under the Towers, down the moorers' stair, and the way on to the Mooring-House
// is up the stack and over its broken bridge, whose drifted span the capstan reels home (src/levels/space-city-ways.js).

import * as THREE from 'three';
import { KEEPSAKE, QUESTS, LINES_AFTER, THINGS, DETOURS } from './spacecity-people.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { setupSpaceCityMoments } from './spacecity-moments.js';

/** How near the Mooring-House's door (m) the traveller stands, outside, when the cables are filmed. */
export const FILM_NEAR = 40;

/** The world's story: { people, update, dispose, film } (src/story/index.js WORLDS). */
export function setupSpaceCity(ctx) {
  const { game, story, level, player, quests, dialogue, sound, npcs = [], toast = () => {} } = ctx;
  const rt = level?.temples?.find((t) => t.id === 'spacecity') ?? (level?.temple?.id === 'spacecity' ? level.temple : null);
  const film = setupSpaceCityMoments(ctx, { rt });
  for (const q of QUESTS) quests?.define?.(q);
  // the city's own main quest doesn't just appear: it starts when you talk to Rosa on the Pier (src/story/quests.js opensWith)
  if (quests?.opensWith && !quests.isStarted?.('spacecity.drift')) quests.opensWith('spacecity.drift', 'rosa');
  for (const n of npcs) if (['tamar', 'sel', 'kip', 'nima', 'rosa', 'ewart', 'tilde'].includes(n.def?.id)) quests?.locate?.(n.def.id, () => n.pos);
  // the great cable under the Towers where it leaves for the Moorings (at its clamp, on the catwalk under the deck): a hand on
  // it, and it pulls north
  const cab = level?.cableAnchor;
  if (cab) {
    const at = new THREE.Vector3(cab.x, cab.y, cab.z), look = at.clone().setY(at.y + 1.1);
    quests?.locate?.('towerCables', () => at);
    registerInteractable({ id: 'towerCables', priority: PRIORITY.use, range: 4.2, prompt: 'lay a hand on the cables', at: () => look,
      distance: (p) => (Math.abs(p.pos.y - at.y) < 3 ? Math.hypot(p.pos.x - at.x, p.pos.z - at.z) : Infinity),
      use: () => dialogue?.start?.(THINGS.cables, null, look) });
  }
  // the places off the way (src/levels/space-city-detours.js; issue #233): one line each
  for (const d of level?.detours ?? []) {
    const def = DETOURS[d.id], s = d.stand;
    if (def) registerInteractable({ id: def.id, priority: PRIORITY.use, range: 2.6, prompt: def.prompt, at: () => d.look,
      distance: (p) => (Math.abs(p.pos.y - s.y) < 2.5 ? Math.hypot(p.pos.x - s.x, p.pos.z - s.z) : Infinity),
      use: () => dialogue?.start?.(def, null, s.clone(), d.look.clone()) });
  }
  // the capstan on the stack: A / × and the broken bridge's drifted span is reeled home (for good: the flag). Once the cables
  // are taut (the Mooring-House resolved) it stays home too.
  const drift = level?.drift;
  if (drift) {
    if (game.flag('spacecity.drift.reeled') || game.flag('temple.spacecity.done')) drift.set(1);
    const at = drift.drum.clone(), feet = at.clone().setY(at.y - 1.75);
    quests?.locate?.('capstan', () => feet);
    registerInteractable({ id: 'stackCapstan', priority: PRIORITY.use, range: 3.6, prompt: 'turn the capstan', at: () => at, enabled: () => !drift.reeled && !drift.moving,
      distance: (p) => (Math.abs(p.pos.y - feet.y) < 2.5 ? Math.hypot(p.pos.x - feet.x, p.pos.z - feet.z) : Infinity),
      use: () => {
        if (!drift.reel(() => { game.set('spacecity.drift.reeled', true); toast('The span swings home on its cable. The bridge is whole.'); })) return;
        sound?.chime?.();
      } });
  }
  // the crow's nest on the Balcony's lamp-mast (src/levels/space-city.js level.mastTop): Kip's lamp is hung there
  const E = level?.mastTop;
  if (E && quests?.locate) { const at = new THREE.Vector3(E.x, E.y, E.z); quests.locate('mast', () => at); }
  const offLamp = game.on?.('quest', (e) => {
    if (e?.id === 'spacecity.lamp' && e.stage === 'done') quests?.take?.('kiplamp');
    if (e?.id === 'spacecity.notes' && e.stage === 'done') quests?.take?.('selnotes');   // (left on the cable)
  }) ?? null;
  let closing = null;
  const finish = () => {
    if (!game.flag('world.spacecity.done')) {
      game.set('world.spacecity.done', true);
      // (the world's keepsake, as each world's main quest gives one: src/story/ending.js reads the hold)
      if (game.addKeepsake?.(KEEPSAKE)) toast('Keepsake: what the cables are for. Not holding: listening.');
    }
    for (const n of npcs) if (!n.def?.talk && n.def?.lang === 'spacecity') { n.lines = [...LINES_AFTER]; n.lineIdx = 0; }
    if (level?.drift && !level.drift.reeled && !level.drift.moving) level.drift.set(1);   // (the cables taut: the span home)
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
