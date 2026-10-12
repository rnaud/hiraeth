import { registerInteractable, PRIORITY } from '../interact.js';
import { THINGS } from './desert-data.js';

// The giants' road (src/desert-giants.js builds it; issue #167): at each of the four fallen giants out on the dunes a
// pilgrims' shrine, and on its stone a verse of the Speaker's old words. Read outward from Qanat (I at the hand, IV
// under the jaw) they tell the giants' road backward, from the last of them under the city to where they came from;
// the fourth points on, toward the swamp of lights (the Speaker's clue, clue.desert.perdide). Nothing is asked of
// you: a look, one verse each (desert.giants.verse1-4).
//
//   const giants = setupGiants(ctx)   →   { verses: [def…] } (null without the road)

export const VERSES = [THINGS.verse1, THINGS.verse2, THINGS.verse3, THINGS.verse4];

export function setupGiants(ctx) {
  const { level, dialogue } = ctx;
  const R = level.giants;
  if (!R) return null;
  R.shrines.forEach((s, i) => {
    const def = VERSES[i];
    registerInteractable({ id: `giants.verse${i + 1}`, priority: PRIORITY.use, range: 2.8, at: () => s.look, prompt: 'read the verse',
      distance: (p) => (Math.abs(p.pos.y - s.at.y) < 3 ? Math.hypot(p.pos.x - s.look.x, p.pos.z - s.look.z) : Infinity),
      use: () => dialogue.start(def, null, s.stand.clone(), s.look.clone()) });
  });
  return { verses: VERSES };
}
