// The mumbled alien voices (Banjo-Kazooie / Animal Crossing style): every
// line anyone says is heard as a run of short pitched syllables in their own
// world's language, while the words you read are the translation (the
// traveller wears a translator: docs/story-bible.md, "The translator").
//
// This file is pure: it turns a line into a plan of syllables (no Web Audio),
// so the tests can check the contours. src/audio.js sings the plan
// (Sound.speak / renderSyllable).
//
//   planLine(text, { voice: voiceOf(person), tone: 'sad', lang: 'desert' })
//     → { syllables: [{ i, t, dur, pitch: [[dt, Hz]…], gain, vowel: [F1, F2], cons, breath, … }], total, cps, tone, lang }
//
// Three things shape it:
//   LANGUAGES[levelId]   the world's phonemes and voice colour (waveform, breath, speed, glide…)
//   voiceOf(person)      the speaker: pitch from `voice`, `kind` m / f, `scale` (children
//                        higher), elders slower; a hash of the id for crowd people
//   TONE_SHAPES[tone]    the tone (src/story/tone.js): contour, speed, loudness, syllable shape
//
// The dialogue panel triggers each syllable as the letters reach it (so the
// voice keeps step with the text); balloons and call subtitles play a whole
// (shorter) plan at once: speakLine / speakBalloon below.

import { parseLine } from './tone.js';

// ------------------------------------------------------------------ tones
/**
 * pitch: × the voice's pitch · range: semitones of the contour · rate: × speed
 * gain: × loudness · len: × syllable length · breath: 0 voiced .. 1 all air
 * clip: 0 smooth .. 1 clipped (fast attack, short tail) · vib: wobble (semitones)
 * glide: semitones each syllable slides · jitter: random semitones per syllable
 * contour: the shape over a sentence (CONTOURS)
 */
export const TONE_SHAPES = {
  neutral:   { pitch: 1.0,  range: 3,   rate: 1.0,  gain: 1.0,  len: 1.0,  breath: 0,    clip: 0.2, vib: 0,    glide: -0.3, jitter: 1.4, contour: 'declin' },
  happy:     { pitch: 1.12, range: 5,   rate: 1.08, gain: 1.05, len: 0.95, breath: 0,    clip: 0.1, vib: 0.15, glide: 0.8,  jitter: 2.2, contour: 'arch' },
  sad:       { pitch: 0.86, range: 4,   rate: 0.74, gain: 0.72, len: 1.4,  breath: 0.18, clip: 0,   vib: 0.25, glide: -1.6, jitter: 0.7, contour: 'fall' },
  angry:     { pitch: 0.94, range: 2.5, rate: 1.16, gain: 1.4,  len: 0.6,  breath: 0,    clip: 1,   vib: 0,    glide: -0.8, jitter: 1.8, contour: 'stab' },
  scared:    { pitch: 1.22, range: 3,   rate: 1.3,  gain: 0.82, len: 0.7,  breath: 0.12, clip: 0.5, vib: 0.7,  glide: 0.4,  jitter: 2.6, contour: 'tremble' },
  surprised: { pitch: 1.2,  range: 7,   rate: 1.1,  gain: 1.18, len: 1.0,  breath: 0,    clip: 0.2, vib: 0,    glide: 1.2,  jitter: 1.2, contour: 'jump' },
  curious:   { pitch: 1.05, range: 5,   rate: 0.98, gain: 0.95, len: 1.0,  breath: 0,    clip: 0.1, vib: 0,    glide: 0.6,  jitter: 1.4, contour: 'rise' },
  tired:     { pitch: 0.84, range: 2.5, rate: 0.7,  gain: 0.7,  len: 1.3,  breath: 0.28, clip: 0,   vib: 0.1,  glide: -1.2, jitter: 0.6, contour: 'sag' },
  solemn:    { pitch: 0.82, range: 1.5, rate: 0.76, gain: 0.92, len: 1.5,  breath: 0.05, clip: 0,   vib: 0.18, glide: -0.2, jitter: 0.4, contour: 'flat' },
  playful:   { pitch: 1.1,  range: 6,   rate: 1.15, gain: 1.0,  len: 0.82, breath: 0,    clip: 0.3, vib: 0,    glide: 1.5,  jitter: 1.0, contour: 'bounce' },
  whisper:   { pitch: 1.0,  range: 2,   rate: 0.94, gain: 0.5,  len: 0.9,  breath: 1,    clip: 0.2, vib: 0,    glide: -0.3, jitter: 1.0, contour: 'declin' },
  shout:     { pitch: 1.32, range: 4,   rate: 1.0,  gain: 1.65, len: 1.25, breath: 0.05, clip: 0.1, vib: 0,    glide: 0.4,  jitter: 1.2, contour: 'peak' },
};

