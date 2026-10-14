// What a quest needs before anyone can give it (issue #328, the author: "In Vael, I shouldn't be able to get the quest
// marker for the waiting bird if I don't have the wings. I should never be able to unlock a quest that requires a
// critical item if I don't have it. The character instigator should send me to go to the other quest instead.").
//
// A quest's `needs` (its definition in the story data: ['glider'], or { quest: 'arzach.bird' } for another quest done
// first) are the critical items its steps can't be done without: the core gadgets (src/story/leave-gate.js CORE: the
// backpack, the lift valve, the fluid gun, the Givers' blade and guard, the fluid wings). A temple's quest needs what its
// rooms ask for that its own chests don't hold (templeNeeds, from the temple's logic: the Rose House's double jump).
// While one is missing (src/story/quests.js blocked):
//  - its giver is not waiting for you: no mark on the map, no balloon, the scout doesn't find them (quests.waiting);
//  - talking to them doesn't give it: they say one line instead, pointing at the place the missing thing is
//    (heldBackLine: the quest's own `needsLine`, else "Not without the fluid wings. They are in the Aerie."), and the
//    quest that gets it starts if it hadn't (quests.heldBack, src/story/dialogue.js start), the way the ship's refusal
//    starts it (leave-gate.js); nobody sends you to somebody else;
//  - an answer that would start it is not offered (dialogue.js choices).
// Once it is had, the quest is given as before. Doing the thing first (a goal reached, a temple walked into) still starts
// a quest: that is not a giving. tests/quest-needs.test.js checks every quest of every world.
//
// Pure: no DOM, no game state of its own.

import { CORE } from './leave-gate.js';
import { partOf } from '../levels/names.js';

/** item → { item, name, where, world, quest (the quest that gets it), plural }: the critical items and where they are. */
export const SOURCES = Object.freeze(Object.fromEntries(Object.entries(CORE).flatMap(([world, list]) => list.map((c) =>
  // (the desert's first three are its main quest's own finds)
  [c.item, Object.freeze({ ...c, world, quest: c.quest ?? (world === 'desert' ? 'desert.power' : null) })]))));
/** The critical items: what a quest can be held back for. */
export const CRITICAL = Object.freeze(Object.keys(SOURCES));

/** A quest definition's needs, each { item } or { quest, name, where }. */
export function questNeeds(def) {
  return [].concat(def?.needs ?? []).filter(Boolean).map((n) => (typeof n === 'string' ? { item: n } : n));
}

/**
 * The critical items every traveller in `world` has: the desert's, everywhere past the desert (the ship won't leave it
 * without them: src/story/leave-gate.js). The wings are not: Vael can be left for later.
 */
export function carriedIn(world) {
  return world && partOf(world) !== 'desert' ? CORE.desert.map((c) => c.item) : [];
}

/**
 * What a temple's rooms need from outside: the critical items its links and elements ask for, its own chests' items
 * aside, and those every traveller in its world carries (carriedIn: the gun past the desert).
 */
export function templeNeeds(logic, world = logic?.id) {
  if (!logic) return [];
  const want = new Set();
  for (const l of logic.links ?? []) for (const n of l.needs ?? []) want.add(n);
  for (const e of Object.values(logic.elements ?? {})) for (const n of e.needs ?? []) want.add(n);
  const inside = new Set([logic.gadget, ...Object.values(logic.elements ?? {}).map((e) => e.item)].filter(Boolean));
  const carried = new Set(carriedIn(world));
  return [...want].filter((n) => CRITICAL.includes(n) && !inside.has(n) && !carried.has(n)).sort((a, b) => CRITICAL.indexOf(a) - CRITICAL.indexOf(b));
}

/**
 * The first of `def`'s needs not met, with where it is ({ item, name, where, quest, … } or the quest need as written),
 * or null. has(item) → owned; isDone(quest id) → finished.
 */
export function missingNeed(def, { has = () => false, isDone = () => false } = {}) {
  for (const n of questNeeds(def)) {
    if (n.item && !has(n.item)) return { ...(SOURCES[n.item] ?? { name: n.item, where: null, quest: null }), ...n };
    if (n.quest && !n.item && !isDone(n.quest)) return n;
  }
  return null;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The giver's one line while `need` is missing (toned): the quest's own `needsLine`, else where the missing thing is. */
export function heldBackLine(def, need) {
  const own = def?.needsLine;
  if (typeof own === 'string') return own;
  if (own && typeof own === 'object' && need && own[need.item ?? need.quest]) return own[need.item ?? need.quest];
  if (!need) return null;
  const name = need.name ?? need.item ?? 'that';
  if (!need.where) return `~neutral~ Not without ${name}. Come back with ${need.plural ? 'them' : 'it'}.`;
  return `~neutral~ Not without ${name}. ${cap(need.plural ? 'they are' : 'it is')} in ${need.where}.`;
}
