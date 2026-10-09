// The menus on a controller (October 2026): a grid moves in 2D (the worlds list, the items page), the
// button prompts sit inside the buttons, and they are drawn for the controller in hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { familyOf, padFamily, padFaces, padIndex, padText, confirmKey } from '../src/native-pad.js';
import { padGlyphs, glyphVars, glyphCss, glyph, GLYPH_ROLES } from '../src/pad-glyphs.js';
import { gridStep } from '../src/menu-pad.js';
import { Controller } from '../src/controller.js';
import { shortLine } from '../src/items-page/view.js';
import { cardHtml } from '../src/world-picker.js';
import { ITEMS } from '../src/items.js';

const fakeWin = (ids = [], search = '', extra = {}) => ({ location: { search }, localStorage: { getItem: () => null }, navigator: { getGamepads: () => ids.map((id) => ({ id })) }, ...extra });
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the controller\'s family, from the Gamepad id', () => {
  assert.equal(familyOf('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
  assert.equal(familyOf('Xbox 360 Controller (XInput STANDARD GAMEPAD)'), 'xbox');
  assert.equal(familyOf('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'playstation');
  assert.equal(familyOf('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'), 'playstation', 'a DualShock 4 on Windows');
  assert.equal(familyOf('054c-0ce6-DualSense Wireless Controller'), 'playstation', 'Firefox\'s form');
  assert.equal(familyOf('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'), 'nintendo');
  assert.equal(familyOf('Joy-Con L+R (STANDARD GAMEPAD Vendor: 057e Product: 200e)'), 'nintendo');
  assert.equal(familyOf('Retroid Pocket Controller'), 'handheld');
  assert.equal(familyOf('8BitDo SN30 Pro (STANDARD GAMEPAD Vendor: 2dc8)'), 'xbox', 'a pad we do not know: the standard\'s own names');
  assert.equal(familyOf(''), '');
  // on the page: the first pad listed; the Android layout is always the handheld's
  assert.equal(padFamily(fakeWin(['DualSense Wireless Controller (Vendor: 054c)'])), 'playstation');
  assert.equal(padFamily(fakeWin([])), '', 'no pad: the prompts stay as written');
  assert.equal(padFamily(fakeWin(['Xbox Wireless Controller'], '?pad=android')), 'handheld');
  assert.equal(padFamily(fakeWin(['Retroid Pocket Controller'])), 'handheld');
});

test('a Switch pad on a computer confirms with its A, on the right (as on a Switch)', () => {
  const sw = fakeWin(['Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)']);
  assert.deepEqual(padFaces(sw), { faces: 'nintendo', byLabel: false }, 'reported by position, A on the right');
  assert.equal(padIndex('ok', sw), 1, 'the right button confirms');
  assert.equal(padIndex('back', sw), 0);
  assert.equal(confirmKey(sw), 'B / ○', '(by position: the right one)');
  assert.deepEqual(padFaces(fakeWin(['DualSense Wireless Controller (054c)'])), { faces: 'xbox', byLabel: false }, 'PlayStation: × at the bottom confirms');
  assert.deepEqual(padFaces(sw, 'xbox'), { faces: 'xbox', byLabel: false }, 'the setting still decides');
});

test('prompts in the family\'s own names: the half of "A / ×" that matches, and its shoulders and menu buttons', () => {
  const line = 'A / × jump · B / ○ evade · X / □ use · Y / △ gadget · LB / L1 guard · RT / R2 jets · L3 run · View sketchbook · Menu settings';
  assert.equal(padText(line, 'standard', 'xbox', 'xbox'), 'A jump · B evade · X use · Y gadget · LB guard · RT jets · LS run · View sketchbook · Menu settings');
  assert.equal(padText(line, 'standard', 'xbox', 'playstation'), '× jump · ○ evade · □ use · △ gadget · L1 guard · R2 jets · L3 run · Create sketchbook · Options settings');
  assert.equal(padText(line, 'standard', 'nintendo', 'nintendo'), 'B jump · A evade · Y use · X gadget · L guard · ZR jets · LS run · − sketchbook · + settings', 'a Switch pad: B at the bottom');
  assert.equal(padText(line, 'android', 'nintendo', 'playstation'), padText(line, 'android', 'nintendo'), 'the Android layout: the handheld\'s names, as before');
  assert.equal(padText(line, 'standard', 'xbox'), line, 'no pad listed: as written');
  assert.equal(padText('LB/RB down/up · LT tool', 'standard', 'xbox', 'playstation'), 'L1/R1 down/up · L2 tool');
  assert.equal(padText('A Menu of the day, View from the rim', 'standard', 'xbox', 'playstation'), 'A Menu of the day, View from the rim', 'ordinary words stay');
});

test('the glyphs inside the buttons: each role\'s label for each controller', () => {
  const L = (o) => Object.fromEntries(Object.entries(padGlyphs(o)).map(([k, v]) => [k, v.text]));
  const xbox = L({ family: 'xbox' });
  assert.deepEqual([xbox.ok, xbox.back, xbox.x, xbox.y, xbox.lb, xbox.rb, xbox.view, xbox.menu], ['A', 'B', 'X', 'Y', 'LB', 'RB', 'View', 'Menu']);
  const ps = L({ family: 'playstation' });
  assert.deepEqual([ps.ok, ps.back, ps.x, ps.y, ps.lb, ps.rb, ps.lt, ps.view, ps.menu], ['×', '○', '□', '△', 'L1', 'R1', 'L2', 'Create', 'Options']);
  const sw = L({ family: 'nintendo', faces: 'nintendo' });
  assert.deepEqual([sw.ok, sw.back, sw.x, sw.y, sw.lb, sw.rt, sw.view, sw.menu], ['A', 'B', 'Y', 'X', 'L', 'ZR', '−', '+'], 'confirm is the right button, printed A');
  const retroid = L({ family: 'handheld', faces: 'nintendo', layout: 'android' });
  assert.deepEqual([retroid.ok, retroid.back, retroid.x, retroid.lb, retroid.view, retroid.menu], ['A', 'B', 'Y', 'L1', 'Select', 'Start'], 'a Retroid: its own letters');
  assert.equal(L({ family: '' }).ok, 'A', 'a pad not listed yet: as Xbox');
  // the colours of the face buttons where the pad has them, the shapes a little larger
  assert.equal(padGlyphs({ family: 'xbox' }).ok.colour, '#4f9a3c');
  assert.equal(padGlyphs({ family: 'playstation' }).back.colour, '#d0504a');
  assert.equal(padGlyphs({ family: 'nintendo', faces: 'nintendo' }).ok.colour, '');
  assert.ok(padGlyphs({ family: 'playstation' }).ok.scale > 1);
  // as CSS custom properties, and the page's rules
  const vars = glyphVars(padGlyphs({ family: 'playstation' }));
  assert.match(vars, /--g-ok: "×";/); assert.match(vars, /--g-back: "○";/); assert.match(vars, /--gc-x: #c76aa8;/);
  const css = glyphCss();
  for (const r of Object.keys(GLYPH_ROLES)) assert.match(css, new RegExp(`body\\.controller \\.glyph\\[data-glyph="${r}"\\]::before \\{ content: var\\(--g-${r}\\)`));
  assert.match(css, /body:not\(\.controller\) \.glyph\[data-glyph="ok"\]:not\(\[data-key\]\)::before \{ content: "Enter"; \}/, 'the keys: Enter');
  assert.match(css, /body:not\(\.controller\) \.glyph\[data-key\]::before \{ content: attr\(data-key\); \}/, 'or the key the glyph names');
  assert.match(css, /body\.touch \.glyph \{ display: none !important; \}/, 'a touch screen: nothing, the buttons are tapped');
  assert.equal(glyph('back', { key: 'Esc' }), '<span class="glyph" data-glyph="back" data-key="Esc" aria-hidden="true"></span>');
  assert.match(glyph('ok', { focus: true }), /class="glyph on-focus"/);
});

test('the prompts sit inside the buttons of every menu, not in hint lines under them', () => {
  const title = src('src/title.js');
  assert.match(title, /data-a="back">\$\{glyph\('back', \{ key: 'Esc' \}\)\}/, 'the saves\' Back');
  assert.match(title, /data-a="keep">\$\{glyph\('back'/, 'the delete question\'s Keep');
  assert.match(title, /glyph\('x', \{ key: 'Del' \}\)\}\$\{t\('title\.delete'\)\}/, 'a save\'s Delete: X / □');
  assert.match(title, /const lbl = \(text\) => `<span class="lbl">\$\{glyph\('ok', \{ focus: true \}\)\}/, 'the focused entry: A');
  const ui = src('src/ui.js');
  assert.match(ui, /data-a="close" class="primary">\$\{game \? t\('menu\.resume'\) : t\('menu\.back'\)\}\$\{glyph\('back'/, 'Resume / Back: B');
  assert.match(ui, /data-a="reset-no">\$\{glyph\('back'/);
  const map = src('src/ship/starmap.js');
  assert.doesNotMatch(map, /travel · \$\{backKey\(\)\} close|yes · \$\{backKey\(\)\} no/, 'the map: no hint lines');
  assert.match(map, /class="close">\$\{glyph\('back'/); assert.match(map, /class="yes">\$\{glyph\('ok'/); assert.match(map, /class="no">\$\{glyph\('back'/);
  assert.doesNotMatch(src('src/ship/homecoming.js'), /A \/ × or ENTER/);
  assert.match(src('index.html'), /<div id="restart"[^\n]*data-glyph="ok"/, 'the restart dialog');
  assert.doesNotMatch(src('src/main.js'), /restart\.pad/);
  assert.doesNotMatch(src('items.html'), /class="hint"/, 'the items page: its keys are in its buttons');
  for (const f of ['src/boot.js', 'src/items-page/main.js']) assert.match(src(f), /installGlyphs\(\)/, `${f}: the glyphs follow the pad`);
});

test('a grid on a controller: the D-pad moves to the card that is that way', () => {
  // three columns of 100 × 80 cards, 10 apart, under a header row (a close button on the right)
  const cell = (c, r) => ({ left: c * 110, top: 60 + r * 90, width: 100, height: 80 });
  const rects = [{ left: 300, top: 0, width: 60, height: 30 }, ...[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => cell(c, r)))];
  rects.splice(9, 1);   // (the last row has two cards)
  const at = (c, r) => 1 + r * 3 + c;
  assert.equal(gridStep(rects, at(0, 0), 1, 0), at(1, 0), '→ the next in the row');
  assert.equal(gridStep(rects, at(1, 0), 0, 1), at(1, 1), '↓ the one below, not the next in the list');
  assert.equal(gridStep(rects, at(2, 0), 1, 0), at(2, 0), '→ at the row\'s end: stays');
  assert.equal(gridStep(rects, at(1, 1), -1, 0), at(0, 1));
  assert.equal(gridStep(rects, at(2, 1), 0, 1), at(1, 2), '↓ with no card below: the nearest in the row under it');
  assert.equal(gridStep(rects, at(0, 0), 0, -1), 0, '↑ from the first row: the header');
  assert.equal(gridStep(rects, at(1, 2), 0, 1), 0, '↓ from the last row wraps to the top');
  assert.equal(gridStep(rects, 0, 0, -1), at(1, 2), '↑ from the top wraps to the last row, nearest the column');
  assert.equal(gridStep(rects, -1, 0, 1), 0, 'nothing focused: the first');
  assert.equal(gridStep([], 0, 1, 0), -1);
  // the focused card is drawn lifted and a little larger: its column's neighbours aren't "to the right"
  const lifted = rects.map((r, i) => (i === at(2, 0) ? { left: r.left - 7, top: r.top - 7, width: 104, height: 84 } : r));
  assert.equal(gridStep(lifted, at(2, 0), 1, 0), at(2, 0));
  assert.equal(gridStep(lifted, at(2, 0), 0, 1), at(2, 1));
  // a list of one column: → doesn't jump up to the header
  const list = [{ left: 0, top: 0, width: 300, height: 30 }, { left: 0, top: 40, width: 300, height: 100 }, { left: 0, top: 150, width: 300, height: 100 }];
  assert.equal(gridStep(list, 2, 1, 0), 2);
  // the worlds list and the items page opt in; other menus keep moving in their order
  const nav = src('src/controller.js');
  assert.match(nav, /const grid = !!root\.closest\?\.\('\[data-grid-nav\]'\)/);
  assert.match(src('src/world-picker.js'), /picker\.dataset\.gridNav = ''/);
  assert.match(src('src/items-page/main.js'), /document\.body\.dataset\.gridNav = ''/);
});

test('the worlds list: small cards, the words of the focused one at the foot', () => {
  const html = cardHtml({ id: 'desert', title: 'The Desert', source: 'after Sable', blurb: 'Dunes & mesas.', moves: 'walk' }, 0, true);
  assert.match(html, /class="card current"/);
  assert.match(html, /<b class="num">1<\/b>/);
  assert.match(html, /data-glyph="ok"/, 'A on the focused card');
  assert.match(html, /title="Dunes &amp; mesas\."/, 'the blurb is its tooltip, not on the card');
  assert.doesNotMatch(html, /<p>/);
  assert.match(src('index.html'), /#picker \.cards \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(min\(176px/);
});

test('a menu\'s extra buttons on a pad: X / □ and Y / △ (a save\'s Delete, the items page\'s reset and turn)', () => {
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const actions = [];
  let ctx = 'menu';
  const c = new Controller({ pads: () => [pad], context: () => ctx, action: (a) => actions.push(a), look() {}, navigate() {}, scroll() {} });
  const tap = (i) => { pad.buttons[i] = { pressed: true, value: 1 }; c.update(0.016); pad.buttons[i] = { pressed: false, value: 0 }; c.update(0.016); };
  tap(2); tap(3);
  assert.deepEqual(actions, ['x', 'y']);
  ctx = 'talk'; c.update(0.016); actions.length = 0;
  tap(2); assert.deepEqual(actions, ['confirm'], 'in a conversation X / □ still carries it on');
});

test('the item viewer full screen: one short line, the rest on request beside the item', () => {
  assert.equal(shortLine('A makers’ glass tank with a hose to a leather glove: the glove is what shoots. Fill it with living water.'), 'A makers’ glass tank with a hose to a leather glove: the glove is what shoots.');
  assert.equal(shortLine('Short.'), 'Short.');
  const long = shortLine('word '.repeat(40));
  assert.ok(long.length <= 90 && long.endsWith('…'), long);
  for (const [id, it] of Object.entries(ITEMS)) assert.ok(shortLine(it.text).length <= 90, `${id}: ${shortLine(it.text)}`);
  const page = src('items.html');
  assert.match(page, /#full \.about \.long \{ display: none; \}/, 'what it does: only with "more"');
  assert.match(page, /#full\.more canvas \{ left: min\(380px, 42vw\)/, 'opened, the item moves over beside the words');
  assert.match(page, /@media \(max-height: 480px\)/, 'a handheld\'s small screen: smaller still');
});
