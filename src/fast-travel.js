import { leaveRefusal } from './story/leave-gate.js';
import { partOf } from './levels/names.js';

// Fast travel from the game menu's Worlds page (v1.62, issue #213: "fast travel from the worlds page to the world's
// landing only"; docs/systems/ui.md): on a world you have already been to, not the one you are in, its full view's
// A / × "Travel here" sends the ship there by the galactic map's own way (src/ship/ship.js travel: the take-off, then
// the arrival at that world's landing, the saves as they are). The same leave gates hold (src/story/leave-gate.js,
// issue #217: the desert without the blade and the guard, Vael without the wings): the ship says no in its own line,
// shown under the button, and the quest that leads to them starts if it hadn't (main.js 'travel:refused').
//
//   fastTravel.can({ to, from, seen, flag })     → true where "Travel here" shows
//   fastTravel.refusal({ to, from, seen, flag }) → null (the ship goes) | { text, missing?, quest? }
//
// `seen(id)`: a world you have been to (the journal's); `flag(k)`: the save's.

export const fastTravel = {
  /** "Travel here" shows: the ship has power, you have been there, and it is not where you are. */
  can({ to, from, seen = () => false, flag = () => false } = {}) {
    return !!to && !!flag('ship.powered') && !!seen(to) && partOf(to) !== partOf(from);
  },
  /** Why the ship won't go (null: it will). */
  refusal({ to, from, seen = () => false, flag = () => false } = {}) {
    if (!to || partOf(to) === partOf(from)) return { text: 'You are here.' };
    if (!flag('ship.powered')) return { text: 'No power. The engines are cold.' };
    if (!seen(to)) return { text: 'Not there yet. The ship goes only where you have been.' };
    const no = leaveRefusal(from, to, (id) => !!flag(`item.${id}`));
    return no ? { text: no.line.text, missing: no.missing, quest: no.quest } : null;
  },
};
