import { TONES } from './story/tone.js';

// Facial expressions for the people's faces (Humanoid.setExpression):
//   smile     -1 (the mouth's corners down) .. 1 (up, the cheeks and lower lids lifting)
//   open       0 .. 1 the mouth opening (a dark shape under the mouth line)
//   brow      -1 (lowered and drawn together, frown creases) .. 1 (raised, lines across the forehead)
//   browTilt  -1 (the inner ends down: anger) .. 1 (inner ends up: worry, sorrow)
//   squint     0 .. 1 the lids narrowing
//   gaze      [yaw, pitch] (rad) where the eyes look, relative to the head, or null (they glance around)
// The face ink (materials.js faceInk: uMood, uMood2), the brows (morph.js browPositions)
// and the lids (MODE_EYE, Humanoid.updateEyes) follow them. Neutral changes nothing.
//
// Each dialogue tone (src/story/tone.js) has one, so a speaker can wear the tone
// of the line they say (expressionFor); talking adds the mouth's movement.

export const EXPRESSION_KEYS = [
  { key: 'smile', label: 'Smile', min: -1, max: 1, def: 0 },
  { key: 'open', label: 'Mouth open', min: 0, max: 1, def: 0 },
  { key: 'brow', label: 'Brow (furrow – raise)', min: -1, max: 1, def: 0 },
  { key: 'browTilt', label: 'Brow tilt (anger – worry)', min: -1, max: 1, def: 0 },
  { key: 'squint', label: 'Squint', min: 0, max: 1, def: 0 },
];
export const NEUTRAL_EXPRESSION = Object.freeze({ smile: 0, open: 0, brow: 0, browTilt: 0, squint: 0, gaze: null });

/** One expression per tone. */
export const TONE_EXPRESSIONS = {
  neutral: {},
  happy: { smile: 0.8, squint: 0.25, brow: 0.15 },
  sad: { smile: -0.6, browTilt: 0.85, squint: 0.15, gaze: [0, -0.18] },
  angry: { smile: -0.35, brow: -0.9, browTilt: -0.6, squint: 0.35 },
  scared: { smile: -0.25, brow: 0.75, browTilt: 0.6, open: 0.3 },
  surprised: { brow: 1, open: 0.55 },
  curious: { brow: 0.45, smile: 0.15, gaze: [0.12, 0.05] },
  tired: { squint: 0.6, smile: -0.15, brow: -0.1, gaze: [0, -0.12] },
  solemn: { smile: -0.15, brow: -0.25, squint: 0.1 },
  playful: { smile: 0.65, brow: 0.35, squint: 0.15, gaze: [-0.15, 0] },
  whisper: { open: 0.12, brow: 0.2, browTilt: 0.2, squint: 0.2 },
  shout: { open: 0.85, brow: -0.5, browTilt: -0.3, squint: 0.3 },
};
for (const t of TONES) TONE_EXPRESSIONS[t] ??= {};

/**
 * The people's faces at rest (Humanoid.restExpression): a kind face, not a somber one. The corners
 * of the mouth a little up, the brows a touch raised (never knitted), the lids easy. A tone (the
 * conversations, expressionFor) goes from there and comes back to it. (The inner ends of the brows a
 * hair up: a head bowed a little, seen from level, otherwise reads as a frown, its brows' outer ends
 * wrapping back round the skull.)
 */
export const PEOPLE_REST = Object.freeze({ smile: 0.2, open: 0, brow: 0.14, browTilt: 0.1, squint: 0, gaze: null });

/**
 * Resting moods a person can have (costumes.js: a tribe's `moods`, weights; drawn per person by
 * restMood): most people kind, curious or amused, a few calm, and some stern ones by design (guards,
 * the bell monks). Each is a whole expression at rest.
 */
export const REST_MOODS = {
  kind: { smile: 0.22, brow: 0.14, browTilt: 0.12 },
  amused: { smile: 0.34, brow: 0.1, browTilt: 0.08, squint: 0.12 },
  curious: { smile: 0.14, brow: 0.3, browTilt: 0.1 },
  calm: { smile: 0.1, brow: 0.06, browTilt: 0.06, squint: 0.05 },
  stern: { smile: -0.05, brow: -0.18, squint: 0.1 },
};
/** The moods' odds when a tribe doesn't say. */
export const REST_ODDS = { kind: 4, amused: 2, curious: 2, calm: 1.5, stern: 0.4 };

/** A resting mood for a draw u (0..1) from weights ({ mood: weight }): its name. */
export function restMood(u, odds = REST_ODDS) {
  const list = Object.entries(odds ?? REST_ODDS).filter(([k, w]) => REST_MOODS[k] && w > 0);
  const sum = list.reduce((a, [, w]) => a + w, 0);
  let t = u * sum;
  for (const [k, w] of list) if ((t -= w) <= 0) return k;
  return list.length ? list[list.length - 1][0] : 'kind';
}

/** A full expression from a partial one (clamped). */
export function cleanExpression(e = {}) {
  const out = { ...NEUTRAL_EXPRESSION };
  for (const d of EXPRESSION_KEYS) {
    const v = Number(e?.[d.key]);
    if (Number.isFinite(v)) out[d.key] = Math.min(d.max, Math.max(d.min, v));
  }
  if (Array.isArray(e?.gaze) && e.gaze.length === 2 && e.gaze.every(Number.isFinite)) out.gaze = [e.gaze[0], e.gaze[1]];
  return out;
}

/** Blend two expressions (t 0..1). */
export function mixExpression(a, b, t) {
  const A = cleanExpression(a), B = cleanExpression(b), out = { ...NEUTRAL_EXPRESSION };
  for (const d of EXPRESSION_KEYS) out[d.key] = A[d.key] + (B[d.key] - A[d.key]) * t;
  out.gaze = t < 0.5 ? A.gaze : B.gaze;
  if (A.gaze && B.gaze) out.gaze = [A.gaze[0] + (B.gaze[0] - A.gaze[0]) * t, A.gaze[1] + (B.gaze[1] - A.gaze[1]) * t];
  return out;
}

/**
 * The expression for a tone, `amount` of it (0..1), from a person's `rest` (their face at ease,
 * Humanoid.restExpression; neutral by default), and while talking (time t, s) the mouth opening and
 * closing on the syllables on top of the tone's own opening.
 */
export function expressionFor(tone, { amount = 1, talking = false, t = 0, rest = null } = {}) {
  const e = mixExpression(rest ?? NEUTRAL_EXPRESSION, { ...(rest ?? {}), ...(TONE_EXPRESSIONS[tone] ?? {}) }, amount);
  if (talking) {
    const syll = Math.max(0, Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3 + 1) * 0.4);
    const loud = tone === 'shout' ? 0.45 : tone === 'whisper' ? 0.12 : 0.28;
    e.open = Math.min(1, Math.max(e.open, e.open * 0.6 + syll * loud));
  }
  return e;
}
