// The Underwater City's story ("The Song Through the Glass"; on the route since v1.40, the fifth world: src/levels/names.js).
// Its thread is its temple, the Whale-House (src/temples/underwater.js; Anselme at its door, src/temples/underwater-data.js);
// Maelle in the Whale Gallery tells why the whales keep away (src/story/underwater-people.js). When the Whale-House's
// keeper is calmed (`temple.underwater.done`) the world is done on the route (`world.underwater.done`), its keepsake given
// (the whales' answer) and its page closes (src/levels/underwater.js UNDERWATER_CONTENT.story); out of the house, the
// first time, the whales coming to the glass are filmed (src/story/underwater-moments.js). Two errands of the city's own:
// Mireille's glow-kelp cutting up the lift to Fabre in the Crown, and Fabre's word down to Maelle in the Gallery.

import * as THREE from 'three';
import { KEEPSAKE, QUESTS, LINES_AFTER, THINGS } from './underwater-people.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { setupUnderwaterMoments } from './underwater-moments.js';

/** How near the Whale-House's door (m) the traveller stands, outside, when the whales are filmed. */
export const FILM_NEAR = 30;

/** The world's story: { people, update, dispose, film } (src/story/index.js WORLDS). */
export function setupUnderwater(ctx) {
  const { game, story, level, player, quests, dialogue, npcs = [], toast = () => {} } = ctx;
  const rt = level?.temples?.find((t) => t.id === 'underwater') ?? (level?.temple?.id === 'underwater' ? level.temple : null);
  const film = setupUnderwaterMoments(ctx, { rt, level });
  for (const q of QUESTS) quests?.define?.(q);
  // the city's own main quest doesn't just appear: it starts when you talk to Bastien at the lock (src/story/quests.js opensWith)
  if (quests?.opensWith && !quests.isStarted?.('underwater.note')) quests.opensWith('underwater.note', 'bastien');
  // where the errands point: the people by their content ids, the lift and the Crown
  for (const n of npcs) if (['mireille', 'fabre', 'maelle', 'bastien', 'coralie'].includes(n.def?.id)) quests?.locate?.(n.def.id, () => n.pos);
  // the window over the deep in the Whale Gallery (the level's sight): an ear to the glass traces the wrong note north
  const win = level?.sights?.find((s) => /window over the deep/.test(s.name))?.at;
  if (win) {
    const at = new THREE.Vector3(win[0], win[1], win[2]), look = at.clone().setY(at.y + 1.4);
    quests?.locate?.('deepWindow', () => at);
    registerInteractable({ id: 'deepWindow', priority: PRIORITY.use, range: 4.2, prompt: 'lay your ear on the glass', at: () => look,
      distance: (p) => (Math.abs(p.pos.y - at.y) < 4 ? Math.hypot(p.pos.x - at.x, p.pos.z - at.z) : Infinity),
      use: () => dialogue?.start?.(THINGS.window, null, look) });
  }
  const crown = level?.halls?.crown;
  if (quests?.locate && crown) {
    const foot = level.lift?.foot ?? [crown.x, 0, crown.z];
    const c = new THREE.Vector3(crown.x, crown.y + 0.5, crown.z), l = new THREE.Vector3(foot[0], 0.5, foot[2]);
    quests.locate('crown', () => c);
    quests.locate('lift', () => l);
  }
  let closing = null;
  // the whales come to the glass: the level's whales drawn in (src/levels/underwater.js whalesNear), eased
  let near = game.flag('temple.underwater.done') ? 1 : 0;
  level?.whalesNear?.(near);
  const finish = () => {
    if (!game.flag('world.underwater.done')) {
      game.set('world.underwater.done', true);
      // (the world's keepsake, as each world's main quest gives one: src/story/ending.js reads the hold)
      if (game.addKeepsake?.(KEEPSAKE)) toast('Keepsake: the whales’ answer. The light’s note first, then their own.');
    }
    for (const n of npcs) if (n.def?.id === 'maelle' || n.def?.id === 'coralie') { n.lines = [...LINES_AFTER]; n.lineIdx = 0; }
    closing ??= setTimeout(() => story?.complete?.(), 1500);
    closing?.unref?.();
  };
  if (game.flag('temple.underwater.done')) finish();
  const off = game.on('flag:temple.underwater.done', (v) => { if (v) finish(); });
  return {
    people: {},
    film,
    update(dt) {
      const want = game.flag('temple.underwater.done') ? 1 : 0;
      if (near !== want) { near = Math.max(0, Math.min(1, near + Math.sign(want - near) * (dt ?? 1 / 60) / 8)); level?.whalesNear?.(near); }
      // the whales, filmed once: out of the house after its keeper is calmed, near its door
      if (!rt?.outside || !player?.pos || !game.flag('temple.underwater.done') || game.flag('underwater.moment.whales')) return;
      if (rt.inside?.(player.pos) || player.pos.distanceTo(rt.outside.door.at) > FILM_NEAR) return;
      if (near < 1) return;   // (once the whales have come in to the glass: the film's second panel is of them)
      film.whales({ said: 'Against the glass, close enough to fog it, a whale is singing.' });
    },
    /** The whales in at the glass at once (the review page's staging: src/cinematics-page/runtime.js). */
    whalesIn() { near = 1; level?.whalesNear?.(1); },
    dispose() { off?.(); if (closing) clearTimeout(closing); },
  };
}
