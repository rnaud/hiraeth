// Every hint and announcement has one look and one place (issue #306: src/hint-look.js, docs/systems/ui.md "Hints:
// one look, one place"): the dark strip from index.html's --hint-* variables, the top centre for all but the prompt
// that floats over what it is about, the cue first in the stack, the Unity bridge drawing the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HINT, HINT_ENGINE, HINT_KINDS, HINT_VARS } from '../src/hint-look.js';
import { layoutCinema, OBSTACLES } from '../src/ship/cinema.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const html = src('index.html'), cine = src('src/ship/cinema.js');
// (cinema.js's CSS with HINT's values put in, as the page gets it)
const cineCss = cine.replace(/\$\{HINT\.(\w+)\}/g, (_, k) => HINT[k]);
const css = html + '\n' + cineCss;
/** The declarations of every block whose selector list has `sel` itself (comments dropped; @media blocks' insides too). */
function rules(sel) {
  const out = [], text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (m[1].split(',').map((x) => x.trim()).includes(sel)) out.push(m[2]);
  return out.join(';');
}

test('the strip\'s values: index.html\'s :root carries src/hint-look.js HINT as written', () => {
  assert.ok(html.includes(HINT_VARS), 'the --hint-* variables in :root');
  assert.match(HINT.bg, /^rgba\((\d+), (\d+), (\d+), 0\.9\d\)$/);
  const [r, g, b] = HINT.bg.match(/\d+/g).map(Number);
  assert.ok(Math.max(r, g, b) < 24, 'near-black (the author: "black or dark black")');
  assert.deepEqual(HINT_ENGINE.bg.slice(0, 3).map((x) => Math.round(x * 255)), [r, g, b]);
  assert.equal(HINT_ENGINE.ink, HINT.ink);
});

test('every hint kind is drawn on the strip: its background and its letters the variables, no cream paper left', () => {
  for (const k of HINT_KINDS) {
    const r = rules(k.sel);
    if (k.id === 'quest') { assert.match(rules('#toast.quest .qk'), /var\(--hint-accent/, 'the quest\'s mark in gold'); continue; }   // (the toast's own strip)
    assert.match(r, /background:\s*var\(--hint-bg/, `${k.sel}: the dark strip`);
    const ink = k.id === 'objective' ? rules('#objective') : r;   // (the card's letters are its holder's)
    assert.match(ink, /(^|;|\s)color:\s*var\(--hint-ink/, `${k.sel}: cream letters`);
    assert.doesNotMatch(r, /background:\s*(#f7ecd2|#fffaf0|#f7eed9|rgba\((247, 236, 210|255, 250, 240))/, `${k.sel}: no cream background`);
  }
  // a button's badge on the strip: cream with the ink letter
  assert.match(rules('#cue:not(.glyph) .key'), /background:\s*var\(--hint-ink\)/);
});

test('one place: the top centre for every hint but the prompt over what it is about', () => {
  for (const k of HINT_KINDS.filter((x) => x.place === 'top' && ['cue', 'toast', 'photo', 'pad'].includes(x.id))) {
    const r = rules(k.sel);
    assert.match(r, /top:\s*var\(--hint-top\)/, `${k.sel}: at the top`);
    assert.doesNotMatch(r, /bottom:\s*calc/, `${k.sel}: not at the bottom`);
    assert.match(r, /left:\s*50%/, `${k.sel}: centred`);
  }
  assert.deepEqual(HINT_KINDS.filter((k) => k.place !== 'top').map((k) => k.id), ['prompt']);
  // the cue heads the stack the layout places: it is an item of it, not an obstacle the notices slide round
  assert.ok(!OBSTACLES.some((o) => o.startsWith('#cue')));
  assert.match(cine, /place = \{ cue: 'top', hint: 'top', toast: 'top', objective: 'top'/);
  const L = layoutCinema({ w: 1280, h: 720, items: [{ id: 'cue', w: 300, h: 30, place: 'top' }, { id: 'toast', w: 500, h: 30, place: 'top' }, { id: 'objective', w: 400, h: 34, place: 'top' }] });
  assert.ok(L.rects.cue.y1 <= L.rects.toast.y0 && L.rects.toast.y1 <= L.rects.objective.y0, 'stacked down from the top, the cue first');
  for (const r of Object.values(L.rects)) assert.ok(Math.abs((r.x0 + r.x1) / 2 - 640) < 1, 'each centred');
  // the cue lays the stack out again as it shows (main.js)
  assert.match(src('src/main.js'), /cue\.onChange = \(\) => ship\.cinema\.layout\(\)/);
});

test('Cue.onChange: called as the cue shows, hides or changes kind, not for every word', async () => {
  const { Cue } = await import('../src/hud.js');
  const el = { innerHTML: '', classList: { toggle() {}, contains: () => false } };
  const c = new Cue(el);
  let n = 0; c.onChange = () => n++;
  c.set('E open'); assert.equal(n, 1);
  c.set('E open'); c.set('E open the hatch'); assert.equal(n, 1, 'the same line, or its words: no new layout');
  c.set('Golden Dunes', 'place'); assert.equal(n, 2);
  c.set(''); assert.equal(n, 3);
});

test('the Unity bridge draws the toast and the cue on the same strip, the cue at the top and the toast under it', () => {
  const cs = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs');
  const [r, g, b, a] = HINT_ENGINE.bg;
  assert.ok(cs.includes(`new Color(${Math.round(r * 255)} / 255f, ${Math.round(g * 255)} / 255f, ${Math.round(b * 255)} / 255f, ${a}f)`), 'HintBg');
  assert.ok(cs.includes(`HintInk0 = Ui.Hex("${HINT_ENGINE.ink}")`));   // (HintBg0, HintInk0: the plain speech background turns them black and white, issue #346)
  assert.ok(cs.includes(`const float HintTop = ${HINT_ENGINE.top}, HintGap = ${HINT_ENGINE.gap};`));
  assert.match(cs, /toast = Ui\.Panel\(root, "toast", HintBg/);
  assert.match(cs, /cue = Ui\.Panel\(root, "cue", HintBg/);
  assert.match(cs, /Ui\.Place\(cue\.rt, W \/ 2 - w \/ 2, HintTop, w, h\)/);
  assert.doesNotMatch(cs, /H - 46 - h/, 'no cue at the bottom');
});
