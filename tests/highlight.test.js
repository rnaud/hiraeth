// *Highlights* in the story text: the places to go and the things to do, shown in
// colour in the dialogue panel, its choices and the balloons (src/story/dialogue.js
// formatText). A long *span* is a quotation (a letter, a recording) instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { formatText } from '../src/story/dialogue.js';
import { planLine, voiceOf, isQuote } from '../src/story/voice.js';

const DIR = new URL('../src/story/', import.meta.url);
const DATA = readdirSync(DIR).filter((f) => f.endsWith('-data.js')).sort();

/** Every string under a value, with where it is. */
function strings(v, where, out = [], seen = new Set()) {
  if (v == null || typeof v === 'function') return out;
  if (typeof v === 'string') { out.push([where, v]); return out; }
  if (typeof v !== 'object' || seen.has(v)) return out;
  seen.add(v);
  for (const [k, x] of Object.entries(v)) strings(x, `${where}.${k}`, out, seen);
  return out;
}

test('every *highlight* in the story data is closed, and never inside a {motif} or a tone tag', async () => {
  let spans = 0;
  for (const f of DATA) {
    const m = await import(new URL(f, DIR));
    for (const [where, s] of strings(m, f)) {
      const stars = s.match(/\*/g)?.length ?? 0;
      if (!stars) continue;
      assert.equal(stars % 2, 0, `${where}: the stars pair up: ${s}`);
      assert.ok(!s.includes('**'), `${where}: no empty highlight: ${s}`);
      assert.ok(!/\{[^}]*\*[^}]*\}/.test(s), `${where}: no star inside a motif: ${s}`);
      assert.ok(!/^\s*\*+\s*~[a-z]+~|^\s*~[a-z]*\*/.test(s), `${where}: no star in the tone tag: ${s}`);
      for (const [, w] of s.matchAll(/\*([^*]+)\*/g)) {
        assert.equal(w, w.trim(), `${where}: a highlight starts and ends on a word: *${w}*`);
        spans++;
      }
      assert.ok(!formatText(s, false).includes('*'), `${where}: no star shows`);
      assert.ok(!formatText(s).includes('*'), `${where}: no star shows`);
    }
  }
  assert.ok(spans > 300, `the story highlights its places and hints (${spans})`);
});

test('a short *span* is a highlight, a long one a quotation', () => {
  assert.equal(formatText('~neutral~ Go to *the back gate*.'), 'Go to <em>the back gate</em>.');
  assert.equal(formatText('Take it *up to the console*, then.', false), 'Take it up to the console, then.');
  assert.ok(!isQuote('the shrine by the dry well'));
  assert.ok(!isQuote('Under the giant’s head, outside the back gate'));
  assert.ok(isQuote('Odile’s log. Day ninety-one of the crossing.'), 'two sentences: a quotation');
  assert.ok(isQuote('the giants came down from the swamp of lights, carrying the water'), 'a long span: a quotation');
  assert.match(formatText('It says: *I built it to see what I would do with it. I still don’t know.*'), /<em class="quote">/);
  // a choice renders its highlights too (the same formatText)
  assert.equal(formatText('~neutral~ I’ll take it *to the console*.'), 'I’ll take it <em>to the console</em>.');
});

test('a narrated thing voices its quotations, not its highlights', () => {
  const v = voiceOf({ voice: 0.6 });
  const hint = planLine('~neutral~ The stones are all facing *the back gate*.', { voice: v, lang: 'desert', narrator: true });
  assert.equal(hint.syllables.length, 0, 'a highlight in narration is not read aloud');
  const quote = planLine('~solemn~ A note: *From here I can watch the east, where it came from.*', { voice: v, lang: 'edena', narrator: true });
  assert.ok(quote.syllables.length > 0 && quote.syllables.every((s) => s.i >= 'A note: '.length));
  const broadcast = planLine('~whisper~ *Come home, Ilen.*', { voice: v, narrator: 'all' });
  assert.ok(broadcast.syllables.length > 0, 'a broadcast voices every starred word');
  const said = planLine('~neutral~ Go to *the back gate*.', { voice: v, lang: 'desert' });
  assert.ok(said.syllables.some((s) => s.i >= 'Go to *'.length), 'a person says the highlighted words');
});