/** Contours: (u 0..1 along the sentence, k syllable index, n count) → -1..1 (× range). */
const CONTOURS = {
  declin: (u) => 0.45 - 0.8 * u,
  arch: (u) => Math.sin(Math.PI * u) * 1.1 - 0.25,
  fall: (u) => 0.7 - 1.5 * u,
  stab: (u, k) => (k % 3 === 0 ? 0.85 : -0.15) - 0.3 * u,
  tremble: (u, k) => 0.35 + 0.35 * Math.sin(k * 2.7),
  jump: (u) => (u < 0.18 ? 1.25 : 0.95 - 1.1 * u),
  rise: (u) => -0.25 + 1.35 * u * u,
  sag: (u) => 0.25 - 0.9 * Math.sqrt(u),
  flat: () => 0,
  bounce: (u, k) => (k % 2 ? 0.75 : -0.35),
  peak: (u) => 0.55 + 0.35 * Math.sin(Math.PI * u),
};

// ------------------------------------------------------------------ languages
// Consonants by class: stop (a click), fric (a hiss), nasal (a hum), liquid (a scoop), '' (none).
const C = {
  p: 'stop', b: 'stop', t: 'stop', d: 'stop', k: 'stop', g: 'stop', q: 'stop', tk: 'stop', ts: 'fric',
  s: 'fric', sh: 'fric', f: 'fric', h: 'fric', kh: 'fric', z: 'fric', th: 'fric', ch: 'fric', x: 'fric',
  m: 'nasal', n: 'nasal', ng: 'nasal', l: 'liquid', r: 'liquid', w: 'liquid', y: 'liquid', bl: 'liquid', gl: 'liquid', '': '',
};
/** Vowel formants (Hz) before the speaker's and language's shift. */
export const VOWELS = { a: [780, 1220], e: [480, 1900], i: [300, 2300], o: [500, 880], u: [330, 780], ae: [660, 1720], oe: [420, 1500], y: [300, 1700] };

/**
 * Each world's tongue: a syllable inventory and a voice colour.
 * wave: oscillator · pitch / rate / len / gain: × · breath: air (0..1) · clip: 0..1
 * glide: semitones per syllable · formant: × vowel formants · density: syllables per vowel group
 * wobble: [rate Hz, semitones] (watery) · mech: ring-modulated, pitch on a grid (machines)
 * radio: band-limited (a speaker grille) · ring: a glassy overtone
 * (each tongue's writing, the glyphs the dialogue panel shows before the translation: src/story/scripts.js)
 */
