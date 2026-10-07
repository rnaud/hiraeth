// Each world's script (src/story/scripts.js) and the translator's reveal in the dialogue panel
// (src/story/dialogue.js revealHtml).
import { SIDE } from '../src/levels/names.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCRIPTS, scriptOf, lineChunks, writeChunk, chunkSvg, lineSvg, glyphSvg, syllables, CH } from '../src/story/scripts.js';
import { LANGUAGES, languageOf, planLine, spokenMask } from '../src/story/voice.js';
import { revealHtml, LAG, FADE } from '../src/story/dialogue.js';

const LINE = 'The water has not risen this year. Go down to the *giant’s heart*, child, and see what lies across the channel.';
const svgs = (html) => html.match(/<svg class="tg"[^>]*>/g) ?? [];

test('every world has its own script, each a real inventory of 20 to 40 glyphs; home needs none', () => {
  const ids = [...readFileSync(new URL('../src/levels/index.js', import.meta.url), 'utf8').matchAll(/^\s+id: '(\w+)'/gm)].map((m) => m[1]);
  assert.ok(ids.length >= 14, `${ids.length} levels`);
  for (const id of ids) {
    if (LANGUAGES[id]?.native) { assert.equal(scriptOf(id), null, `${id}: no translation`); continue; }
    assert.ok(scriptOf(languageOf(id)), `${id} has a script`);
    if (!['lab', 'references', 'arena'].includes(id) && !SIDE.includes(id)) assert.ok(SCRIPTS[id], `${id} has a script of its own`);   // (the dev levels borrow the desert's; the worlds off the route, a neighbour's)
  }
  for (const [id, L] of Object.entries(LANGUAGES)) if (!L.native) assert.ok(SCRIPTS[id], `${L.name} is written`);
  for (const S of Object.values(SCRIPTS)) {
    assert.ok(S.inventory.length >= 20 && S.inventory.length <= 40, `${S.name}: ${S.inventory.length} glyphs`);
    assert.ok(/^#[0-9a-f]{6}$/.test(S.ink) && S.name && S.about && ['ltr', 'rtl'].includes(S.dir));
    // every glyph draws something, and no two glyphs of a script look the same
    const drawn = S.inventory.map((g, k) => glyphSvg(S.id, k));
    for (const d of drawn) assert.match(d, /<path d="M/);
    assert.equal(new Set(drawn).size, drawn.length, `${S.name}: all glyphs distinct`);
  }
  assert.ok(Object.values(SCRIPTS).some((S) => S.dir === 'rtl') && Object.values(SCRIPTS).some((S) => S.dir === 'ltr'), 'both directions');
  // the scripts look different from one another: the same line, twelve different drawings
  assert.equal(new Set(Object.keys(SCRIPTS).map((id) => lineSvg(LINE, id))).size, Object.keys(SCRIPTS).length);
});

test('a line is always written the same way, and a word the same way wherever it comes', () => {
  for (const id of Object.keys(SCRIPTS)) {
    assert.equal(lineSvg(LINE, id), lineSvg(LINE, id), `${id}: deterministic`);
    const a = writeChunk('water', id).glyphs.map((g) => g.id), b = writeChunk('water', id).glyphs.map((g) => g.id);
    assert.deepEqual(a, b);
    // "water" in two different lines: the same glyphs
    const inLine = (text) => { const c = lineChunks(text).find((x) => x.text.startsWith('water')); return writeChunk('water', id).d === writeChunk(c.text.replace(/[^\p{L}]/gu, ''), id).d; };
    assert.ok(inLine('The water is low.') && inLine('No water, child?'), `${id}: same word, same glyphs`);
  }
  // different words mostly look different
  for (const id of Object.keys(SCRIPTS)) {
    if (id === 'arzach') continue;   // (Vael leaves words out: a dot for each)
    const words = ['water', 'giant', 'heart', 'child', 'channel', 'across', 'tree', 'light', 'stone', 'bell'];
    assert.ok(new Set(words.map((w) => writeChunk(w, id).d + writeChunk(w, id).f)).size >= 8, `${id}: words differ`);
  }
});

test('the script keeps the line’s word structure: a box exactly as wide as each English word, its punctuation its own', () => {
  const chunks = lineChunks(LINE);
  let english = '', at = 0;
  for (const c of chunks) { english += `${LINE.slice(at, c.from).replace(/\*/g, '')}X`; at = c.to; }
  assert.deepEqual(chunks.map((c) => c.text), ['The', 'water', 'has', 'not', 'risen', 'this', 'year.', 'Go', 'down', 'to', 'the', 'giant’s', 'heart', ',', 'child,', 'and', 'see', 'what', 'lies', 'across', 'the', 'channel.']);
  for (const id of Object.keys(SCRIPTS)) {
    const html = revealHtml(LINE, { lang: id, shown: LINE.length, translated: -Infinity });
    const boxes = svgs(html);
    assert.equal(boxes.length, chunks.length, `${id}: one box a word`);
    boxes.forEach((b, k) => assert.ok(b.includes(`width:${[...chunks[k].text].length}ch`) && b.includes(`viewBox="0 0.5 ${[...chunks[k].text].length * CH} 12"`), `${id}: ${chunks[k].text}`));
    // the spaces and the highlight stay where they were (the English fills the same places)
    assert.equal(html.replace(/<svg[\s\S]*?<\/svg>/g, 'X').replace(/<\/?em[^>]*>/g, ''), english);
    // a full stop, a comma: marks of the script's own
    const S = SCRIPTS[id];
    // (Vael leaves a pause unwritten)
    for (const p of id === 'arzach' ? ['.', '?', '!'] : ['.', ',', '?', '!']) { const w = writeChunk(`stone${p}`, S), v = writeChunk('stone', S); assert.ok(w.d.length + w.f.length > v.d.length + v.f.length, `${id} writes ${p}`); }
  }
  // a name is marked in the market's script; Vael leaves out the words the voice leaves out
  assert.ok(lineChunks('I met Madame Sel there.').find((c) => c.text === 'Madame').proper);
  assert.ok(!lineChunks('The bell. Then it rang.').find((c) => c.text === 'Then').proper, 'a sentence’s first word is no name');
  const said = planLine('~neutral~ Gone. Her track, there. Blow the whistle.', { lang: 'arzach' }).syllables.map((s) => s.i);
  for (const c of lineChunks('Gone. Her track, there. Blow the whistle.')) {
    const left = writeChunk(c.text, 'arzach').glyphs[0]?.id === -1, voiced = said.some((i) => i >= c.from && i < c.to);
    assert.equal(left, !voiced, `Vael: “${c.text}” ${voiced ? 'said' : 'left out'}`);
  }
});

test('the scripts work as real ones: frequency-weighted glyphs, abjad consonants, syllables, right to left', () => {
  const corpus = readFileSync(new URL('../LORE.md', import.meta.url), 'utf8').slice(4000, 40000).match(/[A-Za-z]+/g);
  for (const S of Object.values(SCRIPTS)) {
    const count = new Array(S.inventory.length).fill(0);
    for (const w of corpus) for (const g of writeChunk(w, S).glyphs) if (g.id >= 0) count[g.id]++;
    const n = S.inventory.length, q = Math.floor(n / 4), sum = (a) => a.reduce((x, y) => x + y, 0);
    assert.ok(sum(count.slice(0, q)) > 2 * sum(count.slice(-q)), `${S.name}: the first glyphs are the common ones (${count.join(' ')})`);
    assert.ok(count.filter((c) => c > 0).length >= n * 0.6, `${S.name}: most of the inventory in use`);
  }
  // an abjad writes the consonants (and a first vowel), stretched over the word
  assert.equal(writeChunk('channel', 'desert').glyphs.length, 3, 'ch·n·l (nn doubled, written once)');
  assert.equal(writeChunk('across', 'desert').glyphs.length, 4, 'a·c·r·s');
  // the monks' abugida and the knots: a glyph a syllable
  assert.deepEqual(syllables('garden').map((s) => s.t), ['gar', 'den']);
  assert.deepEqual(syllables('the').map((s) => s.t), ['the']);
  assert.equal(writeChunk('garden', 'arzach2').glyphs.length, 2);
  assert.equal(writeChunk('remembers', 'perdide').glyphs.length, 3);
  // a letter script: a glyph a letter, 'th' and 'ng' one rune
  assert.equal(writeChunk('stone', 'garage').glyphs.length, 5);
  assert.equal(writeChunk('thing', 'incal').glyphs.length, 3);
  // logograms: one a word, a compound for a long one
  assert.equal(writeChunk('sphere', 'spheres').glyphs.length, 1);
  assert.equal(writeChunk('remembering', 'spheres').glyphs.length, 2);
  // right to left: the first letter's glyph at the right end of the box
  const firstX = (id) => { const w = writeChunk('tamarind', id, { shown: 1 }), x = [...(w.d + w.f).matchAll(/[ML]([\d.]+)/g)].map((m) => +m[1]); return x.reduce((a, b) => a + b, 0) / x.length; };
  for (const id of Object.keys(SCRIPTS)) assert.ok(SCRIPTS[id].dir === 'rtl' ? firstX(id) > 4 * CH : firstX(id) < 4 * CH, `${id}: ${SCRIPTS[id].dir}`);
  assert.deepEqual(Object.keys(SCRIPTS).filter((id) => SCRIPTS[id].dir === 'rtl'), ['desert', 'buried', 'perdide2']);
});

test('the translator: words come in the script as they are said and turn into English a moment behind', () => {
  const lang = 'desert', len = LINE.length;
  // nothing said yet: nothing shown
  assert.equal(revealHtml(LINE, { lang, shown: 0, translated: -LAG }), '');
  // half said: the words behind the translator in English, the last few in the script, nothing beyond the caret
  const n = 60, html = revealHtml(LINE, { lang, shown: n, translated: n - LAG });
  const english = html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '');
  assert.ok(english.startsWith('The water has not risen this year. Go'), english);
  assert.ok(!english.includes('channel') && !english.includes('across'));
  const alien = svgs(html).filter((b) => !b.includes('margin-left')).length, turning0 = svgs(html).length - alien;
  assert.ok(alien >= 2 && alien <= 5 && turning0 <= 3, `${alien} words in the script at the caret, ${turning0} turning`);
  // the word at the caret is written as far as it has been said, in its full width (nothing moves when it is finished)
  const caret = lineChunks(LINE).find((c) => c.from < n && c.to > n);
  assert.ok(chunkSvg(caret.text, lang, { shown: n - caret.from }) !== chunkSvg(caret.text, lang), 'part written');
  assert.ok(html.includes(`width:${caret.text.length}ch`));
  // a word turning: its English fading in under its fading glyphs, in the same place
  const turning = revealHtml(LINE, { lang, shown: n, translated: lineChunks(LINE)[7].to + FADE / 2 });
  assert.match(turning, /<span style="white-space:nowrap"><span style="opacity:0\.\d+">Go<\/span><svg[^>]*margin-left:-2ch;opacity:0\.\d+/);
  // all said and translated: the plain line, as before
  assert.equal(revealHtml(LINE, { lang, shown: len, translated: len + FADE }), revealHtml(LINE, { lang: null, shown: len }));
  assert.ok(!svgs(revealHtml(LINE, { lang: 'home', shown: len, translated: -Infinity })).length, 'home speech is never in a script');
  // stage directions and narration aren't in the script (they are not said)
  const dir = '(She looks away.) Go now.';
  const said = revealHtml(dir, { lang, shown: dir.length, translated: -Infinity, spoken: spokenMask(dir, false) });
  assert.ok(said.startsWith('(She looks away.) <svg') && svgs(said).length === 2, said);
});

test('the panel goes on translating after the last word is said; a press shows it all in English at once', async () => {
  const { GameState } = await import('../src/game-state.js');
  const { Quests } = await import('../src/story/quests.js');
  const { Dialogue } = await import('../src/story/dialogue.js');
  const m = new Map(), game = new GameState({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) });
  const d = new Dialogue({ game, quests: new Quests({ game }) });
  const line = 'Go down to the well, child, and wait.';
  const person = { id: 'tester', name: 'Tester', kind: 'f', lang: 'desert', talk: { nodes: { a: { say: [`~neutral~ ${line}`, '~neutral~ Then come back.'] } } } };
  assert.ok(d.start(person));
  assert.equal(d.translated, -LAG);
  let steps = 0;
  while (d.revealed < line.length && steps++ < 600) d.update(1 / 60);
  assert.ok(d.translated < line.length + FADE, 'the last words still in the script when the line is said');
  while (d.translated < line.length + FADE && steps++ < 900) d.update(1 / 60);
  assert.ok(d.translated >= line.length + FADE, 'then translated');
  d.next();   // the next page: in the script again from its first word
  assert.equal(d.revealed, 0); assert.equal(d.translated, -LAG);
  d.update(1 / 60); d.next();   // a press mid-line: all of it, in English
  assert.equal(d.translated, Infinity);
});
