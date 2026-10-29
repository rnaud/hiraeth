// The core gadgets: what a world gives that the worlds after it are built for, which the ship will not leave without
// (issue #217: "I shouldn't be able to leave the desert without getting all the core gadgets from that level. I was able
// to leave without a sword and shield right now").
//
// Two worlds have them:
//  - the desert: the battery, and since issues #729 and #730 everything else on its main quest's line: the fluid gun,
//    the Givers' blade and guard from the Rose House (without them no foe comes for him anywhere, src/foes.js armed(),
//    and every temple's switches want the blade), and the lift valve from the giant's skull, whose monsters want the
//    blade (its step on the way back to the tree, before Qanat's gift: `quest`, so the gift waits for it too);
//  - Vael: the fluid wings from the Aerie: Vael's tower, the City-Shaft's air pillars, the trials that are flown.
// Every other world's temple gadget is the key to that temple's own rooms, and its gifts in the open are extras: none
// of them is wanted past its world, so they leave whenever the traveller likes (docs/systems/progression.md, "Core
// gadgets: the ship waits for them").
//
// Every core gadget's chest is in its own world (tests/leave-gate.test.js), so a save is never kept where it can't
// get them: it is standing in the world they are in.
//
// Pure: the ship (src/ship/ship.js travel) and the tests use it.

import { partOf } from '../levels/names.js';
import { spoken } from './tone.js';

/**
 * World (as on the route: a merged world by its own id) → its core gadgets, in the order they are found. `quest`: the
 * quest that leads to it, started by a refusal if it was not (main.js), so the quest log and the scout show the way
 * (the main quest's own three need none: the ship has no power before them).
 */
export const CORE = {
  desert: [
    { item: 'backpack', name: 'the makers’ battery', where: 'Qanat' },
    { item: 'gun', name: 'the fluid gun', where: 'the Rose House', quest: 'temple.desert' },
    { item: 'sword', name: 'the Givers’ blade', where: 'the Rose House', quest: 'temple.desert' },
    { item: 'shield', name: 'the Givers’ guard', where: 'the Rose House', quest: 'temple.desert' },
    { item: 'doublejump', name: 'the lift valve', where: 'the giant’s skull', quest: 'desert.power' },
  ],
  arzach: [
    { item: 'glider', name: 'the fluid wings', where: 'the Aerie', plural: true, quest: 'temple.arzach' },
  ],
};

/** The core gadgets of `world` not yet had ((id) => owned), in the order they are found. */
export function missingCore(world, has) {
  return (CORE[partOf(world)] ?? []).filter((c) => !has(c.item));
}

/**
 * The main quest's last step in a world with core gadgets (issue #232: the desert's main quest ended, then the ship
 * refused to leave without the blade and the guard): met once the gadgets off the main quest's own line (those with a
 * `quest`: the blade and the guard, the wings) are had, so the quest never reads as done while the ship would refuse
 * for them. (The desert's own three finds are the main quest's steps, so it has them by then.) `ahead: false` (having
 * them early doesn't skip the steps before it), `pass: true` (had already when the quest reaches it: passed over,
 * never shown; src/story/quests.js landing). `temple`: the step is done inside the world's temple (the gadgets are in its
 * chests), what the level design audit counts it as (scripts/level-design/path.mjs; issue #278).
 */
export function coreStage(world, stage) {
  return { ...stage, when: (q) => !missingCore(world, (id) => q.has(id)).some((c) => c.quest), ahead: false, pass: true, temple: world };
}

/**
 * Leaving `world` for `to`: null if the ship may go, else { missing, quest, line }: the ship's one line on what is still
 * to find (the first missing gadget's place, and everything missing there) and the quest that leads there. Going nowhere
 * (`to` the world itself) is never stopped.
 */
export function leaveRefusal(world, to, has) {
  if (partOf(to) === partOf(world)) return null;
  const miss = missingCore(world, has);
  if (!miss.length) return null;
  const where = miss[0].where, at = miss.filter((c) => c.where === where), here = at.map((c) => c.name);
  const what = here.length > 1 ? `${here.slice(0, -1).join(', ')} and ${here[here.length - 1]}` : here[0];
  return { missing: miss.map((c) => c.item), quest: at.find((c) => c.quest)?.quest ?? null, line: spoken('plumb', `~neutral~ Not yet. ${what[0].toUpperCase()}${what.slice(1)} ${here.length > 1 || at[0].plural ? 'are' : 'is'} still in ${where}.`) };
}
