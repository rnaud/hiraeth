// The Debug menu (src/world-picker.js): sections with a heading each (Play, Story places, Test rooms,
// Worlds in progress, Games, Pages, This build), one card style for the worlds and one row style for the
// rest, a filter, LB / RB between sections, and the links it always had (tests and pages open them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PAGES, DEV_PAGES, MAYBE_PAGES, pagesHere, worldSections, pickOrder, menuSections, matcher, rowHtml, sectionHtml,
  buildRows, pickHref, cardHtml, probePages, restoreLast, LAST_KEY, DEBUG_NOTE,
} from '../src/world-picker.js';
import { LEVELS } from '../src/levels/index.js';
import { ORDER, WIP } from '../src/levels/names.js';
import { DEBUG_MENU_HREF } from '../src/debug-back.js';
import { gitBuildInfo } from '../vite.config.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('every world is in exactly one section: the route in story order, the places, the test rooms, the worlds in progress', () => {
  const s = worldSections(LEVELS);
  assert.deepEqual(s.play.map((l) => l.id), ORDER, 'Play: the route, in story order');
  assert.ok(s.rooms.length >= 4 && s.rooms.every((l) => l.dev), 'Test rooms: the dev rooms');
  for (const id of ['arena', 'arcade', 'lab', 'references']) assert.ok(s.rooms.some((l) => l.id === id), id);
  assert.ok(s.progress.every((l) => WIP.includes(l.id)), 'Worlds in progress: names.js WIP');
  assert.deepEqual(s.places.slice(0, 3).map((l) => l.id), ['home', 'lantern', 'atelier']);
  const all = [...s.play, ...s.places, ...s.rooms, ...s.progress].map((l) => l.id);
  assert.equal(all.length, LEVELS.length);
  assert.deepEqual([...all].sort(), LEVELS.map((l) => l.id).sort());
  assert.deepEqual(pickOrder(LEVELS).map((l) => l.id), all, 'numbered in the order shown');
});

test('the sections, in order, with their cards numbered as shown', () => {
  const games = [{ id: 'ski', name: 'Dune skiing', blurb: 'down the dunes' }];
  const secs = menuSections({ levels: LEVELS, cont: { id: 'incal', title: 'The City-Shaft' }, current: 'arzach', dev: false, games });
  assert.deepEqual(secs.map((s) => s.key), ['play', 'places', 'rooms', 'progress', 'games', 'pages', 'build']);
  const play = secs[0].html;
  assert.match(play, /class="row continue" href="\?level=incal"/, 'Continue first, to the world this save was left in');
  assert.match(play, /href="\?level=desert&debugsave=1"[^>]*>[\s\S]*?<b class="num">1<\/b>/, 'the route\'s first world is number 1');
  assert.match(play, /class="card current" href="\?level=arzach&debugsave=1"/);
  const rooms = secs.find((s) => s.key === 'rooms').html;
  assert.match(rooms, /href="\?level=arena"/, 'a test room opens in your save, as before');
  assert.match(secs.find((s) => s.key === 'games').html, /href="\?game=ski"/);
});

test('pages: every link kept, the dev server\'s marked and only there, the References slot hidden until it answers', () => {
  for (const f of ['changelog.html', 'audits.html', 'items.html', 'enemies.html', 'studio.html', 'motion.html', 'cinematics.html', 'trailer.html']) {
    assert.ok(PAGES.some((p) => p.href === f), f);
  }
  assert.ok(DEV_PAGES.every((p) => p.dev));
  assert.ok(MAYBE_PAGES.some((p) => p.href === 'references.html'));
  const prod = menuSections({ levels: LEVELS, dev: false, games: [] }).find((s) => s.key === 'pages').html;
  const dev = menuSections({ levels: LEVELS, dev: true, games: [] }).find((s) => s.key === 'pages').html;
  assert.doesNotMatch(prod, /reference-lab\.html/, 'a build has no reference lab');
  assert.match(dev, /href="reference-lab\.html"[\s\S]*?<small class="tag">dev server<\/small>/, 'the dev server lists it, marked');
  assert.match(prod, /<a class="row maybe" href="references\.html"[^>]* hidden data-maybe=""/);
  assert.ok(pagesHere(false).every((p) => !p.dev));
});

test('the References page shows up once it answers (and not when the game\'s own page comes back instead)', async () => {
  const a = { hidden: true, getAttribute: () => 'references.html' };
  const root = { querySelectorAll: () => [a] };
  await probePages(root, async () => ({ ok: true, text: async () => '<html><body><div id="picker"></div></body></html>' }));
  assert.equal(a.hidden, true, 'a fallback to index.html');
  await probePages(root, async () => ({ ok: false, text: async () => '' }));
  assert.equal(a.hidden, true, '404');
  await probePages(root, async () => ({ ok: true, text: async () => '<html><body data-debug-back>References</body></html>' }));
  assert.equal(a.hidden, false);
});

