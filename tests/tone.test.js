// Every line in the game carries a tone (src/story/tone.js), and the mumbled
// voice (src/story/voice.js) says each tone, world and speaker differently.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TONES, parseLine, inferTone, stripTone, UNTAGGED } from '../src/story/tone.js';
import { planLine, contourOf, voiceOf, LANGUAGES, CALL_VOICES, TONE_SHAPES, REVEAL_CPS } from '../src/story/voice.js';
import { SCRIPTS } from '../src/story/scripts.js';

const { CONTENT, ERRANDS } = await import('../src/levels/content.js');
const crowd = await import('../src/crowd.js');
const npc = await import('../src/npc.js');
const { callLines, PROLOGUE_CALL, CALL_COUNT, ILEN_CALL, TRACE_CALL, ILEN_AFTER_CALL } = await import('../src/story/calls.js');
const { tombLines, tokenList, TOKEN_ITEMS, choiceLines, ilenOnChoices } = await import('../src/story/ending.js');

const SRC = new URL('../src/', import.meta.url);
const DATA = readdirSync(new URL('story/', SRC)).filter((f) => f.endsWith('-data.js'));
const LEVELS = readdirSync(new URL('levels/', SRC)).filter((f) => f.endsWith('.js'));
const STORY = readdirSync(new URL('story/', SRC)).filter((f) => f.endsWith('.js') && !f.endsWith('-data.js'));
const SPOKEN_LISTS = /LINES|MURMURS|_TALK/;
const NOT_SPOKEN = new Set(['QUESTS', 'ITEMS', 'KEEPSAKE', 'MACHINES', 'SOUNDS', 'STAGE_MIGRATION', 'STAGE_MERGE', 'SIGNAL', 'CAIRN_STONES', 'BOARD_GLYPH']);

/** Every spoken string under a value: say pages, choice texts, bye, lines, and all strings of a spoken list. */
function collect(v, where, out, all = false, seen = new Set()) {
  if (v == null || typeof v === 'function') return out;
  if (typeof v === 'string') { if (all) out.push([where, v]); return out; }
  if (typeof v !== 'object' || seen.has(v)) return out;
  seen.add(v);
  if (Array.isArray(v)) { v.forEach((x, i) => collect(x, `${where}[${i}]`, out, all, seen)); return out; }
  for (const [k, x] of Object.entries(v)) {
    const at = `${where}.${k}`;
    if (k === 'if' || k === 'after' || k === 'do' || k === 'entry' || k === 'palette' || k === 'set') continue;
    if (k === 'say' && (typeof x === 'string' || Array.isArray(x))) {
      for (const [i, p] of [x].flat().entries()) out.push([`${at}[${i}]`, typeof p === 'object' ? p.text : p]);
    } else if (k === 'listen' && Array.isArray(x)) {
      // listen-only talk (src/story/dialogue.js pickListen): each entry a line, a few lines, or { say }
      for (const [i, e] of x.entries()) for (const [j, p] of [e && typeof e === 'object' && 'say' in e ? e.say : e].flat().entries()) out.push([`${at}[${i}][${j}]`, typeof p === 'object' ? p.text : p]);
    } else if (k === 'choices' && Array.isArray(x)) {
      for (const [i, c] of x.entries()) out.push([`${at}[${i}]`, c.text]);
      for (const c of x) collect(c, at, out, false, seen);
    } else if ((k === 'bye' || k === 'ask' || k === 'wait' || k === 'thanks') && typeof x === 'string') out.push([at, x]);
    else if (k === 'lines' && Array.isArray(x) && x.every((l) => typeof l === 'string')) x.forEach((l, i) => out.push([`${at}[${i}]`, l]));
    else if (k === 'crowdLines' && Array.isArray(x)) x.forEach((l, i) => out.push([`${at}[${i}]`, l]));
    else if (typeof x === 'object') collect(x, at, out, all, seen);
    else if (all && typeof x === 'string' && !['id', 'name', 'title', 'color', 'kind', 'lang', 'age', 'head', 'goto', 'node'].includes(k)) out.push([at, x]);
  }
  return out;
}