export const LANGUAGES = {
  home:     { name: 'home speech', native: true, wave: 'triangle', pitch: 1.0, rate: 1.0, len: 1.05, gain: 1.0, breath: 0.04, clip: 0.1, glide: -0.2, formant: 0.95, density: 0.85,
    cons: ['m', 'n', 'l', 'b', 'd', 'h', 'w', ''], vowels: ['a', 'o', 'e', 'u', 'a'] },
  desert:   { name: 'Qanati', wave: 'triangle', pitch: 0.86, rate: 0.9, len: 1.15, gain: 0.95, breath: 0.42, clip: 0, glide: -0.9, formant: 0.88, density: 0.8,
    cons: ['h', 'kh', 's', 'r', 'n', 'm', 'd', 'q', ''], vowels: ['a', 'a', 'o', 'u', 'i'] },
  incal:    { name: 'Shaft cant', wave: 'square', pitch: 1.08, rate: 1.38, len: 0.58, gain: 0.85, breath: 0.04, clip: 1, glide: 0.5, formant: 1.08, density: 0.95,
    cons: ['k', 't', 'p', 'ts', 'ch', 'tk', 'n'], vowels: ['i', 'e', 'a', 'i'] },
  arzach:   { name: 'Vael hush', wave: 'sine', pitch: 0.9, rate: 0.62, len: 1.5, gain: 0.32, breath: 0.85, clip: 0, glide: -0.5, formant: 0.9, density: 0.35,
    cons: ['h', 'sh', 'f', ''], vowels: ['o', 'u', 'a'] },
  arzach2:  { name: 'cloud-monk chant', wave: 'sine', pitch: 0.8, rate: 0.7, len: 1.45, gain: 0.8, breath: 0.25, clip: 0, glide: 0, formant: 0.85, density: 0.6, ring: 0.25,
    cons: ['m', 'n', 'ng', 'h', 'l', ''], vowels: ['o', 'u', 'a', 'o'] },
  garage:   { name: 'Hangar clatter', wave: 'square', pitch: 1.0, rate: 1.15, len: 0.75, gain: 0.8, breath: 0, clip: 0.7, glide: 0, formant: 1.0, density: 0.9, mech: 1,
    cons: ['t', 'k', 'd', 'g', 'z', 'tk', 'b'], vowels: ['e', 'i', 'o', 'a'] },
  buried:   { name: 'Deep-wheel tongue', wave: 'sawtooth', pitch: 0.82, rate: 0.85, len: 1.0, gain: 0.8, breath: 0.15, clip: 0.4, glide: -0.6, formant: 0.82, density: 0.8,
    cons: ['g', 'd', 'r', 'b', 'm', 'k'], vowels: ['o', 'u', 'a', 'oe'] },
  edena:    { name: 'Edenic', wave: 'sine', pitch: 1.1, rate: 1.02, len: 0.95, gain: 0.95, breath: 0.08, clip: 0.1, glide: 2.2, formant: 1.1, density: 0.85,
    cons: ['l', 'w', 'y', 'f', 'm', 'n', ''], vowels: ['i', 'e', 'a', 'ae', 'u'] },
  spheres:  { name: 'Sphere-song', wave: 'sine', pitch: 1.16, rate: 0.88, len: 1.25, gain: 0.85, breath: 0.05, clip: 0, glide: 0.4, formant: 1.12, density: 0.75, ring: 0.6,
    cons: ['l', 'n', 'm', 'y', ''], vowels: ['i', 'e', 'y', 'a'] },
  perdide:  { name: 'Lorn burble', wave: 'sine', pitch: 0.96, rate: 0.92, len: 1.1, gain: 0.95, breath: 0.1, clip: 0, glide: -3.2, formant: 0.8, density: 0.85, wobble: [9.5, 1.3],
    cons: ['bl', 'gl', 'w', 'l', 'b', 'm', 'p'], vowels: ['u', 'o', 'oe', 'a'] },
  perdide2: { name: 'lamp-keeper burble', wave: 'triangle', pitch: 0.9, rate: 0.82, len: 1.2, gain: 0.9, breath: 0.12, clip: 0, glide: -2.2, formant: 0.82, density: 0.8, wobble: [7, 0.9],
    cons: ['gl', 'l', 'w', 'm', 'n', 'b'], vowels: ['o', 'u', 'a'] },
  bazaar:   { name: 'Market patter', wave: 'sawtooth', pitch: 1.04, rate: 1.22, len: 0.75, gain: 1.1, breath: 0.06, clip: 0.5, glide: 0.8, formant: 1.04, density: 0.9, radio: 0.6,
    cons: ['b', 'd', 'z', 'r', 'sh', 'p', 'y', 'n'], vowels: ['a', 'e', 'o', 'i', 'ae'] },
  atelier:  { name: 'pen-and-paper', wave: 'triangle', pitch: 1.0, rate: 0.95, len: 0.9, gain: 0.8, breath: 0.3, clip: 0.2, glide: 0.3, formant: 1.0, density: 0.75,
    cons: ['s', 'f', 'sh', 'l', 't'], vowels: ['e', 'i', 'a'] },
  // the non-humanoid peoples (src/aliens/): their own tongues, wherever they live
  // the drifters (the Garden of Spheres): slow, ringing, gliding up, a slow wobble like a bell's
  drifter:  { name: 'drifter bell-song', wave: 'sine', pitch: 0.95, rate: 0.68, len: 1.55, gain: 0.8, breath: 0.12, clip: 0, glide: 1.6, formant: 1.05, density: 0.6, ring: 0.7, wobble: [3.2, 0.9],
    cons: ['l', 'm', 'n', 'w', 'y', ''], vowels: ['o', 'u', 'oe', 'a'] },
  // the stilt-walkers (Vael): a low, breathy drone, few syllables, a little ring
  stilt:    { name: 'stilt-walker drone', wave: 'triangle', pitch: 0.7, rate: 0.58, len: 1.6, gain: 0.7, breath: 0.35, clip: 0, glide: -0.4, formant: 0.75, density: 0.4, ring: 0.35,
    cons: ['h', 'm', 'ng', 'th', ''], vowels: ['o', 'u', 'a'] },
  // the shellbacks (Lorn II): a deep, slow burr, bubbling down
  shell:    { name: 'shellback burr', wave: 'sawtooth', pitch: 0.72, rate: 0.66, len: 1.35, gain: 0.75, breath: 0.2, clip: 0.1, glide: -2.6, formant: 0.72, density: 0.75, wobble: [5.5, 0.7],
    cons: ['m', 'b', 'gl', 'r', 'w', 'd'], vowels: ['o', 'u', 'oe'] },
  // the murmurs (the Signal Market): quick and high, five voices at once (chorus: the others' pitch ×)
  murmur:   { name: 'murmur chorus', wave: 'triangle', pitch: 1.3, rate: 1.28, len: 0.62, gain: 0.7, breath: 0.08, clip: 0.4, glide: 1.0, formant: 1.2, density: 0.95, chorus: [1.26, 0.84, 1.5],
    cons: ['p', 'b', 't', 'm', 'n', 'w', 'y', ''], vowels: ['i', 'e', 'a', 'u', 'y'] },
  // the ship's own voice: a small chirping computer
  ship:     { name: 'ship', native: true, wave: 'square', pitch: 1.5, rate: 1.3, len: 0.55, gain: 0.55, breath: 0, clip: 0.9, glide: 0, formant: 1.2, density: 0.7, mech: 1,
    cons: ['t', 'p', 'd', ''], vowels: ['i', 'e'] },
};// the Lantern (src/levels/lantern.js): Ilen speaks the home tongue; nobody else lives there
LANGUAGES.lantern = LANGUAGES.home;

