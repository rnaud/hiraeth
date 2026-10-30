import { ARCHETYPES } from '../../../../src/enemies/archetypes.js';
import { SKINS } from '../../../../src/enemies/skins.js';

// The dune mummer as its own enemy (the author, 2026-10-30, #800): not the mummer's replacement. Today's mummer (the
// pot-headed sack, plans/mummer.js) stays in the game as it is; the gourd with the oval mask becomes a new archetype of
// its own, `dunemummer`, registered later (its own id, def, skins, weapons, sounds and places), on the same humanoid
// clip rig. Until then it lives here, in the trial, keyed by that id, and stands in for `mummer` only on the trial page
// (TRIAL_BUILDERS, empty in the game). Nothing here is in ARCHETYPES, SKINS or any world's roster.
//
// What it starts from is the mummer's own (copied, never shared: changing one does not change the other): its kit of
// attacks (whack, jab, volley, rock), windows, the mask that can be knocked off and the disarm; its two skins (desert,
// the home skin in the reference's colours; glassdunes, the bleached twin); its weapons per spawn; its sound keys.

/** The new archetype's id. */
export const DUNE_MUMMER_ID = 'dunemummer';
/** The body that carries it (this folder's model.js, with the Tripo source loaded). */
export const DUNE_MUMMER_BODY = { trial: 'tripo', model: 'references/enemy-redesign-2026-10-30/trials/mummer-tripo/model.js', rig: 'humanoid clip rig (src/enemies/humanoid-rig.js)' };

const copy = (x) => (Array.isArray(x) ? x.map(copy) : x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, copy(v)])) : x);

/**
 * The entry to register as ARCHETYPES.dunemummer, and its skins as SKINS.dunemummer, when the author lands it: a fresh
 * copy each call, from the mummer's as it is now. { id, archetype, skins, weapons, sounds, places }.
 */
export function duneMummerEntry() {
  const base = ARCHETYPES.mummer;
  const archetype = { ...copy(base), name: 'dune mummer', kind: DUNE_MUMMER_ID, was: [], status: 'trial',
    manifestation: 'a sage gourd that is head and body at once, a cream oval mask with two black slits, big rust gauntlets and boots',
    def: { ...copy(base.def), name: 'dune mummer' } };
  const skins = Object.fromEntries(Object.entries(SKINS.mummer).map(([id, s]) => [id, { ...copy(s), id }]));
  return { id: DUNE_MUMMER_ID, archetype, skins, weapons: ['club', 'spear', 'bow'], sounds: { calls: base.sound, moves: 'mummer' }, places: [], body: DUNE_MUMMER_BODY };
}
