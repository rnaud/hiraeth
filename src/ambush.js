// The chime-pirates between worlds (docs/systems/minigames.md, "Pirates between worlds"): the first time the ship
// flies from one world to one the traveller has never been to, pirates come after it on the way, and the flight is
// the rail shooter (src/minigames/pirates.js) before the landing. Later trips to that world fly straight there.
//
//   ambushDue({ to, flag, seen, settings })   should this flight be ambushed?
//   ambushHref(to, from)                       the game's page for it: '?game=pirates&to=<to>&from=<from>'
//   arrivalHref(to)                            where the flight lands, after: '?level=<to>&via=ship'
//   transitLinks(query, titles)                the runner's ways out on that page (Fly on once won; no skip)
//
// The save keeps one flag per destination, `ambush.<to>`: 'met' as the fight's page opens (so a crash or a closed
// tab never sends you round it again), 'won' as it is won ('skipped' in saves from before v1.45, when it could be). A world already visited (the journal's
// seen, which old saves have) is never ambushed, so saves from before the pirates need no migration.
// Pure (tests/ambush.test.js).

/** The game that plays the ambush (src/minigames/pirates.js). */
export const AMBUSH_GAME = 'pirates';
/** The save's flag for a destination. */
export const ambushKey = (to) => `ambush.${to}`;
/** Places never ambushed: home (its homecoming is its own page) and the Lantern (the last chapter's own flight). */
export const NO_AMBUSH = new Set(['home', 'lantern']);

/**
 * Should the flight to `to` be ambushed? Not in the calm game
 * (Enemies off); not to a world visited before (seen(to)) or already ambushed on the way to (its flag); not home.
 */
export function ambushDue({ to, flag = () => undefined, seen = () => false, settings = {} } = {}) {
  if (!to || NO_AMBUSH.has(to)) return false;
  // (the calm game, Enemies off, has no fights anywhere; the setting that turned the pirates off alone went with the
  // skip in v1.45, issue #88)
  if (settings?.enemies === 'off') return false;
  if (flag(ambushKey(to))) return false;
  if (seen(to)) return false;
  return true;
}

/** How many ambushes the save has met (each a little fiercer: src/minigames/pirates-rules.js newRun heat). */
export function ambushCount(flags = {}) {
  return Object.keys(flags).filter((k) => k.startsWith('ambush.') && flags[k]).length;
}

export const ambushHref = (to, from = null) => `?game=${AMBUSH_GAME}&to=${encodeURIComponent(to)}${from ? `&from=${encodeURIComponent(from)}` : ''}`;
export const arrivalHref = (to) => `?level=${encodeURIComponent(to)}&via=ship`;

/**
 * On the ambush's page (?game=pirates&to=<id>), the runner's ways out (kit/runner.js host.links): none but through it
 * (`mandatory`, v1.45, issue #88: "I shouldn't be able to skip it"; until then Skip the fight sat on every card, and
 * first after two lost runs). Lost, Retry picks up from the last checkpoint (src/minigames/pirates-rules.js
 * CHECKPOINTS, MERCY: kinder each time, and from the third loss the hull holds, so every fight can be won); won, Fly
 * on (the results' main button). Null on the game's own page (the Debug menu's, the Arcade's: no `to`).
 */
export function transitLinks(query, titles = {}) {
  const to = query?.get?.('to');
  if (!to) return null;
  const title = titles[to] ?? to;
  const href = arrivalHref(to);
  return {
    to, title, mandatory: true,
    retry: { label: 'Retry from the checkpoint' },
    win: { label: `Fly on to ${title}`, href },
    intro: { kicker: `On the way to ${title}`, lead: { ...AMBUSH_LINES.start, name: SPEAKERS[AMBUSH_LINES.start.who] } },
  };
}

/**
 * What is said on the way, each with its tone (src/story/tone.js): the ship's voice (who: 'ship', as in its other
 * scenes, src/ship/cinematics.js) and the pirates' captain on an open channel.
 */
export const AMBUSH_LINES = {
  start: { who: 'ship', text: 'Ships closing from behind. Pirates! They are after your chimes!', tone: 'scared' },
  hauler: { who: 'ship', text: 'A hauler, laying mines. Shoot them before they reach us.', tone: 'neutral' },
  captain: { who: 'captain', text: 'Heave to, little ship! Every chime aboard, and we part friends.', tone: 'playful' },
  open: { who: 'ship', text: 'Her guns are down. The bridge is open!', tone: 'surprised' },
  low: { who: 'ship', text: 'Hull failing. Roll away from their fire!', tone: 'scared' },
  won: { who: 'ship', text: 'They are breaking off. Your chimes are safe. Resuming course.', tone: 'happy' },
  fled: { who: 'captain', text: 'Keep your chimes, then! The dark is wide, and we are patient.', tone: 'angry' },
  lost: { who: 'ship', text: 'Hull breached. Falling back to try again.', tone: 'sad' },
};
/** The name shown over a line. */
export const SPEAKERS = { ship: 'The ship', captain: 'Pirate captain' };