const untagged = (list) => list.filter(([, s]) => !parseLine(s).explicit).map(([w, s]) => `${w}: ${String(s).slice(0, 60)}`);

test('tones: a tag, an object, or punctuation; tags never show', () => {
  assert.deepEqual(parseLine('~sad~ The well is dry.'), { text: 'The well is dry.', tone: 'sad', explicit: true });
  assert.deepEqual(parseLine({ text: 'Hush.', tone: 'whisper' }), { text: 'Hush.', tone: 'whisper', explicit: true });
  assert.equal(parseLine({ say: '~shout~ Hey!' }).tone, 'shout');
  assert.equal(parseLine('~nonsense~ Hi.').explicit, false, 'unknown tags are not tones');
  assert.equal(stripTone('~happy~ Sit, sit.'), 'Sit, sit.');
  assert.equal(stripTone('No tag.'), 'No tag.');
  // the fallback for an untagged line
  assert.equal(inferTone('Where is the well?'), 'curious');
  assert.equal(inferTone('It opened!'), 'surprised');
  assert.equal(inferTone('FETCH NOUR! NOW!'), 'shout');
  assert.equal(inferTone('…'), 'tired');
  assert.equal(inferTone('I waited so long…'), 'tired');
  assert.equal(inferTone('Mind the sparks.'), 'neutral');
  for (const s of ['x', 'Why?', 'Oh!', '…', '']) assert.ok(TONES.includes(inferTone(s)));
  assert.equal(TONES.length, 12);
  for (const t of TONES) assert.ok(TONE_SHAPES[t], `${t} has a shape`);
});

test('every conversation, balloon and crowd line in the story data is tagged with a tone', async () => {
  let total = 0;
  for (const f of DATA) {
    const m = await import(new URL(`story/${f}`, SRC));
    const list = [];
    for (const [k, v] of Object.entries(m)) {
      if (NOT_SPOKEN.has(k)) continue;
      collect(v, `${f}:${k}`, list, SPOKEN_LISTS.test(k));
    }
    assert.ok(list.length > 20, `${f} has lines`);
    assert.deepEqual(untagged(list), [], `${f}: every line has a tone`);
    for (const [, s] of list) assert.ok(TONES.includes(parseLine(s).tone));
    total += list.length;
  }
  assert.ok(total > 2000, `${total} lines`);
});

test('every level’s people, errands and crowd lines are tagged', async () => {
  const list = [];
  for (const [id, c] of Object.entries(CONTENT)) collect({ npcs: c.npcs, crowdLines: c.crowdLines }, `CONTENT.${id}`, list);
  collect(ERRANDS, 'ERRANDS', list);
  // crowd lines written straight into a level's builder (e.g. bazaar.js): read from the source
  for (const f of LEVELS) {
    const src = readFileSync(new URL(`levels/${f}`, SRC), 'utf8');
    for (const m of src.matchAll(/crowdLines:\s*\[([^\]]*)\]/g)) for (const s of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) list.push([`${f}:crowdLines`, s[1]]);
  }
  for (const k of ['STARTLE_LINES', 'SPLASH_LINES', 'SHOVE_LINES', 'SINGE_LINES', 'GREET_LINES']) crowd[k].forEach((s, i) => list.push([`crowd.${k}[${i}]`, s]));
  for (const k of ['SPLASHED', 'SHOVED', 'SINGED']) npc[k].forEach((s, i) => list.push([`npc.${k}[${i}]`, s]));
  assert.ok(list.length > 150, `${list.length} lines`);
  assert.deepEqual(untagged(list), []);
});

