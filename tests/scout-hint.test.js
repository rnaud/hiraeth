// After the first conversation, one line on the scout's button (issue #151, src/scout-hint.js): said once a save,
// where the scout can go somewhere, never again; a ping of your own first counts as learnt; hints off, never.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installScoutHint, scoutHintLine, scoutHintDue, SCOUT_TAUGHT } from '../src/scout-hint.js';
import { setLanguage } from '../src/i18n.js';

/** A save as GameState is: flags, set, on / emit (no storage). */
function fakeGame(flags = {}) {
  const listeners = new Map();
  return {
    flags: { ...flags },
    flag(k) { return this.flags[k]; },
    set(k, v) { this.flags[k] = v; },
    on(e, fn) { (listeners.get(e) ?? listeners.set(e, new Set()).get(e)).add(fn); return () => listeners.get(e).delete(fn); },
    emit(e, p) { for (const fn of listeners.get(e) ?? []) fn(p); },
  };
}
const run = (fn) => fn();   // (later: at once)

test('the scout hint shows once, after the first conversation, and is kept in the save', () => {
  const game = fakeGame(), shown = [];
  installScoutHint({ game, show: (l) => shown.push(l), level: () => 'subtle', later: run });
  assert.equal(shown.length, 0, 'nothing before a conversation');
  game.emit('dialogue:end', { id: 'marrow' });
  assert.equal(shown.length, 1, 'said when the first conversation closes');
  assert.equal(game.flag(SCOUT_TAUGHT), true, 'saved with the game');
  game.emit('dialogue:end', { id: 'hessa' });
  game.emit('dialogue:end', { id: 'marrow' });
  assert.equal(shown.length, 1, 'never again');
  // a page loaded again from the same save: still never again
  const again = [];
  installScoutHint({ game: fakeGame(game.flags), show: (l) => again.push(l), level: () => 'subtle', later: run });
  assert.equal(again.length, 0);
});

test('it waits for a conversation where the scout can go somewhere', () => {
  const game = fakeGame(), shown = [];
  let usable = false;
  installScoutHint({ game, show: (l) => shown.push(l), usable: () => usable, level: () => 'subtle', later: run });
  game.emit('dialogue:end', { id: 'ship' });
  assert.equal(shown.length, 0, 'on the ship, or nothing to find: not yet');
  assert.notEqual(game.flag(SCOUT_TAUGHT), true, 'and not spent');
  usable = true;
  game.emit('dialogue:end', { id: 'marrow' });
  assert.equal(shown.length, 1);
});

test('a ping of your own first, or hints off: never said', () => {
  const g1 = fakeGame(), s1 = [];
  const h = installScoutHint({ game: g1, show: (l) => s1.push(l), level: () => 'subtle', later: run });
  h.pinged();
  g1.emit('dialogue:end', {});
  assert.equal(s1.length, 0, 'you found it alone');
  const g2 = fakeGame(), s2 = [];
  installScoutHint({ game: g2, show: (l) => s2.push(l), level: () => 'off', later: run });
  g2.emit('dialogue:end', {});
  assert.equal(s2.length, 0, 'hints off');
  assert.equal(scoutHintDue(fakeGame(), { level: 'full' }), true);
});

test('the line names the scout\'s button for the hands on the game, in one line', () => {
  setLanguage('en');
  const pad = scoutHintLine('pad'), keys = scoutHintLine('keys'), touch = scoutHintLine('touch');
  assert.match(pad, /^R3\b/, `the pad's: ${pad}`);   // (src/bindings.js PAD_VERBS.lock: R3 with no foe near is the scout)
  assert.match(keys, /^Q\b/, `the keyboard's: ${keys}`);
  assert.match(touch, /^ping\b/, `the touch screen's: ${touch}`);
  for (const l of [pad, keys, touch]) {
    assert.match(l, /next quest/);
    assert.ok(l.length <= 80 && !l.includes('\n'), `one short line: ${l}`);
  }
  setLanguage('fr');
  assert.match(scoutHintLine('pad'), /^R3 montre .*prochaine quête/);
  setLanguage('en');
});

test('main.js says it on the cue and counts Q and R3 as learnt; the drone\'s lines are apart', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /installScoutHint\(\{ game, show: \(\) => \{ scoutTeach\.left = SCOUT_HINT_SHOW; \}/);
  assert.match(main, /teach = scoutHintLine\(\)/, 'on the cue, in the input in hand as it is then');
  assert.equal((main.match(/scoutHint\.pinged\(\); scout\.ping\(\)/g) ?? []).length, 2, 'Q and R3');
  const src = readFileSync(new URL('../src/scout-hint.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from '\.\/drone\.js'/);
});
