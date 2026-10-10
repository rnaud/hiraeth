// Ink (docs/systems/foes.md, "Ink and the blade's growth"): what the foes leave when they are cut down.
// The blots are the drawing's unfinished margins, gathered thickest where the singing light passed;
// cut down, their ink runs into the glove, and the blade grows with what it has taken in. Kept per
// save (flag ink), it never goes down: each step is had once reached.
//
//   gainInk(n, { game, notice })   adds n; says the steps reached (and every INK.every on the way)
//   inkOf(game) · hasUpgrade(id, game)

import { game as sharedGame } from './game-state.js';
import { hintsFor } from './hint-level.js';

export const INK = { every: 5 };
/** The blade's steps, in order: how much ink each wants, and what is said when it is reached. */
export const UPGRADES = [
  { id: 'reach', at: 8, text: 'The ink settles in the glove: the fluid blade reaches further.' },
  { id: 'whirl', at: 20, text: 'The ink runs deeper: the third swing of the blade is a whirl now, cutting all round you.' },
  { id: 'lunge', at: 40, text: 'The glove is dark with ink: swing the blade while running and you lunge into the cut.' },
];
/** What each foe leaves. */
export const INK_OF = { blot: 1, toad: 2, skitter: 0.34, machine: 3, shade: 4, ray: 2, worm: 2, centipede: 3, jelly: 2, brute: 4, splinter: 0.34, moth: 0.5, drone: 2, rootknot: 3, heron: 2, crab: 3, cart: 4, bell: 4, hound: 2 };

export const inkOf = (game = sharedGame) => game.flag('ink') ?? 0;
export const hasUpgrade = (id, game = sharedGame) => inkOf(game) >= (UPGRADES.find((u) => u.id === id)?.at ?? Infinity);

/** Add ink; returns the steps newly reached (and says them, and the count every INK.every). */
export function gainInk(n, { game = sharedGame, notice = null } = {}) {
  const was = inkOf(game), now = Math.round((was + n) * 100) / 100;
  game.set('ink', now);
  const reached = UPGRADES.filter((u) => was < u.at && now >= u.at);
  for (const u of reached) notice?.(u.text);
  if (!was && now > 0) notice?.('The blot leaves its ink, and it runs into the glove. Gather enough and the blade grows.');
  else if (!reached.length && Math.floor(now / INK.every) > Math.floor(was / INK.every) && hintsFor('tip')) {   // (the count on the way: hints full)
    const next = UPGRADES.find((u) => now < u.at);
    notice?.(next ? `Ink ${Math.floor(now)} of ${next.at}.` : `Ink ${Math.floor(now)}.`);
  }
  return reached;
}
