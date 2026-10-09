// The singing light's theme: the few notes the light sings, so a player who has heard it once in the
// prologue knows it again (docs/systems/audio.md, "The singing light's theme"; the Suno brief is there).
//
// Five notes in D lydian, about six seconds, a wordless high voice:
//
//   A4 · D5 E5 · G♯5 ~ F♯5
//   1    ½  ½    2     3      beats at 66 a minute (a short-short in the middle, a long rise, a longer fall)
//
// It starts on A, where the makers' hum lifts on its third swell (src/story/hum.js: D3 up a fifth), so
// the two are kin: the hum is the light's low breath, the theme its voice. It climbs through the raised
// fourth (G♯, the lydian note: a question nobody at home would sing), glides into it from a quarter tone
// under, and settles on F♯, the major third, unresolved. The father's theme (src/score.js FATHER_THEME:
// D F♯ A G A) is the same key and a different shape: the light sings his key, not his tune, until the
// Lantern says why (Ilen sang his message into it).
//
// Where it is heard: the prologue, over the father's voicemail, nearer each time; the traveller pauses
// the recording to hear it alone; then it passes the ship (louder, its pitch falling as it goes by) and
// the ship's power goes with it (src/ship/cinematics.js). A recorded version (src/soundtracks.js CUES,
// public/music/singing-light.mp3) replaces the synth when it is there; until then audio.js sings it.
// Pure: the tests drive it with plain numbers.

export const LIGHT_THEME = {
  /** D4 (Hz): the notes are semitones over it. */
  root: 293.66,
  mode: 'D lydian',
  bpm: 66,
  /** [semitones over D4, beats, glide-in from a quarter tone under] */
  notes: [[7, 1, false], [12, 0.5, false], [14, 0.5, false], [18, 2, true], [16, 3, false]],
};

/** Seconds a beat. */
export const lightBeat = (bpm = LIGHT_THEME.bpm) => 60 / bpm;

/** The theme's length (s) at `spb` seconds a beat. */
export const lightLength = (spb = lightBeat()) => LIGHT_THEME.notes.reduce((a, [, b]) => a + b, 0) * spb;

/**
 * The theme as notes from `at` (s): [{ t, dur, f, glide }], `transpose` semitones up (12: an octave),
 * `spb` seconds a beat.
 */
export function lightThemeNotes({ at = 0, transpose = 0, spb = lightBeat(), short = false } = {}) {
  let t = at;
  // short: its first four notes, quicker, the rise cut off before it settles (under 1.7 s: the galactic map's
  // signature search sings it as the scanner nears a world, src/story/signature-search.js signatureNotes)
  const notes = short ? LIGHT_THEME.notes.slice(0, 4).map(([s, b, g], i) => [s, i === 3 ? 1 : b, g]) : LIGHT_THEME.notes;
  if (short) spb *= 0.6;
  return notes.map(([semi, beats, glide]) => {
    const n = { t, dur: beats * spb, f: LIGHT_THEME.root * 2 ** ((semi + transpose) / 12), glide };
    t += beats * spb;
    return n;
  });
}

/**
 * When the theme sounds over the prologue's voicemail (a callTimeline, src/ship/prologue.js): three times,
 * each nearer: faint and high under his first words, nearer under "still disappointed", nearest under the
 * charge. [{ t, vol, transpose }] in seconds of the call; the pause and the pass sing it after (cinematics.js).
 */
export function lightCues(timeline) {
  const L = timeline.lines;
  const at = (i, d = 0.4) => (L[Math.min(i, L.length - 1)]?.t0 ?? 0) + d;
  const charge = L.findIndex((l) => /something of value/i.test(l.line.text));
  const c = charge >= 0 ? charge : L.length - 2;
  return [
    { t: at(1, 1.2), vol: 0.22, transpose: 12 },
    { t: at(c - 1, 0.6), vol: 0.45, transpose: 0 },
    { t: at(c, 0.2), vol: 0.75, transpose: 0 },
  ];
}

/**
 * The theme's loudness over the opening, for a recorded version played once from the call's start
 * (src/audio.js playCue): [[t, gain]] in seconds from the call's start, given the call's length, the pause
 * and the pass (s). It follows the synth's cues: faint, nearer, nearest, alone in the pause, loudest in the pass.
 */
export function lightEnvelope(timeline, { pause = 0, pass = 0 } = {}) {
  const cues = lightCues(timeline), end = timeline.total;
  return [
    [0, 0], ...cues.map((c) => [c.t, c.vol]),
    [end, 0.8], [end + pause, 0.9], [end + pause + pass * 0.5, 1], [end + pause + pass, 0.3], [end + pause + pass + 2, 0],
  ];
}