test('the story scripts’ own shouts and balloon lines are tagged (source scan)', () => {
  const bad = [];
  for (const f of STORY) {
    const src = readFileSync(new URL(`story/${f}`, SRC), 'utf8');
    const pats = [/shout = \{ text: ([^,]+?), until/g, /\bsay\(\w+(?:\.\w+)*, ('(?:[^'\\]|\\.)*')/g, /\.lines = \[([^\]]*)\]/g, /const line = [^;]*?\? ('(?:[^'\\]|\\.)*')/g];
    for (const re of pats) for (const m of src.matchAll(re)) {
      for (const s of m[1].replace(/[!=]== '[^']*'/g, '').matchAll(/'((?:[^'\\]|\\.)*)'/g)) if (!parseLine(s[1]).explicit) bad.push(`${f}: ${s[1]}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('every recording and every word at the stone has a tone', () => {
  const flagsets = [
    {}, { 'clue.bazaar.home': true }, { 'calls.ilen.asked': true, 'calls.ilen.told': true }, { 'calls.ilen.told': true, 'calls.home': true },
    { 'desert.rumour.light': true, 'incal.rumour.light': true, 'arzach.rumour.light': true, 'arzach2.rumour.light': true, 'clue.edena.struck': true, 'clue.buried.mark': true, 'arzach2.bell.note': true, 'bird.promise': true, 'perdide2.promise': true },
    { 'ending.done': true }, { 'calls.home': true }, { 'edena.terraces.flooded': true },
    { 'ending.done': true, 'world.bazaar.done': true }, { 'ending.done': true, 'finale.met': true, 'calls.ilen.told': true }, { 'ending.done': true, 'ending.final': true },
  ];
  const keepsakes = [null, ...['thing', 'song', 'word', 'person', 'knowing'].map((kind) => ({ id: `x.${kind}`, level: 'desert', name: `A ${kind}`, kind, text: '“A word.”' })), { id: 'bazaar.word', kind: 'word', name: 'You are not alone', text: '“You are not alone.”' }];
  const lines = [...PROLOGUE_CALL];
  for (const flags of flagsets) for (const k of keepsakes) for (const n of [...Array.from({ length: CALL_COUNT }, (_, i) => i + 1), ILEN_CALL, ILEN_AFTER_CALL, TRACE_CALL]) {
    lines.push(...callLines(n, { flag: (f) => flags[f], keepsake: k, keepsakes: k ? [k, k] : [], completed: ['desert', 'incal'], lastWorld: 'desert', worldTitle: 'The Desert' }));
  }
  const tokens = tokenList([...['thing', 'song', 'word', 'person', 'knowing'].map((kind) => ({ id: `y.${kind}`, name: `A ${kind}`, kind, text: '“A word.”' })), { id: 'bazaar.word', kind: 'word', name: 'Words' }], TOKEN_ITEMS);
  const choices = [{ token: 'returned', promise: 'kept', broke: true }, { token: 'kept', promise: 'made' }, { promise: 'declined' }];
  for (const ctx of [{}, { ilenTold: true }, { ilenTold: true, lou: true, broke: true }, ...choices.flatMap((c) => [{ choices: c, lou: true }, { choices: c, final: true, lou: true }, { choices: c, final: true }])]) {
    lines.push(...tombLines(tokens, ctx)); lines.push(...tombLines([], ctx));
  }
  for (const c of choices) lines.push(...choiceLines(c), ...ilenOnChoices(c));
  assert.ok(lines.length > 400);
  assert.deepEqual([...UNTAGGED], [], 'every scripted line came with its tone');
  for (const l of lines) {
    assert.ok(TONES.includes(l.tone), `${l.text}: ${l.tone}`);
    assert.ok(!/^~/.test(l.text), 'the tag is not in the subtitle');
  }
  assert.ok(PROLOGUE_CALL.some((l) => /translator/.test(l.text)), 'the father mentions the translator');
});

test('the lines said on the way between worlds (the chime-pirates: the ship, their captain) carry tones', async () => {
  const { AMBUSH_LINES } = await import('../src/ambush.js');
  const lines = Object.values(AMBUSH_LINES);
  assert.ok(lines.length >= 6);
  for (const l of lines) assert.ok(parseLine(l).explicit, `${l.text}: no tone`);
});

// ------------------------------------------------------------------ the voice

const LINE = 'The water has not risen this year, and the pilgrims are still walking round the walls';
const AMA = voiceOf({ id: 'ama', voice: 1.05, kind: 'f' });
const shape = (tone, o = {}) => contourOf(planLine(LINE + (o.end ?? '.'), { voice: o.voice ?? AMA, tone, lang: o.lang ?? 'desert' }));

test('tones shape the mumble: questions rise, sad falls and slows, angry is clipped and loud, whispers are breath', () => {
  const S = Object.fromEntries(TONES.map((t) => [t, shape(t)]));
  assert.ok(shape('curious', { end: '?' }).slope > 4, 'a question rises');
  const lastF = (end) => planLine(LINE + end, { voice: AMA, tone: 'neutral', lang: 'desert' }).syllables.at(-1).f0;
  assert.ok(lastF('?') > lastF('.') * Math.pow(2, 3 / 12), 'even a plain question lifts at the end');
  assert.ok(S.sad.slope < -2 && S.sad.rate < S.neutral.rate * 0.85, 'sad falls and slows');
  assert.ok(S.sad.mean < S.neutral.mean - 1.5, 'and sits lower');
  assert.ok(S.angry.loud > S.neutral.loud * 1.25 && S.angry.len < S.neutral.len * 0.75, 'angry: loud and clipped');
  assert.ok(S.shout.loud > S.neutral.loud * 1.4 && S.shout.mean > S.neutral.mean + 3, 'shout: louder and higher');
  assert.ok(S.whisper.breath > 0.9 && S.whisper.loud < S.neutral.loud * 0.6, 'whisper: breath, quiet');
  assert.ok(S.surprised.first > S.surprised.last + 3, 'surprise jumps up first');
  assert.ok(S.solemn.span < S.happy.span / 3 && S.solemn.len > S.neutral.len * 1.3, 'solemn: level and long');
  assert.ok(S.tired.rate < S.neutral.rate * 0.85 && S.tired.loud < S.neutral.loud, 'tired: slow and soft');
  assert.ok(S.scared.rate > S.neutral.rate * 1.15 && S.scared.mean > S.neutral.mean, 'scared: quick and high');
  assert.ok(S.playful.span > S.neutral.span * 1.4, 'playful bounces');
  // all twelve are distinct from each other
  const sig = (c) => [c.mean, c.slope, c.rate, c.loud * 100, c.len * 100, c.breath * 10].map((x) => Math.round(x)).join(',');
  assert.equal(new Set(TONES.map((t) => sig(S[t]))).size, TONES.length);
  // the reveal follows the voice: sad lines come out slower than angry ones
  assert.ok(planLine(`~sad~ ${LINE}`, { voice: AMA, lang: 'desert' }).cps < planLine(`~angry~ ${LINE}`, { voice: AMA, lang: 'desert' }).cps);
  // the tag in the text is read
  assert.equal(planLine(`~whisper~ ${LINE}`, { voice: AMA, lang: 'desert' }).tone, 'whisper');
});

test('each world has its own tongue', () => {
  for (const id of ['home', 'desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar', 'atelier']) assert.ok(LANGUAGES[id], id);
  const P = (lang) => planLine(`${LINE}.`, { voice: AMA, tone: 'neutral', lang });
  const C = (lang) => contourOf(P(lang));
  assert.ok(C('desert').breath > 0.35 && C('desert').mean < C('home').mean, 'the desert: breathy and low');
  assert.ok(C('incal').rate > C('desert').rate * 1.15 && C('incal').len < C('desert').len * 0.6, 'the City-Shaft: fast and clipped');
  assert.ok(C('arzach').n < C('desert').n * 0.6 && C('arzach').loud < C('desert').loud * 0.5, 'Vael: almost silent');
  assert.ok(P('garage').syllables.every((s) => s.mech), 'the Hangar: mechanical');
  const drop = (lang) => { const S = P(lang).syllables; return S.reduce((a, s) => a + Math.log2(s.pitch.at(-1)[1] / s.pitch[0][1]) * 12, 0) / S.length; };
  assert.ok(drop('perdide') < -1.5 && drop('perdide') < drop('desert') - 1 && P('perdide').syllables.every((s) => s.pitch.length > 3), 'Lorn: watery, wobbling bloops down');
  assert.ok(LANGUAGES.home.native && !LANGUAGES.desert.native, 'home needs no translation');
  // different syllables for the same words
  const cons = (lang) => P(lang).syllables.map((s) => s.consonant).join(' ');
  assert.equal(new Set(['home', 'desert', 'incal', 'garage', 'perdide', 'edena', 'bazaar'].map(cons)).size, 7);
  // the same word always sounds the same in a tongue (deterministic)
  assert.deepEqual(P('desert'), P('desert'));
  for (const [id, L] of Object.entries(LANGUAGES)) assert.ok(L.native || SCRIPTS[id]?.inventory.length >= 20, `${L.name} has a script`);
});

test('each speaker has their own voice: children higher, elders slower, crowds hashed, the parents distinct', () => {
  const child = voiceOf({ id: 'ilo', voice: 1.7, kind: 'f', scale: 0.7 }), elder = voiceOf({ id: 'nour', title: 'the eldest of Qanat', voice: 0.72, kind: 'f' });
  const man = voiceOf({ id: 'bako', voice: 0.75, kind: 'm' }), woman = voiceOf({ id: 'ama', voice: 1.05, kind: 'f' });
  assert.ok(child.f0 > woman.f0 * 1.5 && child.age === 'child');
  assert.ok(elder.rate < woman.rate * 0.85 && elder.age === 'elder' && elder.wobble > 0);
  assert.ok(woman.f0 > man.f0 * 1.4);
  assert.equal(voiceOf({ id: 'oum', age: 'elder', voice: 0.85, kind: 'f' }).age, 'elder');
  const father = voiceOf(CALL_VOICES.father), mother = voiceOf(CALL_VOICES.mother);
  assert.ok(mother.f0 > father.f0 * 1.6, 'the father and mother sound different');
  // crowd people: no voice of their own, one from their seed, stable and varied
  const crowdV = Array.from({ length: 40 }, (_, i) => voiceOf({ seed: `crowd:${i}` }));
  assert.deepEqual(voiceOf({ seed: 'crowd:3' }), crowdV[3]);
  assert.ok(new Set(crowdV.map((v) => Math.round(v.f0))).size > 25);
  // a plan for a balloon is a short version
  const long = planLine(`${LINE}, and then they all sat down and waited a very long time for the water to come up again.`, { voice: man, lang: 'desert', max: 9 });
  assert.ok(long.syllables.length <= 9 && long.total < 2);
});

test('the voice keeps step with the letters, and stage directions are silent', () => {
  const p = planLine('~neutral~ (She looks up.) Hello there, traveller.', { voice: AMA, lang: 'desert' });
  assert.ok(p.syllables.length >= 4);
  assert.ok(p.syllables.every((s) => s.i >= '(She looks up.) '.length), 'nothing in brackets is voiced');
  for (let k = 1; k < p.syllables.length; k++) assert.ok(p.syllables[k].i >= p.syllables[k - 1].i && p.syllables[k].t >= p.syllables[k - 1].t);
  assert.ok(Math.abs(p.syllables.at(-1).t - (p.syllables.at(-1).i - p.syllables[0].i) / p.cps) < 0.01, 'timed to the reveal');
  assert.ok(p.cps > REVEAL_CPS * 0.6 && p.cps < REVEAL_CPS * 1.35);
  const n = planLine('The panel wakes. A voice: *Odile’s log. Day ninety-one.*', { voice: AMA, lang: 'edena', narrator: true });
  assert.ok(n.syllables.length > 0 && n.syllables.every((s) => s.i > 'The panel wakes. A voice: '.length), 'a narrator voices only the quoted words');
  assert.equal(planLine('(leave)', { voice: AMA }).syllables.length, 0);
});
