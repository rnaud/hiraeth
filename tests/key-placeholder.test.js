// Keys in lines (docs/systems/dialogue.md, "Keys in lines"): a {key:verb} in anything the player reads is
// the verb's input as the player holds it (src/prompt-keys.js keyText), never voiced, never in a script,
// and kept by the translation tables. And no line in the story names a button in prose any more.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { keyText, keysHtml, keySig, verbKey, hasKeys, badgeLine } from '../src/prompt-keys.js';
import { setControlPrefs } from '../src/remap.js';
import { formatText, revealHtml } from '../src/story/dialogue.js';
import { planLine, spokenMask } from '../src/story/voice.js';
import { lineChunks } from '../src/story/scripts.js';
import { t, setLanguage, LANGUAGES } from '../src/i18n.js';
import { ITEMS } from '../src/items.js';

const LINE = '~neutral~ *Push the bone* aside: switch the gun to push with {key:mode}, aim with {key:aim}, fire with {key:fire}.';

test('keys in lines: the keyboard, with the player’s own keys', () => {
  setControlPrefs({});
  assert.equal(keyText('aim with {key:aim}, fire with {key:fire}', { kind: 'keys' }), 'aim with R or the right mouse button, fire with G or a left click');
  assert.equal(keyText('{key:mode}', { kind: 'keys' }), 'X');
  assert.equal(keyText('{key:call}', { kind: 'keys' }), 'E', 'the keyboard whistles with the use key');
  setControlPrefs({ keys: { aim: 'KeyK', mode: 'KeyZ' } });
  assert.equal(keyText('{key:aim} then {key:mode}', { kind: 'keys' }), 'K or the right mouse button then Z');
  setControlPrefs({});
});

test('keys in lines: a controller, its buttons as the player moved them; push is the D-pad, never X', () => {
  setControlPrefs({});
  assert.equal(keyText('{key:aim} {key:fire}', { kind: 'pad' }), 'LT / L2 RT / R2');
  assert.equal(keyText('{key:mode}', { kind: 'pad' }), 'D-pad ← / →');
  assert.doesNotMatch(keyText('{key:mode}', { kind: 'pad' }), /X/);
  assert.equal(keyText('{key:interact}', { kind: 'pad' }), 'X / □');
  assert.equal(keyText('{key:call}', { kind: 'pad' }), 'D-pad ↓');
  assert.equal(keyText('{key:blade} {key:guard} {key:evade}', { kind: 'pad' }), 'RB / R1 LB / L1 B / ○');
  setControlPrefs({ pad: { jump: 'B', evade: 'A', modePrev: 'LB', modeNext: 'RB' } });
  assert.equal(keyText('{key:jump}', { kind: 'pad' }), 'B / ○');
  assert.equal(keyText('{key:evade}', { kind: 'pad' }), 'A / ×');
  assert.equal(keyText('{key:mode}', { kind: 'pad' }), 'LB / L1 / RB / R1');
  // as HTML the name is already the bound one: .pad-raw keeps native-pad.js from renaming it a second time
  assert.equal(keyText('{key:jump}', { kind: 'pad', html: true }), '<kbd class="kp pad-raw">B / ○</kbd>');
  setControlPrefs({});
});

test('keys in lines: touch, an unknown verb, HTML, and {glyph} beside them', () => {
  assert.equal(keyText('{key:aim} {key:fire} {key:mode}', { kind: 'touch' }), '◎ ✺ ◐');
  for (const kind of ['keys', 'pad', 'touch']) assert.equal(keyText('a {key:dance}', { kind }), 'a dance', `${kind}: an unknown verb is its word`);
  assert.equal(verbKey('dance', 'pad'), 'dance');
  assert.equal(keyText('no keys here'), 'no keys here');
  assert.ok(hasKeys(LINE) && !hasKeys('{glyph}'));
  // the dialogue panel and balloons (formatText): motifs, highlights and keys together
  const html = formatText('~neutral~ The {glyph} mark. *Shoot it*: {key:fire}.', true, 'pad');
  assert.match(html, /<svg class="glyph"/);
  assert.match(html, /<em>Shoot it<\/em>: <kbd class="kp pad-raw">RT \/ R2<\/kbd>\./);
  assert.equal(formatText('The {glyph}. Aim with {key:aim}.', false, 'keys'), 'The ⁖⌒. Aim with R or the right mouse button.');
  assert.equal(keysHtml('a < b, {key:jump}'), 'a &lt; b, <kbd class="kp pad-raw">SPACE</kbd>');
  assert.match(badgeLine('Hold {key:gadget} to draw the line out'), /<kbd class="kp pad-raw">T<\/kbd>/, 'the cue too');
});

test('keys in lines: drawn again when the input changes hands', () => {
  setControlPrefs({});
  const a = keySig('keys');
  assert.equal(keySig('keys'), a, 'nothing changed');
  assert.notEqual(keySig('pad'), a, 'a controller picked up');
  setControlPrefs({ keys: { jump: 'KeyK' } });
  assert.notEqual(keySig('keys'), a, 'a key moved');
  setControlPrefs({});
});

