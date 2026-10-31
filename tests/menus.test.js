import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { LEVELS } from '../src/levels/index.js';
import { PAGES } from '../src/world-picker.js';
import { MENU_SCORE, MENU_HUSH, menuBeat, menuFreq } from '../src/audio.js';
import { opensTitle } from '../src/save-slots.js';

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('the title screen opens the game, a world asked for directly skips it', () => {
  assert.equal(opensTitle(''), true);
  assert.equal(opensTitle('?items=all'), true);
  for (const q of ['?level=edena', '?level=incal&via=ship', '?prologue=1', '?ending=1', '?start']) assert.equal(opensTitle(q), false, q);
  // the page's entry runs the title before the game's modules (and so before any store reads a slot)
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /<script type="module" src="\/src\/boot\.js"><\/script>/);
  const boot = src('boot.js');
  assert.ok(boot.indexOf('await showTitle(') < boot.indexOf("if (!worldsOnly && !chosen?.behind) await import('./main.js')"));
  // the title's Debug entry: the worlds list alone (?worlds=1), without the game (no world built behind it)
  assert.match(src('title.js'), /pathname\}\?worlds=1`/);
  assert.match(boot, /if \(worldsOnly\)[\s\S]*showWorldsOnly\(\)/);
  assert.match(boot, /if \(!worldsOnly && !chosen\?\.behind\) await import\('\.\/main\.js'\)/, 'the game, unless it already runs from behind the title');
  assert.doesNotMatch(src('world-picker.js'), /from '\.\/main\.js'|import\('\.\/main\.js'\)/);
  // every world has its picture in the list (scripts/world-thumbs.mjs), and the other pages are linked from it
  for (const l of LEVELS) assert.ok(existsSync(new URL(`../public/thumbs/${l.id}.jpg`, import.meta.url)), `thumbs/${l.id}.jpg`);
  for (const p of PAGES) assert.ok(existsSync(new URL(`../${p.href}`, import.meta.url)), p.href);
  assert.doesNotMatch(src('title.js'), /studio\.html/, 'the studio is in the worlds list, not on the title');
  // Changelog and world-debug entrypoints are in the admin hub, and on the title only in dev mode (L3 + R3, issue #734).
  assert.match(src('title.js'), /dev && \['data-a="news"'/);
  assert.match(src('admin/main.js'), /new URL\('changelog\.html', home\)/);
  assert.match(src('admin/main.js'), /\?worlds=1&dev=1/);
  // the title imports nothing that loads the game state (it would read the slot before the choice)
  const title = src('title.js');
  for (const m of title.matchAll(/from '\.\/([\w/-]+)\.js'/g)) assert.ok(!['game-state', 'items', 'quest', 'main', 'levels/index', 'levels/content'].includes(m[1]), m[1]);
});

test('menu music: a chord every 8 beats, the music box in tune, the melody every 32', () => {
  const S = MENU_SCORE;
  const bars = Array.from({ length: 64 }, (_, b) => menuBeat(b));
  bars.forEach((ev, b) => assert.equal(ev.filter((e) => e.kind === 'pad').length, b % 8 === 0 ? 3 : 0, `beat ${b}`));
  const melodies = bars.map((ev, b) => [b, ev.filter((e) => e.kind === 'flute' || e.kind === 'bell')]).filter(([, m]) => m.length);
  assert.deepEqual(melodies.map(([b]) => b), [8, 40]);
  assert.equal(melodies[0][1][0].kind, 'flute');
  assert.equal(melodies[1][1][0].kind, 'bell');
  // every note is a degree of D lydian, between a low D and a high A
  for (const ev of bars) for (const e of ev) {
    const f = menuFreq(e.degree, e.octave);
    assert.ok(f > 60 && f < 1300, `${e.kind} ${f}`);
    assert.ok(e.vol > 0 && e.vol <= 0.08);
  }
  assert.equal(menuFreq(0), S.root);
  assert.ok(Math.abs(menuFreq(7) - 2 * S.root) < 1e-9);
  assert.deepEqual(menuBeat(17), menuBeat(17), 'the same each time');
  assert.ok(MENU_HUSH > 0 && MENU_HUSH < 0.3, 'the world is hushed, not stopped');
});

test('the full-screen menus pause the game and bring in the menu music', () => {
  const main = src('main.js');
  assert.match(main, /const paused = \(\) => !!window\.cinematicReview\?\.paused \|\| menu\.open \|\| journal\.open \|\| changelog\.open( \|\| devMenu\.open)?( \|\| !!minigame\?\.paused)?;/);   // (and a minigame's pause card: src/minigames/kit/runner.js)
  // frame(): under a menu nothing in the world updates or draws, and the world's clock stops
  // (the gadget wheel open: the game waits too, issue #524: wheelFrame)
  assert.match(main, /if \(paused\(\)\) \{ pausedFrame\(\); requestAnimationFrame\(frame\); return; \}\s*(\/\/[^\n]*\n\s*)?if \(gadgets\?\.wheelOn && !busy\(\)\) \{ wheelFrame\([^\n]*\n\s*simT \+= dt;\s*const t = simT;/);
  assert.match(main, /sound\.menuMusic\(paused\(\)\)/);
  // the Start menu acts on this save only, and can quit to the title
  assert.match(main, /slots\.remove\(slots\.active\)/);
  assert.match(main, /onQuit: \(\) => quitToTitle\(\)/);
  assert.doesNotMatch(main, /localStorage\.removeItem\('hiraeth\.journal\.v1'\)/);
  const ui = src('ui.js');
  assert.match(ui, /data-a="title">\$\{t\('menu\.quit'\)\}\$\{F\}</);   // (the words: src/i18n/en.js; F the confirm glyph on the focused entry)
  assert.doesNotMatch(ui, /[^.\w]confirm\('/, 'no browser confirm(): a controller cannot answer it');
});

test('no keyboard-only "J to close" on a controller: every panel says how to close it with the hands on the game, and B / ○ closes it', async () => {
  const { closeHint, inputKind } = await import('../src/prompt-keys.js');
  const { padText } = await import('../src/native-pad.js');
  const doc = (...cls) => ({ body: { classList: { contains: (c) => cls.includes(c) } } });
  assert.equal(inputKind(doc('controller')), 'pad'); assert.equal(inputKind(doc('touch')), 'touch'); assert.equal(inputKind(doc()), 'keys');
  assert.equal(closeHint('J or Esc', 'keys'), 'J or Esc to close');
  assert.equal(closeHint('J or Esc', 'pad', 'B / ○'), 'B / ○ close', 'an Xbox pad: B');
  assert.equal(padText(closeHint('J or Esc', 'pad', 'A / ×'), 'android', 'nintendo'), 'B close', 'a Retroid (B at the bottom): its own B');
  assert.equal(closeHint('J or Esc', 'touch'), '', 'a touch screen: the ✕ says it');
  // the sketchbook, what's new and the worlds picker take theirs when they open; the skip tags too
  assert.doesNotMatch(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), />J to close</);
  // (since October 2026 the way out is a glyph inside the close button itself, for the pad in hand or the keys: src/pad-glyphs.js)
  assert.match(src('game-menu.js'), /\$\{glyph\('back', \{ key: 'Esc' \}\)\}✕/, 'the game menu\'s ✕ carries the back button');
  assert.match(src('changelog.js'), /\$\{glyph\('back', \{ key: 'N' \}\)\}Close/);
  assert.match(src('world-picker.js'), /glyph\('back', \{ key: 'Esc' \}\)/, 'and the worlds list\'s close');
  assert.match(src('story/moment.js'), /`\$\{backKey\(\)\} skip`/, 'a moment\'s skip tag names the button printed B');
  const { holdToSkip } = await import('../src/ship/cinema.js');
  assert.match(holdToSkip('pad'), /^hold (B \/ ○|A \/ ×) to skip$/); assert.equal(holdToSkip('keys'), 'hold ESC to skip');
  // B / ○ closes the Start menu from any page (Quests, Controls), not back to Settings first
  // (with a pad, from inside a page to the sidebar first, issue #210; then closed, whatever page it shows)
  const ui = src('ui.js'), at = ui.indexOf('  back() {'), back = ui.slice(at, ui.indexOf('\n  }', at));
  assert.doesNotMatch(back, /this\.page\('settings'\)/);
  assert.match(back, /\n    this\.toggle\(false\);$/);
  // the controller's back closes the panel on top first: the sketchbook over a conversation or a moment
  const main = src('main.js'), close = main.slice(main.indexOf('const closeControllerMenu'), main.indexOf('const controller = new Controller'));
  assert.ok(close.indexOf('journal.open') < close.indexOf('storyRt.dialogue.open') && close.indexOf('journal.open') < close.indexOf('moments.playing'), 'the sketchbook before what is under it');
});

test('the title, its Saves, its delete question, the Debug menu and the dev menu share the Journal\'s enamel (issue #804)', () => {
  const css = src('menu-enamel.css'), menus = src('menus.css'), boot = src('boot.js');
  // one palette for every menu, at the root: the brass line, the turquoise wash, the enamel
  assert.match(css, /:root \{[^}]*--menu-line:[^}]*--menu-wash:[^}]*--menu-enamel: #161d1d/);
  // the frame (a fine brass line round the enamel) and its brass corner joins, shared, not copied
  const frame = css.slice(0, css.indexOf('box-shadow: 0 0 0 5px var(--menu-enamel)'));
  for (const s of ['#title .saves', '#title .confirm .card', ':is(#journal, #devmenu) .gm', '.fullmenu .pause']) assert.ok(frame.lastIndexOf(s) > frame.lastIndexOf('}'), `${s} in the shared frame`);
  assert.match(css, /#title \.saves::after, #title \.confirm \.card::after, #picker\.open::after \{\s*content: ''/);
  // the headings: the Journal's, the Start menu's, Saves' and the Debug menu's alike
  assert.match(css, /\.fullmenu \.pause-heading, #title \.saves \.head \{/);
  assert.match(css, /\.fullmenu \.pause-heading \.brand, #title \.saves h2, #picker h1 \{/);
  assert.match(src('title.js'), /<div class="head"><span class="menu-emblem" aria-hidden="true">✦<\/span><h2 data-t="title\.savesHead">/);
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /<h1><b class="menu-emblem" aria-hidden="true">✦<\/b>HIRAETH <span>· Debug<\/span><\/h1>/);
  // the entries: the title's buttons and saves, the dev menu's rows and the Debug menu's cards on the one entry rule
  assert.match(css, /\.gm-wardrobe \.line,\.dv-row\),\n#title :is\(\.slot \.pick, \.slot \.del, \.saves \.head button, \.confirm button, \.debug-saves \.dworld, \.debug-saves \.dinto\),\n#picker :is\(\.card, \.row, \.chip/);
  // the dev menu in the Journal's frame: its heading and tab bar as the Journal's, every frame rule shared with it
  const dev = src('dev-menu.js');
  assert.match(dev, /<header class="gm-heading"><span class="menu-emblem" aria-hidden="true">✦<\/span><h1>\$\{DEV_HEADING\}<\/h1>/);
  assert.ok(dev.indexOf('class="gm-tabbar"') < dev.indexOf('<nav class="gm-tabs">') && dev.indexOf('<nav class="gm-tabs">') < dev.indexOf('class="gm-stage"'), 'the tabs between the side buttons, over the sheet');
  assert.doesNotMatch(css, /(^|[\s,])#journal[\s.:[]/m, 'no Journal-only frame rule the dev menu misses');
  // the enamel loads after the menus' own sheets (the Debug menu's too), so it is the one that holds
  assert.ok(boot.indexOf("import './world-picker.css'") < boot.indexOf("import './menu-enamel.css'"));
  // the title's name only: its rules once threw the settings' enamel heading (a header too) over their sidebar
  assert.match(menus, /#title\[data-screen="main"\] \.front > header \{ position: absolute;/);
  assert.doesNotMatch(menus, /#title(\[data-screen="\w+"\])? header \{/);
  // kept: the black wait while the game loads behind the title (#791), reduced motion, the TV's safe insets
  assert.match(menus, /#title\.waiting::after \{ content: ''; position: absolute; inset: 0; z-index: 4; background: #000; \}/);
  assert.match(menus, /html\.reduce-motion #title \.starting \.pen/);
  assert.match(css, /margin: var\(--safe-top, 0px\) var\(--safe-right, 0px\) var\(--safe-bottom, 0px\) var\(--safe-left, 0px\)/);
  assert.match(css, /#picker\.open::before \{[^}]*inset: calc\(6px \+ var\(--safe-top, 0px\)\)/);
});
