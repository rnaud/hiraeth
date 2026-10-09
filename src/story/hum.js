// The hum: the sound everyone out on the route talks about. The chest on the great tree "started
// humming when the light passed", Vael's stones "have hummed since the light passed", the bell
// hummed without a clapper; the scar on the hull beats slowly in threes (src/story/signature.js).
// It is one sound, made by the game's Sound (src/audio.js makersHum / makersHumRise): a low sung note that swells
// three times and lifts a fifth on the third, so a player who has heard it once knows it again.
//
// Where it is heard (docs/systems/audio.md, "The hum"):
//   - the prologue: it creeps in under the father's charge, under the singing light's own theme
//     (src/story/light-theme.js: the theme starts on the note the hum lifts to), louder through the
//     pause until the light passes and the power goes (the light found his voice on the reel:
//     story-bible.md, "The glyph"), and once more, faintly, when the ship says the light left a pulse in
//     the hull (src/ship/cinematics.js);
//   - near a makers' box that hasn't been opened (Nour's chest first), every few seconds
//     (src/boxes/index.js → Sound.boxHum);
//   - whenever a line on the screen speaks of humming (a conversation, a shout, a toast, a subtitle):
//     softly, once, never more often than HUM.gap seconds (HumCue, main.js).
// Pure: the tests drive it with plain numbers.

export const HUM = {
  /** The note (Hz): D3, the desert's root an octave down. */
  root: 146.83,
  /** Its swells, and how long each lasts (s). */
  pulses: 3, pulse: 1.3,
  /** Seconds between two hums set off by words on the screen. */
  gap: 24,
  /** A makers' box is heard from this far (m), and hums again every `every` s (from .. to). */
  reach: 45, every: [8, 12],
};

const WORD = /\bhum(?:s|med|ming)?\b/i;
/** Whether a line speaks of humming ("hums", "hummed", "humming"; not "human", "humid" or "hump"). */
export const mentionsHum = (text) => WORD.test(String(typeof text === 'object' && text ? text.text ?? '' : text ?? '').replace(/~[a-z]+~/gi, ''));

/** Words on the screen → a hum, at most once every `gap` seconds. */
export class HumCue {
  constructor(gap = HUM.gap) { this.gap = gap; this.last = -Infinity; }
  /** A line went up at time `now` (s): true if the hum should play for it. */
  hear(text, now) {
    if (!mentionsHum(text) || now - this.last < this.gap) return false;
    this.last = now;
    return true;
  }
}

/**
 * Where the hum rises under the prologue's message (a callTimeline, src/ship/prologue.js): from the
 * father's charge to the cut. { from, to } in seconds of the call.
 */
export function callHum(timeline, words = 'something of value') {
  const i = timeline.lines.findIndex((l) => l.line.text.toLowerCase().includes(words));
  const from = i >= 0 ? timeline.lines[i].t0 : timeline.total;
  return { from, to: timeline.total };
}

/** How loud it is at time t of the call (0 .. 1): nothing before the charge, then growing to the cut. */
export function callHumLevel(t, { from, to }) {
  if (t < from) return 0;
  return Math.min(1, (t - from) / Math.max(0.1, to - from)) ** 1.5;
}

/** Seconds to the box's next hum (k: how near, 0 .. 1; `rand` 0 .. 1): sooner when near. */
export const boxHumWait = (k, rand = Math.random()) => {
  const [a, b] = HUM.every;
  return (a + (b - a) * rand) * (1.25 - 0.25 * Math.min(1, Math.max(0, k)));
};
