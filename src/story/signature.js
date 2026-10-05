// The strike's signature: why the ship goes to these worlds and not others.
//
// Whatever struck the ship in the prologue (the singing light, docs/story-bible.md)
// left more than the scorched glyph on the hull: the scar is magnetised, and its
// field beats slowly in threes, like the glyph's three dots. The ship's
// instruments read that beat, and the galactic map charts only the worlds whose
// own field carries it: the worlds the singing light passed through. From each
// world you finish, the ship reads the trace a little further on (that is the
// route's unlock rule, src/story/route.js). Home does not carry it: the ship
// knows that way by heart.
//
// Where it shows (all short, all the ship's voice):
//  - after the crash, as the emergency power comes on (src/ship/cinematics.js, the prologue's hatch);
//  - the first time the map opens with power (src/ship/ship.js useConsole, flag `signature.told`);
//  - on the map: a mark on every signature world, its reading in the panel, a line of
//    explanation beside the chart (src/ship/starmap.js);
//  - when finishing a world names new ones (revealNote, the toast; main.js);
//  - out of the jump, the first time the ship comes to a world (arrivalLine, flag `signature.<id>`).
// A few people mention it in their own words (the desert, the City-Shaft, the Hangar, Lorn, the market).
//
// Pure: tests/signature.test.js checks that every world on the route carries it.

import { spoken } from './tone.js';

/** The ship's name for it, on the map. */
export const SIGNATURE = 'STRIKE SIGNATURE';

/** The line of explanation beside the chart (and its short form, for small screens). */
export const SIGNATURE_LEGEND = 'The impact left a magnetic signature in the hull: three repeating pulses. These worlds carry the same signal. Explore them to trace what struck the ship and reveal more destinations.';
export const SIGNATURE_LEGEND_SHORT = 'Only worlds that carry the strike’s magnetic signature are charted.';

/**
 * Every world on the route carries the signature. `where`: where the ship reads it
 * strongest (shown once you have been there, and said out of the jump);
 * `reading`: how it reads from orbit.
 */
export const SIGNATURE_WORLDS = {
  desert: { reading: 'in the scar itself', where: 'under the great tree' },
  incal: { reading: 'strong, and ringing', where: 'at the Lodestar, over the palace' },
  arzach: { reading: 'faint, very steady', where: 'among the humming standing stones' },
  arzach2: { reading: 'faint, on one low note', where: 'at the bell on the rose cliff' },
  garage: { reading: 'folded in on itself', where: 'at the slit in the ring' },
  buried: { reading: 'slow, one beat a year', where: 'down at the great wheel' },
  edena: { reading: 'old, overgrown', where: 'at a fallen ship in the south meadow' },
  spheres: { reading: 'many small echoes', where: 'over the round plaza' },
  perdide: { reading: 'the strongest yet', where: 'at the Great Crystal' },
  perdide2: { reading: 'faint, under water', where: 'at a saucer in the deep pool' },
  bazaar: { reading: 'on one channel only', where: 'at the silent tower' },
};

/** The world carries the strike's signature (home and the hidden places do not). */
export const hasSignature = (id) => Object.prototype.hasOwnProperty.call(SIGNATURE_WORLDS, id);

/** The reading shown in the map's panel for a world, or null (home). */
export function signatureReading(id, { visited = false } = {}) {
  const s = SIGNATURE_WORLDS[id];
  if (!s) return null;
  return visited ? `${s.reading} · strongest ${s.where}` : `${s.reading} · matches the scar`;
}

/** The toast when finishing a world names new ones on the map. */
export function revealNote(titles = []) {
  if (!titles.length) return null;
  const names = titles.join(' and ');
  return `New on the ship's map: ${names}. The ship reads the strike's signature there too.`;
}

/** The ship's line after the crash, as the emergency power comes on. */
export const CRASH_LINE = spoken('ship', "~neutral~ Emergency power online. The impact left a magnetic signature in our hull. I can track its pulse.");

/** The ship's line the first time the galactic map opens with power. */
export const MAP_LINE = spoken('ship', "~neutral~ These worlds carry the same magnetic signature as our scar. Following them may tell us what hit us.");

/** Out of the jump, the first time the ship comes to a world: null if it has said it before (or the world has none). */
export function arrivalLine(id, flag = () => undefined) {
  const s = SIGNATURE_WORLDS[id];
  if (!s || flag(`signature.${id}`)) return null;
  return spoken('ship', `~neutral~ Matching impact signature detected. Strongest ${s.where}.`, { set: { [`signature.${id}`]: true } });
}
