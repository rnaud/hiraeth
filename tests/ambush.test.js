// The chime-pirates between worlds (src/ambush.js, docs/systems/minigames.md "Pirates between worlds"): which flights
// are ambushed (the first to a world never visited, not home, not with the setting off), the pages and the flags, the
// runner's ways out on the fight's page, the lines and their tones, and the wiring in the ship and main.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ambushDue, ambushKey, ambushHref, arrivalHref, transitLinks, ambushCount, AMBUSH_LINES, SPEAKERS, NO_AMBUSH, FAILS_BEFORE_SKIP, AMBUSH_GAME } from '../src/ambush.js';
import { resultActions } from '../src/minigames/kit/flow.js';
import { parseLine, TONES } from '../src/story/tone.js';
import { FLY } from '../src/minigames/pirates-rules.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the first flight to a world never visited is ambushed; later ones, home and the Lantern are not', () => {
  const flags = {};
  const flag = (k) => flags[k];
  const seen = new Set(['desert']);
  const due = (to, settings = {}) => ambushDue({ to, flag, seen: (id) => seen.has(id), settings });
  assert.equal(due('incal'), true, 'a new world');
  assert.equal(due('desert'), false, 'a world visited (an old save has its worlds seen: no migration needed)');
  for (const id of NO_AMBUSH) assert.equal(due(id), false, id);
  assert.equal(due('home'), false);
  assert.equal(due('incal', { ambush: false }), false, 'the setting off');
  assert.equal(due('incal', { enemies: 'off' }), false, 'the calm game');
  assert.equal(due('incal', { enemies: 'gentle' }), true, 'gentle still meets them (gentler)');
  assert.equal(due(null), false);
  // once met (the fight's page opened), never again, whatever came of it
  for (const v of ['met', 'won', 'skipped']) { flags[ambushKey('incal')] = v; assert.equal(due('incal'), false, v); }
  assert.equal(ambushKey('edena'), 'ambush.edena');
  assert.equal(ambushCount({ 'ambush.incal': 'won', 'ambush.edena': 'skipped', 'ship.powered': true }), 2);
});

test('the pages: the fight on the way, and the landing after it', () => {
  assert.equal(AMBUSH_GAME, 'pirates');
  assert.equal(ambushHref('incal', 'desert'), '?game=pirates&to=incal&from=desert');
  assert.equal(ambushHref('incal'), '?game=pirates&to=incal');
  assert.equal(arrivalHref('incal'), '?level=incal&via=ship');
});

test('on the fight\'s page: Skip the fight on every card, Fly on once won, Skip first after two failures', () => {
  assert.equal(transitLinks(new URLSearchParams('?game=pirates')), null, 'the game\'s own page (the Debug menu, the Arcade)');
  const L = transitLinks(new URLSearchParams('?game=pirates&to=incal&from=desert'), { incal: 'The City-Shaft' });
  assert.equal(L.to, 'incal');
  assert.deepEqual(L.quit, { label: 'Skip the fight', href: '?level=incal&via=ship', skip: true, mainAfterFails: FAILS_BEFORE_SKIP });
  assert.deepEqual(L.win, { label: 'Fly on to The City-Shaft', href: '?level=incal&via=ship' });
  assert.equal(L.intro.kicker, 'On the way to The City-Shaft');
  assert.equal(L.intro.lead.name, 'The ship');
  assert.match(L.intro.lead.text, /They are after your chimes!/);
  assert.equal(FAILS_BEFORE_SKIP, FLY.skipAfter);
  const acts = (r, fails) => resultActions(r, L, fails).map((b) => `${b.main ? '*' : ''}${b.label}`);
  assert.deepEqual(acts({ failed: false }, 0), ['*Fly on to The City-Shaft', 'Retry']);
  assert.deepEqual(acts({ failed: true }, 1), ['*Retry', 'Skip the fight']);
  assert.deepEqual(acts({ failed: true }, 2), ['*Skip the fight', 'Retry']);
  // a game's own page is as it was: Retry, the host's links, Quit
  assert.deepEqual(resultActions({ failed: true }, null, 5).map((b) => b.act), ['retry', 'quit']);
  assert.deepEqual(resultActions({}, { quit: { label: 'Back to the Arcade' }, extra: [{ id: 'next', label: 'Next game', sub: 'Ski' }] }).map((b) => b.label), ['Retry', 'Next game', 'Back to the Arcade']);
});

test('every line said on the way carries a tone; the ship says the pirates are after the chimes', () => {
  for (const [id, line] of Object.entries(AMBUSH_LINES)) {
    const p = parseLine(line);
    assert.ok(p.explicit && TONES.includes(p.tone), `${id}: a tone`);
    assert.ok(SPEAKERS[line.who], `${id}: a speaker`);
  }
  assert.equal(AMBUSH_LINES.start.who, 'ship');
  assert.match(AMBUSH_LINES.start.text, /They are after your chimes!/);
});

test('the wiring: the ship asks main.js where a take-off goes; the fight\'s page marks the trip; the setting', () => {
  const ship = read('src/ship/ship.js'), main = read('src/main.js'), ui = read('src/ui.js');
  assert.match(ship, /location\.search = this\.departure\?\.\(to\) \?\? `\?level=\$\{to\}&via=ship`/);
  assert.match(main, /departure: \(to\) => \(ambushDue\(\{ to, flag: \(k\) => game\.flag\(k\), seen: \(id\) => journal\.seen\(id\), settings \}\) \? ambushHref\(to, levelId\) : null\)/);
  assert.match(main, /if \(transit && !game\.flag\(ambushKey\(transit\.to\)\)\) game\.set\(ambushKey\(transit\.to\), 'met'\)/);
  assert.match(main, /onResult: \(r\) => \{ if \(transit && !r\.failed\) game\.set\(ambushKey\(transit\.to\), 'won'\); \}/);
  assert.match(ui, /ambush: true,/);
  assert.match(ui, /data-k="ambush" type="checkbox"/);
  for (const lang of ['en', 'fr']) assert.match(read(`src/i18n/${lang}.js`), /'set\.ambush': '/);
});
