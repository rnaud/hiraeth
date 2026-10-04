// The tone of a spoken line: how the mumbled alien voice says it
// (src/story/voice.js plans the syllables, src/audio.js sings them).
//
// Any line in the game may carry a tone, two ways:
//   '~sad~ The water has not risen.'          a prefix in the string (the usual way)
//   { text: 'The water has not risen.', tone: 'sad' }   (or { say: … }, or a `{ text, if }` page)
// An untagged line falls back on its punctuation (inferTone). The content is
// tagged explicitly line by line; tests/tone.test.js walks it all.
//
// Lines shown on screen go through stripTone() (the dialogue panel, balloons,
// subtitles), so a tag never shows.

export const TONES = ['neutral', 'happy', 'sad', 'angry', 'scared', 'surprised', 'curious', 'tired', 'solemn', 'playful', 'whisper', 'shout'];
const SET = new Set(TONES);
const TAG = /^\s*~([a-z]+)~\s*/;

/** The tone from punctuation alone, for an untagged line. */
export function inferTone(text) {
  const s = String(text ?? '').replace(/\([^)]*\)/g, '').trim();
  if (!s) return 'neutral';
  if (/^(…|\.\.\.)+$/.test(s)) return 'tired';
  const end = s.replace(/[”’"'*\s]+$/, '');
  if (/[?]!|![?]/.test(end.slice(-3))) return 'surprised';
  if (/!$/.test(end)) return /^[^a-z]*[A-Z]{3,}/.test(s) || (s.match(/!/g)?.length ?? 0) > 1 ? 'shout' : 'surprised';
  if (/\?$/.test(end)) return 'curious';
  if (/(…|\.\.\.)$/.test(end)) return /^(…|\.\.\.)/.test(s) ? 'sad' : 'tired';
  return 'neutral';
}

/**
 * A line (string or object) → { text (without the tag), tone, explicit }.
 * Unknown tags are kept in the text and the tone is inferred.
 */
export function parseLine(line) {
  if (line && typeof line === 'object') {
    const raw = line.text ?? line.say ?? '';
    const inner = parseLine(typeof raw === 'string' ? raw : '');
    if (SET.has(line.tone)) return { text: inner.text, tone: line.tone, explicit: true };
    return inner;
  }
  const s = String(line ?? '');
  const m = TAG.exec(s);
  if (m && SET.has(m[1])) return { text: s.slice(m[0].length), tone: m[1], explicit: true };
  return { text: s, tone: inferTone(s), explicit: false };
}

/** The words of a line, as shown (no tone tag). Objects give their text. */
export function stripTone(line) {
  if (line && typeof line === 'object') return stripTone(line.text ?? line.say ?? '');
  const s = String(line ?? '');
  const m = TAG.exec(s);
  return m && SET.has(m[1]) ? s.slice(m[0].length) : s;
}

/** Just the tone. */
export const toneOf = (line) => parseLine(line).tone;

/** Lines that came through spoken() without a tag (the tests check that it stays empty). */
export const UNTAGGED = new Set();

/**
 * A scripted line for a call or a scene: { who, text, tone, ...extra }, the tag
 * read off the text ('~sad~ …'). Untagged lines still get a tone (inferred) and
 * are noted in UNTAGGED.
 */
export function spoken(who, text, extra) {
  const p = parseLine(text);
  if (!p.explicit) UNTAGGED.add(String(text));
  return { who, text: p.text, tone: p.tone, ...(extra ?? {}) };
}
