// The conversation panel reads at a glance (issue #147): the page shown whole and in your words at once (no letters
// typed, no words turning out of the speaker's script), its type about 3 % of the screen's height on every screen,
// a comfortable line, and the answers as words on the paper (no boxes) with a cue on the one that would be picked.
// The panel's own drawing (src/story/dialogue.js render) is run against a stand-in for its elements; the sizes are
// read from index.html's #dialogue rules and the Unity bridge's HUD (BridgeHud.cs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { Dialogue, choiceHtml } from '../src/story/dialogue.js';
import { page } from '../src/platform.js';

const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const HUD = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs', import.meta.url), 'utf8');

/** The rules of `selector` in index.html's style, joined (its declarations). */
function rule(selector) {
  const out = [];
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of HTML.matchAll(new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`, 'g'))) out.push(m[1]);
  return out.join(';');
}

/** Just enough of the panel's elements for render(): their markup, classes and data. */
function standIn() {
  const node = () => ({
    innerHTML: '', textContent: '', hidden: false, dataset: {}, style: { setProperty() {}, removeProperty() {} },
    _cls: new Set(), get classList() { const c = this._cls; return { add: (k) => c.add(k), remove: (k) => c.delete(k), toggle: (k, on) => (on ?? !c.has(k)) ? c.add(k) : c.delete(k), contains: (k) => c.has(k) }; },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, contains: () => false,
  });
  const parts = new Map(), root = node();
  root.querySelector = (s) => { if (!parts.has(s)) parts.set(s, node()); return parts.get(s); };
  return { root, part: (s) => root.querySelector(s) };
}

function talk(person) {
  const ui = standIn(), was = page.byId;
  page.byId = (id) => (id === 'dialogue' ? ui.root : null);
  try {
    const m = new Map(), game = new GameState({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) });
    const d = new Dialogue({ game, quests: new Quests({ game }) });
    assert.ok(d.start(person));
    return { d, ui };
  } finally { page.byId = was; }
}

const LINE = 'Go down to *the well*, child, and wait for me there.';
const ALIEN = { id: 'tester', name: 'Tester', kind: 'f', lang: 'desert', talk: { nodes: { a: {
  say: [`~neutral~ ${LINE}`, '~neutral~ Then come back.'],
  choices: [{ text: '~curious~ Which well?', end: true }, { text: '~neutral~ Goodbye.', end: true }] } } } };

test('a foreign speaker\'s page is shown whole and in English from its first frame, and stays as it is', () => {
  const { d, ui } = talk(ALIEN);
  const live = () => ui.part('.dlg-text').innerHTML.split('<span class="dlg-live">')[1];
  const first = live();
  assert.ok(first.includes('Go down to <em>the well</em>, child, and wait for me there.'), first);
  assert.ok(!/<svg/.test(first), 'no words in the speaker\'s script');
  assert.ok(!/dlg-caret/.test(first), 'no caret typing it');
  assert.ok(ui.part('.dlg-text').classList.contains('heard'), 'the one trace of the translator: .heard (a fade, once)');
  for (let i = 0; i < 30; i++) d.update(1 / 60);
  assert.equal(live(), first, 'nothing in the words changes while the voice says them');
  assert.ok(d.revealed < LINE.length, '(the voice still going)');
  d.close();
});

test('home speech has no translator trace', () => {
  const { d, ui } = talk({ ...ALIEN, lang: 'home' });
  assert.ok(!ui.part('.dlg-text').classList.contains('heard'));
  d.close();
});

test('the next page\'s answers come up with it, before its voice is done, and a press picks one', () => {
  const { d, ui } = talk(ALIEN);
  d.next();
  assert.match(ui.part('.dlg-choices').innerHTML, /Which well\?/);
  assert.ok(!ui.part('.dlg-choices').classList.contains('waiting'), 'there and touchable at once');
  assert.ok(!ui.root.classList.contains('more'), 'no page-turn mark over answers');
  d.choose(d.runner.choices()[0].index);
  assert.equal(d.open, false);
});

test('the page\'s type: about 3 % of the screen\'s height on every screen, never under 17 px', () => {
  const m = rule('#dialogue').match(/--dlg:\s*calc\(clamp\((\d+)px,\s*([\d.]+)vh,\s*(\d+)px\)/);
  assert.ok(m, 'the panel\'s type from the screen\'s height');
  const [lo, vh, hi] = [+m[1], +m[2], +m[3]];
  const size = (h) => Math.min(hi, Math.max(lo, (vh * h) / 100));
  // desktop 720, the Steam Deck's 800, 1080, the Xbox at 1440 (its 4K is 2160 CSS px at most)
  for (const h of [720, 800, 1080, 1440]) {
    assert.ok(size(h) / h >= 0.028 && size(h) / h <= 0.036, `${h}: ${size(h).toFixed(1)} px is ${(100 * size(h) / h).toFixed(2)} %`);
  }
  assert.ok(size(410) >= 17, 'the Retroid (410 CSS px): bigger than the 15 px it was');
  assert.ok(size(720) > 15 * 1.3 && size(1080) > 19 * 1.5, 'well up from 15 px (720) and 19 px (1080)');
  // a comfortable line: the panel 46 em wide, its words about 64 letters (the font is monospaced, 0.6 em a letter)
  assert.match(rule('#dialogue'), /width:\s*min\(46em/);
  const pad = rule('#dialogue .dlg-panel').match(/padding:\s*[\d.]+em\s+([\d.]+)em\s+[\d.]+em\s+([\d.]+)em/);
  const letters = (46 - +pad[1] - +pad[2]) / 0.6;
  assert.ok(letters >= 55 && letters <= 70, `${letters.toFixed(0)} letters a line`);
  // a phone upright: from its width, never under 15 px
  assert.match(HTML, /@media \(max-width: 600px\)\s*\{\s*#dialogue\s*\{\s*--dlg:\s*calc\(clamp\(15px,\s*[\d.]+vw/);
  // the name and the answers in em of it (they scale with it)
  assert.match(rule('#dialogue .dlg-name'), /font-size:\s*1(\.\d+)?em/);
  assert.match(rule('#dialogue .dlg-choices button'), /font-size:\s*0\.9\d?em/);
});

test('answers are words on the paper: no box, no border, no shadow; a cue on the one under the pad, the mouse or a finger', () => {
  const b = rule('#dialogue .dlg-choices button');
  assert.match(b, /background:\s*none/);
  assert.match(b, /border:\s*0/);
  assert.match(b, /box-shadow:\s*none/);
  assert.ok(!/transform/.test(rule('#dialogue .dlg-choices button:hover, #dialogue .dlg-choices button:focus')), 'nothing jumps when it is picked');
  assert.match(rule('#dialogue .dlg-choices button:hover .dlg-say, #dialogue .dlg-choices button:focus .dlg-say'), /text-decoration-line:\s*underline/);
  // the pad's badge on the focused one, the keyboard's numbers, touch's mark (choiceHtml)
  assert.match(choiceHtml({ index: 0, text: '~neutral~ Yes.' }, 0, 'A / ×'), /dlg-num">1<.*dlg-mark">›<.*A \/ ×/);
  assert.match(HTML, /body\.controller #dialogue button:focus \.dlg-key \.key \{ visibility: visible; \}/);
  // Reduce motion: no translator fade either
  assert.match(HTML, /html\.reduce-motion[^{]*#dialogue \.dlg-text\.heard > \.dlg-live[^{]*\{ animation: none; \}/);
  assert.ok(!/dlg-caret/.test(HTML), 'no caret left in the style');
});

test('the Unity bridge\'s panel: the same sizes (a 720-tall canvas), answers without boxes', () => {
  const body = +HUD.match(/const int Body = (\d+)/)[1];
  assert.ok(body / 720 >= 0.028, `${body} px of 720`);
  assert.match(HUD, /Ui\.Panel\(dlgPanel\.rt, "choice" \+ i, Color\.clear, Ui\.Ink, 0\)/);
  assert.ok(!/SetShadow\(hi/.test(HUD), 'no lifted box on the picked answer');
});

test('the name is plain ink on the paper: no black caption box, nothing slanted, no subtitle (issue #208)', () => {
  const tag = rule('#dialogue .dlg-tag'), name = rule('#dialogue .dlg-name');
  assert.ok(!/background|box-shadow|rotate|skew/.test(tag + name), `${tag} ${name}`);
  assert.match(tag, /color:\s*#2b211f/);
  assert.ok(!/font-style:\s*italic/.test(name));
  assert.ok(!/dlg-title/.test(HTML), 'no subtitle rule left in the style');
  const { d, ui } = talk({ ...ALIEN, title: 'Keeper of the well' });
  assert.equal(ui.part('.dlg-name').textContent, 'Tester');
  assert.ok(!/dlg-title/.test(ui.root.innerHTML), 'no subtitle element in the panel');
  assert.equal(d.publish() ?? true, true);
  d.close();
  // the Unity bridge's panel draws the same: no ink fill behind the name, no title shown
  assert.match(HUD, /dlgTag = Ui\.Panel\(dlg, "tag", Color\.clear, Ui\.Ink, 0\)/);
  assert.match(HUD, /Show\(dlgTitle, false\)/);
});

test('once they are done talking, the first answer is the default: focused, with or without a pad (issue #211)', () => {
  const { d, ui } = talk({ ...ALIEN, talk: { nodes: {
    a: { say: ['~neutral~ First page.', '~neutral~ Then a question?'], choices: [{ text: '~curious~ Go on.', goto: 'b' }, { text: '~neutral~ No.', end: true }] },
    b: { say: ['~neutral~ Straight on.'], choices: [{ text: '~curious~ And?', end: true }, { text: '~neutral~ Enough.', end: true }] },
  } } });
  const box = ui.part('.dlg-choices'), focused = [];
  const buttons = () => [...box.innerHTML.matchAll(/data-i="(\d+)"/g)].map((m) => ({ i: +m[1], dataset: { i: m[1] }, focus() { focused.push(this.i); } }));
  box.querySelectorAll = () => buttons();
  box.querySelector = (s) => (s === 'button' ? buttons()[0] ?? null : null);
  d.render();
  assert.deepEqual(focused, [], 'nothing focused while they are still talking');
  d.next();
  assert.deepEqual(focused, [0], 'the first answer focused as the answers come');
  d.choose(d.runner.choices()[0].index);
  assert.deepEqual(focused, [0, 0], 'and again when one node\'s answers lead straight to the next\'s');
  d.render();
  assert.equal(focused.length, 2, 'a redraw does not take the focus back from where it was moved');
  d.close();
});