test('the filter: every word must be found; nothing typed shows all', () => {
  assert.equal(matcher('')('anything'), true);
  assert.equal(matcher('the arena')('the arena for testing the blade arena'), true);
  assert.equal(matcher('ARENA lab')('the arena'), false);
  const row = rowHtml({ href: 'audits.html', label: 'Audits', hint: 'Every audit report' });
  assert.match(row, /data-q="audits every audit report audits\.html"/, 'found by its name, its line and its file');
  assert.match(row, /<span class="lbl">Audits<\/span><span class="hint">Every audit report<\/span>/);
  assert.match(row, /data-glyph="ok"/, 'A on the focused row, as on the cards');
  assert.match(cardHtml(LEVELS[0], 0), /data-q="the desert [^"]*desert/);
});

test('a section: its heading with one line', () => {
  const h = sectionHtml('pages', 'Pages', 'the other pages', '<a></a>');
  assert.match(h, /<section class="dbg-section" id="dbg-pages" data-section="pages"/);
  assert.match(h, /<h2 class="sec" id="dbg-pages-h">Pages <small>the other pages<\/small><\/h2>/);
});

test('This build: version, build number, commit, where it runs, and the debug save\'s note', () => {
  const h = buildRows({ version: '9.9', info: { commit: 'abcdef12', build: 1234 }, dev: false });
  assert.match(h, /v9\.9/);
  assert.match(h, /build 1234/);
  assert.match(h, /abcdef12/);
  assert.match(h, /the built game/);
  assert.ok(h.includes(DEBUG_NOTE.slice(0, 40)));
  assert.match(buildRows({ info: {}, dev: true, app: 'web build 14 · app 12' }), /web build 14 · app 12[\s\S]*unknown[\s\S]*dev server/);
  const runs = { 'rev-parse --short=8 HEAD': 'abcdef12', 'rev-parse --is-shallow-repository': 'false', 'rev-list --count HEAD': '4321' };
  assert.deepEqual(gitBuildInfo((...a) => runs[a.join(' ')]), { commit: 'abcdef12', build: 4321 });
  assert.deepEqual(gitBuildInfo((...a) => (a[1] === '--is-shallow-repository' ? 'true' : runs[a.join(' ')])), { commit: 'abcdef12' }, 'a shallow clone: no build number');
  assert.deepEqual(gitBuildInfo(() => { throw new Error('no git'); }), {});
  assert.match(src('vite.config.js'), /define: \{ __HIRAETH_BUILD__: JSON\.stringify\(gitBuildInfo\(\)\) \}/);
});

test('the way back: the same URL, and the item opened last gets the focus again', () => {
  assert.equal(DEBUG_MENU_HREF, './?worlds=1');
  assert.equal(pickHref('desert'), '?level=desert&debugsave=1');
  assert.equal(pickHref('arena'), '?level=arena');
  let focused = null;
  const a = (href) => ({ hidden: false, getAttribute: () => href, focus() { focused = href; }, scrollIntoView() {} });
  const picker = { querySelectorAll: () => [a('audits.html'), a('?level=arena')] };
  const store = { getItem: (k) => (k === LAST_KEY ? '?level=arena' : null) };
  assert.ok(restoreLast(picker, store));
  assert.equal(focused, '?level=arena');
  assert.equal(restoreLast(picker, { getItem: () => null }), null);
});

test('controller and keys: LB / RB between sections, Y the filter, B back; typing filters', () => {
  const picker = src('src/world-picker.js');
  assert.match(picker, /picker\.dataset\.gridNav = ''/);
  assert.match(picker, /name === 'tabPrev' \|\| name === 'tabNext'\) menu\.jump/);
  assert.match(picker, /name === 'y'\) menu\.focusSearch\(\)/);
  assert.match(picker, /glyph\('lb'\)/);
  const main = src('src/main.js');
  assert.match(main, /menuRoot\(\) === picker\) debugMenu\.jump/, 'in the game too (L)');
  assert.match(main, /if \(debugMenu\.typeKey\(e\)\) e\.stopPropagation\(\)/, 'a letter is the filter\'s, not the game\'s');
  // a pad never lands in the text box by the D-pad (the handheld's keyboard would open): only Y
  assert.match(src('src/world-picker.css'), /body\.controller #picker:not\(\.typing\):not\(\.filtering\) \.search input \{ display: none; \}/);
  assert.match(src('src/boot.js'), /import '\.\/world-picker\.css'/);
});
