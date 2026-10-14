// Every hint and announcement on the screen has one look and one place (issue #306, the author: "All hints and quest
// announcements should be with a black or dark black background … sometimes I see hints at the top of the screen,
// sometimes at the bottom. They should only be one way of doing it"). docs/systems/ui.md "Hints: one look, one place".
//
// The look: a near-black strip, cream letters, a button named in it in gold (or a cream badge), small round corners.
// index.html's :root carries it as --hint-bg, --hint-ink, --hint-accent, --hint-radius, --hint-top (tests/hint-look.test.js
// checks they are these values); src/ship/cinema.js's own pieces use the same variables; the Unity bridge's HUD
// (BridgeHud.cs) draws its toast and cue with the same colours in the same place.
//
// The place: the top centre, stacked down from the top by src/ship/cinema.js layoutCinema in the order they came, the
// cue first (what the use button does here, a lesson, the scout's find, a region's name), then the notices, the scenes'
// hint and the objective card. The top because most of them were there already (the notices, the quest cards, the
// objective, the scenes' hint), because the bottom is the speakers' (the subtitles, the conversation panel, a phone's
// buttons), and because a phone's layout put the cue up there already. The prompt that floats over a person or a thing
// keeps its place over them (it points at them), in the same look.

/** The strip's tokens (CSS values). bg: near-black at 92 %, ink: the paper's cream, accent: the gold of a button's name. */
export const HINT = Object.freeze({
  bg: 'rgba(18, 14, 13, 0.92)', ink: '#f7ecd2', accent: '#f2c54b', radius: '4px', top: 'calc(12px + var(--safe-top, 0px))',
});

/** The same, as numbers for an engine (the Unity bridge): rgba 0..1, the top offset in px. */
export const HINT_ENGINE = Object.freeze({ bg: [18 / 255, 14 / 255, 13 / 255, 0.92], ink: '#f7ecd2', accent: '#f2c54b', top: 12, gap: 8 });

/**
 * Every kind of hint or announcement, the element (its CSS selector) that shows it, and where: 'top' in the stack at
 * the top centre (src/ship/cinema.js layoutCinema), 'over' floating over what it is about (the use prompt).
 */
export const HINT_KINDS = Object.freeze([
  { id: 'cue', sel: '#cue', place: 'top', what: 'what the use button does here, a first lesson, the scout\'s find, Plumb\'s word, a region\'s name' },
  { id: 'toast', sel: '#toast', place: 'top', what: 'the notices: a hint, a find, a world\'s first words' },
  { id: 'quest', sel: '#toast.quest', place: 'top', what: 'a quest given: its mark, its title, its step' },
  { id: 'objective', sel: '#objective .t', place: 'top', what: 'the objective card' },
  { id: 'scene', sel: '#cine .hint', place: 'top', what: 'a scene\'s hint (in a letterbox, under its top bar)' },
  { id: 'photo', sel: '#photo', place: 'top', what: 'photo mode\'s keys' },
  { id: 'pad', sel: '#controller-hint', place: 'top', what: 'photo mode\'s buttons, a pad in hand' },
  { id: 'prompt', sel: '#prompt', place: 'over', what: 'the use button over a person or a thing' },
]);

/** The :root block of the variables (index.html carries it as written here). */
export const HINT_VARS = `--hint-bg: ${HINT.bg}; --hint-ink: ${HINT.ink}; --hint-accent: ${HINT.accent}; --hint-radius: ${HINT.radius}; --hint-top: ${HINT.top};`;
