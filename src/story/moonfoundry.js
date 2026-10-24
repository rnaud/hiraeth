// The Moon Foundry's story ("The Moon Nobody Came For"; on the route since v1.40, after the Buried Machine:
// src/levels/names.js). Its thread is its temple, the Casting-House (src/temples/moonfoundry.js; Petra at its door with
// the founders' ledger, src/temples/moonfoundry-data.js). When the Last Founder is stopped (`temple.moonfoundry.done`)
// the world is done on the route (`world.moonfoundry.done`), its keepsake given (a pocket moon) and its page closes
// (src/levels/moon-foundry.js MOONFOUNDRY_CONTENT.story); out of the house, the first time, the moons turning to it are
// filmed (src/story/moonfoundry-moments.js). Petra's word after it is the way on: the ledger's first moons went to a garden
// far off and fell short (the Garden of Spheres: clue.moonfoundry.spheres). Two errands of the foundry's own, each done
// where its goal is (issue #137): Wen's count at the pillar's lookout (reached before she asked, it starts and ends
// there), and Liesel's mended hook hung on the last furnace's crane.

import * as THREE from 'three';
import { KEEPSAKE, QUESTS, LINES_AFTER } from './moonfoundry-people.js';
import { setupMoonFoundryMoments } from './moonfoundry-moments.js';
import { setupMoonFoundryRoute } from './moonfoundry-route.js';

/** How near the pillar's lookout (m, across; and up or down) the moons are counted from. */
export const LOOKOUT_RADIUS = 9, LOOKOUT_UP = 5;
/** How near the Casting-House's door (m) the traveller stands, outside, when the moons are filmed. */
export const FILM_NEAR = 45;

/** The world's story: { people, update, dispose, film } (src/story/index.js WORLDS). */
export function setupMoonFoundry(ctx) {
  const { game, story, level, player, quests, npcs = [], toast = () => {} } = ctx;
  const rt = level?.temples?.find((t) => t.id === 'moonfoundry') ?? (level?.temple?.id === 'moonfoundry' ? level.temple : null);
  const film = setupMoonFoundryMoments(ctx, { rt, level });
  for (const q of QUESTS) quests?.define?.(q);
  // the foundry's own main quest doesn't just appear: it starts when you talk to Hedda on the apron (src/story/quests.js opensWith)
  if (quests?.opensWith && !quests.isStarted?.('moonfoundry.moons')) quests.opensWith('moonfoundry.moons', 'hedda', { hint: 'Someone by a mould' });
  for (const n of npcs) if (['ottilie', 'bertil', 'wen', 'dun', 'ivo', 'hedda'].includes(n.def?.id)) quests?.locate?.(n.def.id, () => n.pos);
  // the old hoist's signal box, on its second deck (v1.57, issue #193: src/foundry-cranes.js; its first deck until then):
  // from it the hung moons, all turned one way
  const Ho = level?.hoist, SB = level?.signalBox;
  if ((SB || Ho) && quests?.locate) { const at = SB ? SB.at.clone() : new THREE.Vector3(Ho.x, Ho.stages[0][1], Ho.z); quests.locate('hoistDeck', () => at); }
  const offHoist = game.on?.('quest', (e) => {
    if (e?.id === 'moonfoundry.moons' && e.prev === 'hoist') toast('From the signal box every hung moon on the floor faces one way: east, at the Casting-House.');
  }) ?? null;
  // the deck on the broken moon's crown, the street's end (src/foundry-street.js), where the high walk leaves
  const crown = level?.street?.crown;
  if (crown && quests?.locate) quests.locate('moonCrown', () => crown);
  // the signal box's lever and the lookout's bell-pull call the moon-carrier (src/story/moonfoundry-route.js)
  const route = setupMoonFoundryRoute(ctx);
  // the lookout on the pillar under the moon on its pillar (src/levels/moon-foundry.js PMOON: its platform at 0.78 of it)
  const L = level?.lookout;
  const lookoutAt = L ? new THREE.Vector3(L.x, L.y, L.z) : null;
  if (lookoutAt && quests?.locate) quests.locate('lookout', () => lookoutAt);
  // the jib crane over the last furnace's mould (src/levels/moon-foundry.js level.crane): Liesel's ladle-hook is hung on it
  const C = level?.crane;
  if (C && quests?.locate) { const at = new THREE.Vector3(C.x, C.y, C.z); quests.locate('crane', () => at); }
  const offHook = game.on?.('quest', (e) => {
    if (e?.id === 'moonfoundry.hook' && e.stage === 'done') { quests?.take?.('ladlehook'); toast('The ladle-hook goes on the crane, and Bertil’s ladle swings straight over the mould.'); }
  }) ?? null;
  /** Up on the lookout: the moons counted, whoever asked (Wen's errand starts there if she hadn't asked yet). */
  const countAt = (p) => {
    if (!lookoutAt || !p || game.flag('moonfoundry.moons.counted')) return;
    if (Math.hypot(p.x - lookoutAt.x, p.z - lookoutAt.z) >= LOOKOUT_RADIUS || Math.abs(p.y - lookoutAt.y) >= LOOKOUT_UP) return;
    game.set('moonfoundry.moons.counted', true);
    toast('From the lookout you count them all: thirty-two moons, the one in the Casting-House’s mould too.');
    if (quests && !quests.isStarted?.('moonfoundry.count')) quests.start?.('moonfoundry.count');
  };
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
      countAt(player?.pos);
      // the moons, filmed once: out of the house after the Last Founder is stopped, near its door
      if (!rt?.outside || !player?.pos || !game.flag('temple.moonfoundry.done') || game.flag('moonfoundry.moment.moon')) return;
      if (rt.inside?.(player.pos) || player.pos.distanceTo(rt.outside.door.at) > FILM_NEAR) return;
      film.moon({ said: 'Over the floor the hung moons turn on their hooks, slowly, all toward the Casting-House.' });
    },
    dispose() { off?.(); offHoist?.(); offHook?.(); route?.dispose(); if (closing) clearTimeout(closing); },
  };
}