/** Each language's place: the City-Shaft is the Lodestar level, the Signal Market the bazaar. */
export const languageOf = (levelId) => (LANGUAGES[levelId] ? levelId : 'desert');

// ------------------------------------------------------------------ speakers
/** A small stable hash (FNV-1a) → 0..1. */
export function hash01(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * A speaker's voice from their data: { f0 (Hz), rate, formant, wobble, bright, age }.
 * person: { id, name, title, voice (≈0.45..1.7: higher is higher), kind 'm' | 'f', scale | size, age 'child' | 'elder', seed }.
 * Crowd people with no voice of their own get one from a hash of their id / seed.
 */
export function voiceOf(person = {}) {
  const key = person.seed ?? person.id ?? person.name ?? 'someone';
  const h = hash01(key), h2 = hash01(`${key}:2`);
  const v = Number.isFinite(person.voice) ? person.voice : 0.82 + h * 0.5;
  const kind = person.kind ?? (Number.isFinite(person.voice) ? (v >= 1.05 ? 'f' : 'm') : h2 < 0.5 ? 'm' : 'f');
  const scale = person.scale ?? person.size ?? 1;
  const who = `${person.name ?? ''} ${person.title ?? ''}`.toLowerCase();
  const age = person.age ?? (scale < 0.86 || /\bchild\b|\bboy\b|\bgirl\b|\bkid\b/.test(who) ? 'child'
    : /\beldest\b|\belder\b|\bold\b|\bgrand(mother|father)\b|\bancient\b/.test(who) ? 'elder' : 'adult');
  let f0 = (kind === 'f' ? 200 : 118) * Math.pow(v, 0.85);
  let rate = 1 + (v - 1) * 0.22, formant = (kind === 'f' ? 1.1 : 0.92) * Math.pow(1 / Math.max(scale, 0.5), 0.4), wobble = 0;
  if (age === 'child') { f0 *= 1.3; rate *= 1.15; formant *= 1.15; }
  if (age === 'elder') { f0 *= 0.93; rate *= 0.74; wobble = 0.3; }
  return { f0, rate: Math.min(1.4, Math.max(0.6, rate)), formant, wobble, bright: h, age, kind };
}

/** The voices on the calls home (and the traveller's own). */
export const CALL_VOICES = {
  father: { id: 'father', voice: 0.66, kind: 'm', title: 'at home' },
  mother: { id: 'mother', voice: 1.02, kind: 'f', title: 'at home' },
  you: { id: 'you', voice: 1.0, kind: 'm' },
  ship: { id: 'ship', voice: 1.0, kind: 'f' },
  lou: { id: 'lou', voice: 1.6, kind: 'f', age: 'child', scale: 0.72 },   // your daughter, there beside you (home)
  ilen: { id: 'ilen', voice: 0.92, kind: 'f' },   // your sister, there beside you at the stone (the true ending)
};
export const PLAYER_VOICE = CALL_VOICES.you;

// ------------------------------------------------------------------ the plan
const WORD = /[\p{L}\p{N}’']+/gu;
const VGROUP = /[aeiouyàáâäãåæèéêëìíîïòóôöõøùúûüœ]+/gi;
/** Letters per second the dialogue panel reveals at an even pace (a tone or a voice scales it). */
export const REVEAL_CPS = 48;

/** Letters per second for a line: the speaker's pace, the tone's, a little of the language's (readable: 31..62). */
export function revealSpeed(voice, tone = 'neutral', lang = 'home') {
  const T = TONE_SHAPES[tone] ?? TONE_SHAPES.neutral, L = LANGUAGES[lang] ?? LANGUAGES.home;
  return REVEAL_CPS * Math.min(1.3, Math.max(0.65, Math.pow(voice.rate * T.rate * Math.sqrt(L.rate), 0.75)));
}

/**
 * A *starred* span is a highlight (a place to go, a thing to do: a few words) or a quotation
 * (a letter, a recording: more than eight words, or more than one sentence).
 */
export function isQuote(span) {
  const w = String(span).replace(/<[^>]*>/g, ' ');
  return (w.match(WORD)?.length ?? 0) > 8 || /[.!?…]\s+\S/.test(w);
}

/**
 * Which characters are spoken: not (stage directions); for a narrator, only the *quoted* words
 * (narrator 'all': every starred span; otherwise the quotations, not the highlights).
 */
export function spokenMask(text, narrator) {
  const m = new Uint8Array(text.length);
  let paren = 0, star = false, quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') paren++;
    if (c === '*') {
      star = !star;
      if (star) { const end = text.indexOf('*', i + 1); quote = narrator === 'all' || isQuote(text.slice(i + 1, end < 0 ? text.length : end)); }
    }
    m[i] = paren === 0 && (!narrator || (star && quote)) ? 1 : 0;
    if (c === ')') paren = Math.max(0, paren - 1);
  }
  return m;
}

/**
 * Plan a line's syllables.
 * @param text   the words (a tone tag is read and removed if present)
 * @param o.voice  voiceOf(person) · o.tone (overrides the tag) · o.lang level id
 * @param o.max    at most this many syllables (balloons: a shorter version)
 * @param o.narrator  only *quoted* words are voiced (a recording, a broadcast)
 * @param o.cps    letters per second to place the syllables at (default: REVEAL_CPS × the speed)
 */
export function planLine(text, { voice = voiceOf({}), tone = null, lang = 'home', max = Infinity, narrator = false, cps = null } = {}) {
  const parsed = parseLine(text);
  const toneId = TONE_SHAPES[tone] ? tone : parsed.tone;
  const s = parsed.text, T = TONE_SHAPES[toneId] ?? TONE_SHAPES.neutral;
  const L = LANGUAGES[lang] ?? LANGUAGES.home;
  const rate = Math.min(1.5, Math.max(0.55, L.rate * voice.rate * T.rate));
  const speed = cps ?? revealSpeed(voice, toneId, lang);
  const mask = spokenMask(s, narrator);
  // words and the punctuation after each
  const words = [];
  for (const m of s.matchAll(WORD)) {
    if (!mask[m.index]) continue;
    const end = m.index + m[0].length;
    const tail = s.slice(end, end + 4).match(/^[^\p{L}\p{N}]*/u)[0];
    const emph = (s.slice(0, m.index).match(/\*/g)?.length ?? 0) % 2 === 1 && !narrator;
    words.push({ w: m[0], i: m.index, len: m[0].length, tail, emph });
  }
  // sentences: a contour each, and their ending (? rises, ! accents)
  const syl = [];
  let sentence = [];
  const flush = (end) => {
    const n = sentence.length;
    sentence.forEach((x, k) => { x.u = n > 1 ? k / (n - 1) : 0.5; x.end = end; x.fromEnd = n - 1 - k; });
    sentence = [];
  };
  const gap = { pause: 0 };
  for (const wd of words) {
    const groups = wd.w.match(VGROUP)?.length ?? 1;
    const hw = hash01(wd.w.toLowerCase() + lang);
    let n = Math.max(1, Math.min(4, Math.round(groups * L.density * Math.pow(L.rate, 0.3) + (hw - 0.5) * 0.6)));
    if (L.density < 0.5 && hw > L.density * 1.6) n = 0;   // a near-silent tongue leaves words out
    for (let k = 0; k < n; k++) {
      const hk = hash01(`${wd.w.toLowerCase()}#${k}${lang}`);
      const cons = L.cons[Math.floor(hk * L.cons.length) % L.cons.length];
      const vowel = L.vowels[Math.floor(hash01(`${wd.w}v${k}`) * L.vowels.length) % L.vowels.length];
      const x = { i: wd.i + Math.floor((k * wd.len) / n), cons, vowel, emph: wd.emph, wordStart: k === 0, h: hk, pause: k === 0 ? gap.pause : 0 };
      gap.pause = 0;
      syl.push(x); sentence.push(x);
    }
    const t = wd.tail;
    if (/[?!.…]/.test(t) || /—\s*$/.test(t)) { flush(/\?/.test(t) ? '?' : /!/.test(t) ? '!' : /…|\.\.\./.test(t) ? '…' : '.'); gap.pause = /…/.test(t) ? 0.3 : 0.14; }
    else if (/[,;:—]/.test(t)) gap.pause = 0.07;
  }
  flush('.');
  // a shorter version: the first syllables, and the sentence's end kept
  let list = syl;
  if (list.length > max) list = [...syl.slice(0, Math.max(1, max - 2)), ...syl.slice(-2)];
  const contour = CONTOURS[T.contour] ?? CONTOURS.declin;
  const out = [];
  let lastI = list[0]?.i ?? 0, clock = 0;   // the first syllable at 0 (whatever went before it was silent)
  list.forEach((x, k) => {
    // time: the reveal reaches its letter (in a shortened plan the syllables close up)
    const di = list === syl ? x.i - lastI : Math.min(x.i - lastI, 5);
    clock += Math.max(0, di) / speed + (list === syl ? 0 : x.pause * 0.5);
    lastI = x.i;
    let semi = contour(x.u, k, list.length) * T.range + (x.h - 0.5) * 2 * T.jitter;
    if (x.end === '?' && x.fromEnd <= 1) semi += (x.fromEnd === 0 ? 5 : 2.5) * (toneId === 'angry' ? 0.4 : 1);
    if (x.end === '!' && x.fromEnd === 0) semi += 2;
    if (x.end === '…' && x.fromEnd === 0) semi -= 2;
    if (x.emph) semi += 2.5;
    if (L.mech) semi = Math.round(semi / 2) * 2;               // machines: on a whole-tone grid
    const f0 = voice.f0 * L.pitch * T.pitch * Math.pow(2, semi / 12);
    const len = 0.085 * L.len * T.len * (x.emph ? 1.2 : 1) * (x.fromEnd === 0 && x.end !== '.' ? 1.35 : 1) / Math.sqrt(rate);
    const dur = Math.min(0.32, Math.max(0.035, len));
    const glide = L.glide + T.glide + (x.end === '?' && x.fromEnd === 0 ? 3 : 0);
    // the pitch path: a scoop for liquids, a glide, a wobble (watery tongues, elders, fear)
    const scoop = C[x.cons] === 'liquid' ? -2.5 : 0;
    const wob = L.wobble ?? [0, 0];
    const vibDepth = Math.max(wob[1], T.vib, voice.wobble), vibRate = wob[0] || (T.vib >= 0.5 ? 11 : 6.5);
    const steps = vibDepth > 0.05 ? 6 : 2;
    const pitch = [];
    for (let j = 0; j <= steps; j++) {
      const q = j / steps;
      const sm = scoop * (1 - Math.min(1, q * 4)) + glide * q + vibDepth * Math.sin(Math.PI * 2 * vibRate * q * dur + x.h * 6.28) * (q > 0 ? 1 : 0);
      pitch.push([+(q * dur).toFixed(4), +(f0 * Math.pow(2, sm / 12)).toFixed(2)]);
    }
    const F = VOWELS[x.vowel] ?? VOWELS.a, fs = voice.formant * L.formant;
    out.push({
      i: x.i, t: +clock.toFixed(4), dur: +dur.toFixed(4), f0: +f0.toFixed(2), pitch,
      gain: +(0.11 * L.gain * T.gain * (x.emph ? 1.25 : 1) * (x.end === '!' && x.fromEnd === 0 ? 1.15 : 1) * (0.9 + x.h * 0.2)).toFixed(4),
      vowel: [Math.round(F[0] * fs), Math.round(F[1] * fs)], cons: C[x.cons] ?? '', consonant: x.cons,
      breath: Math.min(1, Math.max(L.breath, T.breath)), clip: Math.min(1, Math.max(L.clip, T.clip)),
      wave: L.wave, mech: L.mech ?? 0, ring: L.ring ?? 0, radio: L.radio ?? 0, bright: voice.bright ?? 0.5,
    });
  });
  // a chorus (the murmurs speak as one): each syllable said again by the others, a little apart in time and pitch
  if (L.chorus) {
    const one = out.splice(0);
    for (const x of one) {
      out.push(x);
      L.chorus.forEach((k, j) => out.push({ ...x, t: +(x.t + 0.012 * (j + 1)).toFixed(4), f0: +(x.f0 * k).toFixed(2), pitch: x.pitch.map(([dt, f]) => [dt, +(f * k).toFixed(2)]), gain: +(x.gain * 0.5).toFixed(4), chorus: j + 1 }));
    }
  }
  const total = out.length ? Math.max(...out.slice(-4).map((x) => x.t + x.dur)) : 0;
  return { syllables: out, total, cps: speed, tone: toneId, lang, text: s };
}

/** A quick summary of a plan's shape, for tests and the dev trace: { n, mean, first, last, slope, span, rate, loud }. */
export function contourOf(plan) {
  const S = plan.syllables, n = S.length;
  if (!n) return { n: 0, mean: 0, first: 0, last: 0, slope: 0, span: 0, rate: 0, loud: 0 };
  const st = S.map((s) => 12 * Math.log2(s.f0 / 100));
  const mean = st.reduce((a, b) => a + b, 0) / n;
  const third = Math.max(1, Math.floor(n / 3));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const first = avg(st.slice(0, third)), last = avg(st.slice(-third));
  return { n, mean, first, last, slope: last - first, span: Math.max(...st) - Math.min(...st),
    rate: n / Math.max(plan.total, 0.05), loud: avg(S.map((s) => s.gain)), len: avg(S.map((s) => s.dur)), breath: avg(S.map((s) => s.breath)) };
}

// ------------------------------------------------------------------ the voice out
// Sound (src/audio.js) binds itself here, so the balloons (npc.js, crowd.js)
// and the call subtitles (ship/cinema.js) can speak without knowing about it.
let OUT = null;
export function bindVoice(sound) { OUT = sound; }
export const voiceOut = () => OUT;

/** A call-home line, as its subtitle appears: { who: 'father' | 'mother' | 'ship' | 'you' | 'scene', text, tone? }. */
export function speakLine(line) {
  if (!OUT || !line || !line.text) { OUT?.hush?.('call'); return; }
  const who = CALL_VOICES[line.who];
  if (!who) return;   // stage directions: silent
  const lang = line.who === 'ship' ? 'ship' : 'home';
  const plan = planLine(line.tone ? { text: line.text, tone: line.tone } : line.text, { voice: voiceOf(who), lang });
  OUT.speak?.(plan, { channel: 'call', radio: line.who !== 'you' && line.who !== 'lou' && line.who !== 'ilen' ? 0.55 : 0 });   // (Lou and Ilen are there: no radio)
}

/**
 * A balloon's line, heard where the speaker stands: a short version, quieter
 * with distance (silent beyond `range`), and only a couple at once.
 * @param o.person  voice data ({ voice, kind, scale } or { seed } for crowd people)
 * @param o.dist    metres from the camera · o.pan -1..1
 */
export function speakBalloon(text, { person = {}, dist = 0, pan = 0, range = 26, max = 9 } = {}) {
  if (!OUT || !text) return false;
  const k = Math.max(0, 1 - dist / range);
  if (k <= 0.05 || OUT.canSpeak?.('balloon', k * k) === false) return false;   // (checked before planning: cheap to retry next frame)
  const lang = person.lang ?? OUT.language ?? 'desert';   // (the world's tongue, or the speaker's own: an alien's)
  const plan = planLine(text, { voice: voiceOf(person), lang, max });
  // (the plan when it is sung, so the speaker's mouth can follow its syllables: src/talk-face.js)
  return (OUT.speak?.(plan, { channel: 'balloon', gain: k * k, pan }) ?? false) ? plan : false;
}