test('keys in lines: never voiced, never in a speaker’s script, never half shown', () => {
  const text = LINE.replace(/^~\w+~ /, '');
  const mask = spokenMask(text, false);
  for (const m of text.matchAll(/\{key:\w+\}/g)) for (let i = m.index; i < m.index + m[0].length; i++) assert.equal(mask[i], 0, `${m[0]} is not said`);
  const plan = planLine(LINE, { lang: 'desert' });
  const inKey = (i) => [...text.matchAll(/\{key:\w+\}/g)].some((m) => i >= m.index && i < m.index + m[0].length);
  assert.ok(plan.syllables.length > 5, 'the words around it are said');
  assert.ok(plan.syllables.every((s) => !inKey(s.i)), 'no syllable for a placeholder');
  // the same count as the line without them: the voice says the words, not "key", "aim"
  assert.equal(plan.syllables.length, planLine(LINE.replace(/\{key:\w+\}/g, ''), { lang: 'desert' }).syllables.length);
  for (const ch of lineChunks(text)) assert.doesNotMatch(ch.text, /key|\{|\}/, 'the translator’s script leaves it alone');
  // mid-reveal: a placeholder half typed is hidden, then shown whole
  const at = text.indexOf('{key:mode}') + 6;
  assert.doesNotMatch(revealHtml(text, { shown: at }), /\{|key:/);
  assert.match(revealHtml(text, { shown: text.length }), /<kbd class="kp pad-raw">X<\/kbd>/);
  assert.match(revealHtml(text, { lang: 'desert', shown: text.length, translated: -Infinity, spoken: mask }), /<kbd class="kp pad-raw">X<\/kbd>/, 'shown at once, in your words');
});

test('keys in lines: a translation table keeps them ({names} are words only)', () => {
  const fr = LANGUAGES.fr.table;
  fr['test.keyLine'] = 'Visez avec {key:aim}, puis {n} tirs avec {key:fire}.';
  try {
    setLanguage('fr');
    const s = t('test.keyLine', { n: 3, key: 'no' });
    assert.equal(s, 'Visez avec {key:aim}, puis 3 tirs avec {key:fire}.');
    assert.equal(keyText(s, { kind: 'pad' }), 'Visez avec LT / L2, puis 3 tirs avec RT / R2.');
  } finally { setLanguage('en'); delete fr['test.keyLine']; }
});

// ---- no button named in prose

// the ways the lines used to name buttons (docs/audits/dialogue-v1.0.md, finding 6)
const PROSE = /push mode|D-pad|\b[LR][TB] \/ [LR][12]\b|\b[ABXY] \/ [×○□△]|left click|right click|right mouse|\(E, or|\(shoot:|\bpress [A-Z]\b|\bSPACE\b|\b(LT|RT|LB|RB)\b/;
const SRC = new URL('../src/', import.meta.url);

/** Every string under a value (ids and the like included: none of them looks like a button). */
function strings(v, where, out, seen = new Set()) {
  if (v == null || typeof v === 'function') return out;
  if (typeof v === 'string') { out.push([where, v]); return out; }
  if (typeof v !== 'object' || seen.has(v)) return out;
  seen.add(v);
  for (const [k, x] of Object.entries(v)) strings(x, `${where}.${k}`, out, seen);
  return out;
}

test('no line in the story data names a button in prose: conversations, things, balloons, quest steps', async () => {
  const files = readdirSync(new URL('story/', SRC)).filter((f) => f.endsWith('-data.js'));
  const bad = [];
  let n = 0;
  for (const f of files) {
    const m = await import(new URL(`story/${f}`, SRC));
    for (const [k, v] of Object.entries(m)) for (const [w, s] of strings(v, `${f}:${k}`, [])) { n++; if (PROSE.test(s)) bad.push(`${w}: ${s.slice(0, 90)}`); }
  }
  assert.ok(n > 3000, `the story's strings (${n})`);
  assert.deepEqual(bad, [], 'a {key:verb} instead (src/prompt-keys.js keyText)');
});

test('no item card and no toast names a button in prose', () => {
  const bad = Object.entries(ITEMS).filter(([, it]) => PROSE.test(`${it.text ?? ''} ${it.use ?? ''}`)).map(([id]) => `item ${id}`);
  // the toasts, hints and notices the game says as you play (a call with a literal: toast('…'), notice?.('…'), hint('…'))
  const dirs = ['', 'story/', 'gadgets/', 'boxes/', 'temples/'];
  const CALL = /\b(toast|notice|hint)\??\.?\(\s*(['`])((?:\\.|(?!\2).)*)\2/g;
  for (const d of dirs) {
    for (const f of readdirSync(new URL(d, SRC)).filter((x) => x.endsWith('.js'))) {
      const src = readFileSync(new URL(d + f, SRC), 'utf8');
      for (const m of src.matchAll(CALL)) if (PROSE.test(m[3])) bad.push(`${d}${f}: ${m[3].slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, []);
  // and the ones that teach use the placeholder, which resolves
  assert.equal(keyText(ITEMS.stun.use, { kind: 'pad' }).startsWith('Switch modes with D-pad ← / →.'), true);
});
