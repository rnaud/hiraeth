// The Arcade (docs/systems/minigames.md, "The Arcade"): a developer's plaza with an arcade sign for every
// game (src/levels/arcade.js, ?level=arcade). What it shares with the runner, pure (no three.js):
//
//   arcadeSigns(games)              where each game's sign stands round the plaza, and where to stand before it
//   cycleGame(games, id, step)      the game after (+1) or before (-1) one, round the list
//   arcadeHref(id)                  ?level=arcade&back=<id>: the Arcade, standing in front of that game's sign
//   arcadeLinks(from, id, games)    a game started from the Arcade (from=arcade): its cards' extra ways out
//                                   (the runner's host.links: Previous game, Next game, Back to the Arcade)

import { GAMES, gameHref } from '../index.js';

export const ARCADE = 'arcade';

/** The plaza: the signs on a ring `radius` m out, over `arc` radians from the south-west round the north to the south-east. */
export const ARCADE_RING = { radius: 14, arc: Math.PI * 1.5, stand: 2.4 };

/** The game `step` places after (+1) or before (-1) the game `id`, round the list (an id not in it: the first or the last). */
export function cycleGame(games, id, step = 1) {
  const n = games?.length ?? 0;
  if (!n) return null;
  const i = games.findIndex((g) => g.id === id);
  if (i < 0) return games[step >= 0 ? 0 : n - 1];
  return games[(((i + Math.round(step)) % n) + n) % n];
}

/** The Arcade's page, standing in front of a game's sign (none: at the way in). */
export const arcadeHref = (id = null) => `?level=${ARCADE}${id ? `&back=${encodeURIComponent(id)}` : ''}`;

/**
 * Each game's sign: { id, pos: [x, 0, z], heading (it faces the middle), stand: [x, 0, z] (a few steps in
 * front of it), standHeading (the traveller facing it) }, in the games' order, left to right as you come in
 * from the south.
 */
export function arcadeSigns(games, { radius = ARCADE_RING.radius, arc = ARCADE_RING.arc, stand = ARCADE_RING.stand } = {}) {
  const n = games?.length ?? 0;
  return (games ?? []).map((g, i) => {
    const a = n > 1 ? -arc / 2 + (arc * i) / (n - 1) : 0;   // (0: north; negative: west)
    const x = Math.sin(a) * radius, z = -Math.cos(a) * radius;
    const heading = Math.atan2(-x, -z);   // (its face toward the middle)
    const k = (radius - stand) / radius;
    return { id: g.id, pos: [x, 0, z], heading, stand: [x * k, 0, z * k], standHeading: heading + Math.PI };
  });
}

/** Where to stand coming back from game `id` (?back=<id>): its sign's stand, or null. */
export function returnSpot(signs, id) {
  const s = id ? signs.find((q) => q.id === id) : null;
  return s ? { pos: s.stand, heading: s.standHeading } : null;
}

/**
 * The runner's host.links for a game page (src/minigames/kit/runner.js): null unless it was started from
 * the Arcade; then Quit is "Back to the Arcade" (in front of this game's sign) and the cards have the
 * previous and the next game ([ and ], LB / RB).
 */
export function arcadeLinks(from, id, games = GAMES) {
  if (from !== ARCADE) return null;
  const extra = [];
  if (games.length > 1) {
    const prev = cycleGame(games, id, -1), next = cycleGame(games, id, 1);
    extra.push({ id: 'prev', step: -1, label: 'Previous game', sub: prev.name, href: gameHref(prev.id, ARCADE) });
    extra.push({ id: 'next', step: 1, label: 'Next game', sub: next.name, href: gameHref(next.id, ARCADE) });
  }
  return { quit: { label: 'Back to the Arcade', href: arcadeHref(id) }, extra };
}
