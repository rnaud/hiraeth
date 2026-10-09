// Button prompts never reach the screen as a pair ("A / ×", "RT / R2"): the game writes them so in its
// source (Xbox / PlayStation form), and src/native-pad.js shows one half, for the pad listed, else the one
// remembered on this device, else the platform's own (a Steam pad, the Deck's app: Xbox letters). Every
// prompt string in the language files, the data and the source goes through the page's rendering here, for
// each kind of pad and for none listed yet (the Steam Deck before its first press showed both halves).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { promptText, padText, pageFamily, platformFamily, familyOf, onSteam, rememberFamily, rememberedFamily, watchLabels, labelState, PAD_FAMILY_KEY } from '../src/native-pad.js';
import { EN } from '../src/i18n/en.js';
import { FR } from '../src/i18n/fr.js';
import { BUTTON_NAME, PAD, PAD_SCHEME_NOTE } from '../src/bindings.js';
import { CHANGELOG, lineText } from '../src/changelog.js';
import { GLYPH_ROLES, padGlyphs } from '../src/pad-glyphs.js';
import { padCue } from '../src/hud.js';

/** A pair of the same button's names in two families, as written in the source. */
const PAIR_ONLY = /\b[ABXY] ?\/ ?[×○□△]|\b(?:LB ?\/ ?L1|RB ?\/ ?R1|LT ?\/ ?L2|RT ?\/ ?R2)\b/;

// ---- every prompt string
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.js$/.test(f)) out.push(p);
  }
  return out;
}
const LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
function sourceStrings() {
  const out = [];
  for (const file of walk('src')) {
    for (const m of readFileSync(file, 'utf8').matchAll(LITERAL)) if (PAIR_ONLY.test(m[0])) out.push(m[0].slice(1, -1));
  }
  return out;
}
const strings = [
  ...Object.values(EN), ...Object.values(FR),
  ...Object.values(BUTTON_NAME), ...Object.values(PAD), PAD_SCHEME_NOTE,
  ...Object.values(GLYPH_ROLES).filter(Boolean),
  ...CHANGELOG.flatMap((e) => e.items.map(lineText)),
  padCue('SPACE jump · E talk · SHIFT run'),
  ...sourceStrings(),
].filter((s) => typeof s === 'string' && PAIR_ONLY.test(s));

// ---- the cases: what the page knows of the pad in hand
const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const fakeWin = ({ ids = [], protocol = 'https:', ua = 'Mozilla/5.0 (Macintosh)', saved = {}, extra = {} } = {}) => ({
  location: { search: '', protocol }, localStorage: store(saved),
  navigator: { userAgent: ua, getGamepads: () => ids.map((id) => ({ id })) }, ...extra,
});
const page = (win) => ({ layout: win.Capacitor ? 'android' : 'standard', faces: 'xbox', family: pageFamily(win) });
const CASES = {
  xbox: { layout: 'standard', faces: 'xbox', family: 'xbox' },
  playstation: { layout: 'standard', faces: 'xbox', family: 'playstation' },
  nintendo: { layout: 'standard', faces: 'nintendo', family: 'nintendo' },
  handheld: { layout: 'android', faces: 'nintendo', family: 'handheld' },
  'handheld (Xbox letters)': { layout: 'android', faces: 'xbox', family: 'handheld' },
  keyboard: page(fakeWin({ saved: { 'moebius.input.v1': 'keys' } })),
  'no pad listed': page(fakeWin()),
  'no pad listed, a DualSense used before': page(fakeWin({ saved: { [PAD_FAMILY_KEY]: 'playstation' } })),
  'Steam virtual pad': page(fakeWin({ ids: ['Steam Virtual Gamepad (STANDARD GAMEPAD Vendor: 28de Product: 11ff)'] })),
  "the Deck's app, before a press": page(fakeWin({ protocol: 'moebius:', ua: 'Mozilla/5.0 (X11; Linux x86_64)' })),
  'no family at all': { layout: 'standard', faces: 'xbox', family: '' },
};

test('the prompt strings are found (the source, the language files, the changelog)', () => {
  assert.ok(strings.length > 150, `only ${strings.length} prompt strings found`);
  assert.ok(strings.some((s) => s.includes('LB / L1')) && strings.some((s) => s.includes('RT / R2')));
});

for (const [name, opts] of Object.entries(CASES)) {
  test(`no "A / ×" pair survives the page's rendering: ${name}`, () => {
    for (const s of strings) {
      for (const remap of [true, false]) {
        const out = promptText(s, { ...opts, remap });
        assert.ok(!PAIR_ONLY.test(out), `${name}: "${s}" → "${out}"`);
      }
    }
  });
}

