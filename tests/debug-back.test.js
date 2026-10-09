// Every page the Debug menu opens has its way back (src/debug-back.js): a "◀ Debug" button to the menu (the
// worlds list alone, ?worlds=1) with the back glyph, and B / Esc doing the same while nothing else is open.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEBUG_MENU_HREF, debugBackOptions, cameFromDebug, debugBackHtml, DEBUG_BACK_CSS } from '../src/debug-back.js';
import { PAGES } from '../src/world-picker.js';
import { BUILD_INPUT } from '../vite.config.js';

const html = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
// (the pages built besides the game itself; the worlds list's pages are among them)
const DEBUG_PAGES = [...new Set([...PAGES.map((p) => p.href), ...Object.values(BUILD_INPUT).map((p) => p.split('/').pop()).filter((f) => f !== 'index.html')])];

test('every page the Debug menu opens carries the button back to it', () => {
  assert.ok(DEBUG_PAGES.length >= 7, DEBUG_PAGES.join(', '));
  for (const f of DEBUG_PAGES) {
    const h = html(f);
    assert.match(h, /<script type="module" src="\/src\/debug-back-page\.js"><\/script>/, `${f}: the button's script`);
    assert.match(h, /<body[^>]* data-debug-back(="[^"]*")?[ >]/, `${f}: its options on the body`);
    assert.match(h, /class="debug-room"/, `${f}: its title moved right of the button`);
  }
});

test('the button: to the Debug menu, the back glyph, small at the top left inside the safe area', () => {
  assert.equal(DEBUG_MENU_HREF, './?worlds=1');
  const b = debugBackHtml();
  assert.match(b, /class="debug-back" href="\.\/\?worlds=1"/);
  assert.match(b, /data-glyph="back"/, 'the B (or Esc) glyph, as the pad in hand prints it');
  assert.match(b, /◀<\/span> Debug/);
  assert.match(DEBUG_BACK_CSS, /position: fixed/);
  assert.match(DEBUG_BACK_CSS, /top: calc\(env\(safe-area-inset-top, 0px\) \+ 8px\); left: calc\(env\(safe-area-inset-left, 0px\) \+ 8px\)/);
});

test('options: Esc and B are the page\'s where it already uses them; What\'s new only from the Debug menu', () => {
  assert.deepEqual(debugBackOptions(''), { keys: true, pad: true, fromDebugOnly: false, fade: false });
  assert.deepEqual(debugBackOptions('from-debug keys-off pad-off'), { keys: false, pad: false, fromDebugOnly: true, fade: false });
  assert.equal(debugBackOptions('fade').fade, true);
  const body = (f) => html(f).match(/<body([^>]*)>/)[1];
  assert.match(body('changelog.html'), /data-debug-back="from-debug keys-off pad-off"/, 'its own B / Esc go back already, and players open it too');
  assert.match(body('items.html'), /data-debug-back="pad-off" data-debug-busy="#full\.open"/, 'its B goes back already; Esc closes an item first');
  assert.match(body('trailer.html'), /data-debug-back="fade"/, 'nothing over the film');
});

test('opened from the Debug menu: its list, a debug page, or ?from=debug', () => {
  assert.equal(cameFromDebug('http://x/hiraeth/?worlds=1', ''), true);
  assert.equal(cameFromDebug('http://x/hiraeth/enemies.html', ''), true, 'the Arena from Creatures & spirits');
  assert.equal(cameFromDebug('http://x/hiraeth/', ''), false, 'the title (What\'s new)');
  assert.equal(cameFromDebug('', '?from=debug'), true);
  assert.equal(cameFromDebug('', ''), false);
});

test('a world opened from the Debug menu gets the button too (B and Esc stay the game\'s)', () => {
  const boot = readFileSync(new URL('../src/boot.js', import.meta.url), 'utf8');
  assert.match(boot, /has\('debugsave'\) \|\| cameFromDebug\(document\.referrer, location\.search\)/);
  assert.match(boot, /if \(fromDebugMenu\) installDebugBack\(\{ keys: false, pad: false, fade: true \}\)/);
});
