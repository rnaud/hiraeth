// The light's signature: why the ship goes to these worlds and not others.
//
// The singing light passed the ship in the prologue close enough to drain its power
// (docs/story-bible.md) and left more than the glyph scorched on the hull where it brushed
// by: the scar is magnetised, and its
// field beats slowly in threes, like the glyph's three dots. The ship's
// instruments read that beat, and the galactic map charts only the worlds whose
// own field carries it: the worlds the singing light passed through. From each
// world you finish, the ship reads the trace a little further on (that is the
// route's unlock rule, src/story/route.js). Home does not carry it: the ship
// knows that way by heart. Following it is the traveller's own choice: he tells the ship to,
// as it comes down (FOLLOW_LINE).
//
// Where it shows (all short, all the ship's voice):
//  - after the landing, as the emergency power comes on, and his answer (src/ship/cinematics.js, the prologue's hatch);
//  - the first time the map opens with power (src/ship/ship.js useTable, flag `signature.told`);
//  - on the map: a mark on every signature world, its reading in the panel, a line of
//    explanation beside the chart (src/ship/starmap.js);
//  - when finishing a world names new ones (revealNote, the toast; main.js);
//  - out of the jump, the first time the ship comes to a world (arrivalLine, flag `signature.<id>`).
// A few people mention it in their own words (the desert, the City-Shaft, the Hangar, Lorn, the market).
//
// Pure: tests/signature.test.js checks that every world on the route carries it.

import { spoken } from './tone.js';

/** The ship's name for it, on the map. */
export const SIGNATURE = 'LIGHT SIGNATURE';

/** The line of explanation beside the chart (and its short form, for small screens). */
export const SIGNATURE_LEGEND = 'The singing light left a magnetic signature on the hull as it passed: three repeating pulses. These worlds carry the same signal. Explore them to follow the light and reveal more destinations.';
export const SIGNATURE_LEGEND_SHORT = 'Only worlds that carry the singing light’s magnetic signature are charted.';

/**
 * Every world on the route carries the signature. `where`: where the ship reads it
 * strongest (shown once you have been there, and said out of the jump);
 * `reading`: how it reads from orbit.
 */
export const SIGNATURE_WORLDS = {
  desert: { reading: 'in the scar itself', where: 'under the great tree' },
  incal: { reading: 'strong, and ringing', where: 'at the Lodestar, over the palace' },
  arzach: { reading: 'faint, very steady', where: 'among the humming standing stones' },
  // (the worlds you fly to: Vael carries the sky stones since October 2026, their reading 'faint, on one low note, at the bell
  // on the rose cliff'; Lorn the Deep Wood, 'faint, under water, at a saucer in the deep pool'; the Sealed Hangar, dismissed,
  // read 'folded in on itself, at the slit in the ring', and the Glass Dunes took its place)
  glassdunes: { reading: 'held in the glass, ticking', where: 'at the Clock-House east of the valley' },
  buried: { reading: 'slow, one beat a year', where: 'down at the great wheel' },
  edena: { reading: 'old, overgrown', where: 'at a fallen ship in the south meadow' },
  spheres: { reading: 'many small echoes', where: 'over the round plaza' },
  perdide: { reading: 'the strongest yet', where: 'at the Great Crystal' },
  bazaar: { reading: 'on one channel only', where: 'at the silent tower' },
};

/** The world carries the light's signature (home and the hidden places do not). */
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
  return `New on the ship's map: ${names}. The ship reads the light's signature there too.`;
}

/** The ship's line after the landing, as the emergency power comes on. */
export const LANDING_LINE = spoken('ship', "~neutral~ Emergency power online. Whatever passed us drained the core and left a magnetic signature on the hull. I can track its pulse.");
/** His answer: following the light is his own choice, not the ship's. */
export const FOLLOW_LINE = spoken('you', "~whisper~ Then track it. When we can fly, we follow it. I want to hear it again.");

/** The ship's line the first time the galactic map opens with power. */
export const MAP_LINE = spoken('ship', "~neutral~ These worlds carry the same magnetic signature as our scar. You asked me to follow the singing light: it went this way.");

/** Out of the jump, the first time the ship comes to a world: null if it has said it before (or the world has none). */
export function arrivalLine(id, flag = () => undefined) {
  const s = SIGNATURE_WORLDS[id];
  if (!s || flag(`signature.${id}`)) return null;
  return spoken('ship', `~neutral~ The singing light’s signature, here too. Strongest ${s.where}.`, { set: { [`signature.${id}`]: true } });
}