test('the half shown is the pad\'s', () => {
  const r = (opts) => promptText('A / × jump · RT / R2 jets · LB / L1 guard', opts);
  assert.equal(r(CASES.xbox), 'A jump · RT jets · LB guard');
  assert.equal(r(CASES.playstation), '× jump · R2 jets · L1 guard');
  assert.equal(r(CASES.nintendo), 'B jump · ZR jets · L guard');
  assert.equal(r(CASES.handheld), 'B jump · R2 jets · L1 guard');
  assert.equal(r(CASES['no pad listed']), 'A jump · RT jets · LB guard', 'none listed: Xbox letters');
  assert.equal(r(CASES['no pad listed, a DualSense used before']), '× jump · R2 jets · L1 guard', 'the pad last used on this device');
  assert.equal(r(CASES['Steam virtual pad']), 'A jump · RT jets · LB guard');
  assert.equal(r(CASES["the Deck's app, before a press"]), 'A jump · RT jets · LB guard');
  for (const opts of Object.values(CASES)) {
    for (const [role, l] of Object.entries(padGlyphs(opts))) assert.ok(!PAIR_ONLY.test(l.text), `glyph ${role}: ${l.text}`);
  }
});

test('Steam\'s pads and the Deck: Xbox letters', () => {
  for (const id of ['Steam Virtual Gamepad', 'Microsoft X-Box 360 pad (STANDARD GAMEPAD Vendor: 28de Product: 11ff)', 'Steam Deck (Vendor: 28de Product: 1205)', '28de-1205-Steam Deck Controller']) assert.equal(familyOf(id), 'xbox', id);
  assert.ok(onSteam(fakeWin({ protocol: 'moebius:' })), 'the Deck\'s app');
  assert.ok(onSteam(fakeWin({ ids: ['Steam Virtual Gamepad'] })));
  assert.ok(!onSteam(fakeWin()));
  assert.equal(platformFamily(fakeWin({ protocol: 'moebius:' })), 'xbox');
  assert.equal(platformFamily(fakeWin({ extra: { Capacitor: { isNativePlatform: () => true } } })), 'handheld', 'the Android app');
  assert.equal(padText('A / × jump', 'standard', 'xbox', 'handheld'), 'A jump', 'a handheld remembered on a computer: its names');
});

test('a listed pad\'s family is remembered for the pages after; a stranger value is not', () => {
  const win = fakeWin();
  assert.equal(rememberedFamily(win), '');
  rememberFamily('playstation', win);
  assert.equal(rememberedFamily(win), 'playstation');
  assert.equal(pageFamily(win), 'playstation');
  rememberFamily('nonsense', win);
  assert.equal(rememberedFamily(win), 'playstation');
  assert.equal(pageFamily(fakeWin({ ids: ['Xbox Wireless Controller'], saved: { [PAD_FAMILY_KEY]: 'playstation' } })), 'xbox', 'the pad listed now first');
  assert.equal(rememberedFamily(fakeWin({ saved: { [PAD_FAMILY_KEY]: 'junk' } })), '');
});

// ---- the page itself: watchLabels rewrites every text node, with no pad listed too
function fakeDom(texts) {
  const body = { nodeType: 1, tagName: 'BODY', classList: { contains: () => false }, closest: () => null, childNodes: [] };
  body.childNodes = texts.map((t) => ({ nodeType: 3, nodeValue: t, parentElement: { closest: () => null, classList: { contains: () => false } } }));
  return body;
}
test('the page with no pad pressed yet shows one half (watchLabels)', () => {
  const lines = ['A / × jump · B / ○ talk', 'hold B / ○ to skip', 'RT / R2 jets · LB / L1 guard'];
  for (const [win, want] of [
    [fakeWin(), ['A jump · B talk', 'hold B to skip', 'RT jets · LB guard']],
    [fakeWin({ ids: ['Steam Virtual Gamepad (Vendor: 28de)'] }), ['A jump · B talk', 'hold B to skip', 'RT jets · LB guard']],
    [fakeWin({ saved: { [PAD_FAMILY_KEY]: 'playstation' } }), ['× jump · ○ talk', 'hold ○ to skip', 'R2 jets · L1 guard']],
  ]) {
    const body = fakeDom(lines);
    win.document = { body };
    win.MutationObserver = class { observe() {} };
    watchLabels(win);
    assert.ok(labelState().family, 'a family, never none');
    assert.deepEqual(body.childNodes.map((n) => n.nodeValue), want);
  }
  const win = fakeWin({ ids: ['DualSense Wireless Controller (Vendor: 054c)'] });
  win.document = { body: fakeDom([]) }; win.MutationObserver = class { observe() {} };
  watchLabels(win);
  assert.equal(win.localStorage.getItem(PAD_FAMILY_KEY), 'playstation', 'the listed pad is remembered');
});
