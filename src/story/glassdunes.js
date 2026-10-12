// The Glass Dunes' story (on the route since October 2026, in the Sealed Hangar's place: src/levels/names.js): the
// world's one thread is its temple, the Clock-House (src/temples/garage.js, its words src/temples/garage-data.js:
// Wim at its door starts its quest). When the Clockwork Foreman keeps time again (set right or stopped: the
// temple's `temple.garage.done`), the world is done on the route (`world.glassdunes.done`), its keepsake given
// (Wim's tick) and its page closes (src/levels/glass-dunes.js GLASS_CONTENT.story). Out of the house, the first
// time, the clock over its door is filmed coming round (src/story/glassdunes-moments.js). Wim's word after it is
// the way on: the slow time comes from a great wheel under another desert (the Buried Machine: clue.glassdunes.buried).

import * as THREE from 'three';
import { KEEPSAKE, QUESTS } from './glassdunes-people.js';
import { setupGlassDunesMoments } from './glassdunes-moments.js';
import { CHAMBER } from '../glass-dunes-frozen.js';

/** How near the Clock-House's door (m) the traveller stands, outside, when its clock is filmed. */
export const FILM_NEAR = 45;

/** The world's story: { people, update, dispose, film } (src/story/index.js WORLDS). */
export function setupGlassDunes(ctx) {
  const { game, story, level, player, quests, physics, npcs = [], toast = () => {} } = ctx;
  const rt = level?.temples?.find((t) => t.id === 'garage') ?? (level?.temple?.id === 'garage' ? level.temple : null);
  // the dunes' own main quest (v1.48, issue #101): it starts when you talk to Halden by the discs (src/story/quests.js opensWith)
  for (const q of QUESTS) quests?.define?.(q);
  if (quests?.opensWith && !quests.isStarted?.('glassdunes.minute')) quests.opensWith('glassdunes.minute', 'oren');
  for (const n of npcs) if (['oren', 'aster', 'corin'].includes(n.def?.id)) quests?.locate?.(n.def.id, () => n.pos);
  // the glass mound by the warm flow (src/levels/glass-dunes.js GLASS_RIDGES 'mound 1'), its top: from it the Clock-House's face
  const M = level?.flowMound;
  if (M && quests?.locate) {
    const top = new THREE.Vector3(M[0], 0, M[1]);
    const y = physics?.groundAt?.(top.x, 200, top.z, 260);
    top.y = Number.isFinite(y) ? y : 9;
    quests.locate('flowMound', () => top);
  }
  const offMound = game.on?.('quest', (e) => {
    if (e?.id === 'glassdunes.minute' && e.prev === 'mound') toast('From the mound the Clock-House’s face reads clear: seven minutes to the hour. Its door stands open.');
  }) ?? null;
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
      // (issue #166) the city under the sand, the first time you come down into it; the chamber inside the breaking
      // wave, the first time you stand in it: reaching it is reading it (src/glass-dunes-city.js, src/glass-dunes-frozen.js)
      if (player?.pos) {
        if (!game.flag('glassdunes.city.seen') && level?.inCity?.(player.pos)) {
          game.set('glassdunes.city.seen', true);
          toast('Under the sand, a city. Its tallest tower holds up the Clock-House.');
        }
        const m = !game.flag('glassdunes.moment.reached') && level?.frozen?.scenes?.find((f) => f.id === 'moment');
        if (m && Math.hypot(player.pos.x - m.at.x, player.pos.z - m.at.z) < CHAMBER.inner[0] - 0.8 && Math.abs(player.pos.y - m.at.y) < 4) {
          game.set('glassdunes.moment.reached', true);
          toast('Inside the wave: the minute the light passed, held still.');
        }
      }
      // the clock, filmed once: out of the house after the Foreman keeps time, near its door
      if (!rt?.outside || !player?.pos || !game.flag('temple.garage.done') || game.flag('glassdunes.moment.clock')) return;
      if (rt.inside?.(player.pos) || player.pos.distanceTo(rt.outside.door.at) > FILM_NEAR) return;
      film.clock({ said: 'Over the door, the clock keeps time. Out in the sand the great cogs turn with it.' });
    },
    dispose() { off?.(); offMound?.(); if (closing) clearTimeout(closing); },
  };
}
