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
  assert.ok(boot.indexOf("await showTitle()") < boot.indexOf("await import('./main.js')"));
  // the title's Debug entry: the worlds list alone (?worlds=1), without the game (no world built behind it)
  assert.match(src('title.js'), /pathname\}\?worlds=1`/);
  assert.match(boot, /if \(worldsOnly\)[\s\S]*showWorldsOnly\(\)/);
  assert.match(boot, /if \(!worldsOnly\) await import\('\.\/main\.js'\)/);
  assert.doesNotMatch(src('world-picker.js'), /from '\.\/main\.js'|import\('\.\/main\.js'\)/);
  // every world has its picture in the list (scripts/world-thumbs.mjs), and the other pages are linked from it
  for (const l of LEVELS) assert.ok(existsSync(new URL(`../public/thumbs/${l.id}.jpg`, import.meta.url)), `thumbs/${l.id}.jpg`);
  for (const p of PAGES) assert.ok(existsSync(new URL(`../${p.href}`, import.meta.url)), p.href);
  assert.doesNotMatch(src('title.js'), /studio\.html/, 'the studio is in the worlds list, not on the title');
  // and What's new, the interactive changelog (its Play button comes back)
  assert.match(src('title.js'), /data-a="news"/);
  assert.match(src('title.js'), /'changelog\.html'/);
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
  assert.match(main, /const paused = \(\) => menu\.open \|\| journal\.open \|\| changelog\.open;/);
  // frame(): under a menu nothing in the world updates or draws, and the world's clock stops
  assert.match(main, /if \(paused\(\)\) \{ pausedFrame\(\); requestAnimationFrame\(frame\); return; \}\s*simT \+= dt;\s*const t = simT;/);
  assert.match(main, /sound\.menuMusic\(paused\(\)\)/);
  // the Start menu acts on this save only, and can quit to the title
  assert.match(main, /slots\.remove\(slots\.active\)/);
  assert.match(main, /onQuit: \(\) => quitToTitle\(\)/);
  assert.doesNotMatch(main, /localStorage\.removeItem\('moebius\.journal\.v1'\)/);
  const ui = src('ui.js');
  assert.match(ui, /data-a="title">Quit to title</);
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
  assert.match(src('game-menu.js'), /`\$\{keyBadge\(back\)\} close`/, 'the game menu names the back button for closing');
  assert.match(src('game-menu.js'), /`\$\{keyBadge\('Esc'\)\} close`/);
  assert.match(src('changelog.js'), /Close \(\$\{backKey\(\)\}\)/);
  assert.match(src('story/moment.js'), /`\$\{backKey\(\)\} skip`/, 'a moment\'s skip tag names the button printed B');
  const { holdToSkip } = await import('../src/ship/cinema.js');
  assert.match(holdToSkip('pad'), /^hold (B \/ ○|A \/ ×) to skip$/); assert.equal(holdToSkip('keys'), 'hold ESC to skip');
  // B / ○ closes the Start menu from any page (Quests, Controls), not back to Settings first
  const ui = src('ui.js'), at = ui.indexOf('  back() {'), back = ui.slice(at, at + 260);
  assert.doesNotMatch(back, /this\.page\('settings'\)/);
  assert.match(back, /else this\.toggle\(false\)/);
  // the controller's back closes the panel on top first: the sketchbook over a conversation or a moment
  const main = src('main.js'), close = main.slice(main.indexOf('const closeControllerMenu'), main.indexOf('const controller = new Controller'));
  assert.ok(close.indexOf('journal.open') < close.indexOf('storyRt.dialogue.open') && close.indexOf('journal.open') < close.indexOf('moments.playing'), 'the sketchbook before what is under it');
});
