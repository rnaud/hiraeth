// The chime-pirates between worlds (src/ambush.js, docs/systems/minigames.md "Pirates between worlds"): which flights
// are ambushed (the first to a world never visited, not home, not in the calm game), the pages and the flags, the
// runner's ways out on the fight's page, the lines and their tones, and the wiring in the ship and main.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ambushDue, ambushKey, ambushHref, arrivalHref, transitLinks, ambushCount, AMBUSH_LINES, SPEAKERS, NO_AMBUSH, AMBUSH_GAME } from '../src/ambush.js';
import { resultActions } from '../src/minigames/kit/flow.js';
import { parseLine, TONES } from '../src/story/tone.js';

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
  assert.equal(due('incal', { ambush: false }), true, 'no setting turns them off alone any more (v1.45: no skip)');
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

test('on the fight\'s page: no skip on any card, however often it is lost; Retry from the checkpoint; Fly on once won (issue #88)', () => {
  assert.equal(transitLinks(new URLSearchParams('?game=pirates')), null, 'the game\'s own page (the Debug menu, the Arcade)');
  const L = transitLinks(new URLSearchParams('?game=pirates&to=incal&from=desert'), { incal: 'The City-Shaft' });
  assert.equal(L.to, 'incal');
  assert.equal(L.mandatory, true);
  assert.equal(L.quit, undefined, 'no way out but through it');
  assert.deepEqual(L.win, { label: 'Fly on to The City-Shaft', href: '?level=incal&via=ship' });
  assert.equal(L.intro.kicker, 'On the way to The City-Shaft');
  assert.equal(L.intro.lead.name, 'The ship');
  assert.match(L.intro.lead.text, /They want our hull\./);
  const acts = (r, fails) => resultActions(r, L, fails).map((b) => `${b.main ? '*' : ''}${b.label}`);
  assert.deepEqual(acts({ failed: false }, 0), ['*Fly on to The City-Shaft', 'Retry']);
  for (const fails of [1, 2, 5, 20]) assert.deepEqual(acts({ failed: true }, fails), ['*Retry from the checkpoint'], `${fails} lost`);
  // the runner: no Quit on its cards, Esc backs out of nothing
  const runner = read('src/minigames/kit/runner.js');
  assert.match(runner, /return this\.mandatory \? extra : /);
  assert.match(runner, /quit\(\) \{ if \(!this\.mandatory\)/);
  // a game's own page is as it was: Retry, the host's links, Quit
  assert.deepEqual(resultActions({ failed: true }, null, 5).map((b) => b.act), ['retry', 'quit']);
  assert.deepEqual(resultActions({}, { quit: { label: 'Back to the Arcade' }, extra: [{ id: 'next', label: 'Next game', sub: 'Ski' }] }).map((b) => b.label), ['Retry', 'Next game', 'Back to the Arcade']);
});

test('every line said on the way carries a tone; the pirates come for the hull, and their wrecks pay the chimes a win banks (issue #230)', () => {
  for (const [id, line] of Object.entries(AMBUSH_LINES)) {
    const p = parseLine(line);
    assert.ok(p.explicit && TONES.includes(p.tone), `${id}: a tone`);
    assert.ok(SPEAKERS[line.who], `${id}: a speaker`);
  }
  assert.equal(AMBUSH_LINES.start.who, 'ship');
  assert.match(AMBUSH_LINES.start.text, /They want our hull\./);
  // (a win pays chimes since v1.59: nothing said may have them guarding the chimes aboard)
  for (const [id, line] of Object.entries(AMBUSH_LINES)) assert.doesNotMatch(line.text, /your chimes|chimes are safe|every chime/i, id);
  assert.match(AMBUSH_LINES.won.text, /worth chimes/);
});

test('the wiring: the ship asks main.js where a take-off goes; the fight\'s page marks the trip; the setting', () => {
  const ship = read('src/ship/ship.js'), main = read('src/main.js'), ui = read('src/ui.js'), host = read('src/host/game-host.js');
  assert.match(ship, /location\.search = this\.departure\?\.\(to\) \?\? `\?level=\$\{to\}&via=ship`/);
  // (the one game setup's wireAmbush, both hosts': src/host/game-host.js, issue #435; tests/game-host.test.js plays it)
  assert.match(host, /departure: \(to\) => \(ambushDue\(\{ to, flag: \(k\) => game\.flag\(k\), seen, settings \}\) \? ambushHref\(to, levelId\) : null\)/);
  assert.match(main, /departure: ambush\.departure/);
  assert.match(host, /if \(!game\.flag\(ambushKey\(to\)\)\) game\.set\(ambushKey\(to\), 'met'\)/);
  assert.match(main, /const transit = ambush\.transit\(query\.get\('to'\)\)/);
  // won: marked, and the chimes shot down banked once
  assert.match(host, /if \(r\.chimes && game\.flag\(ambushKey\(to\)\) !== 'won'\) resources\.addChimes\(r\.chimes, \{ source: 'pirates' \}\);/);
  assert.match(main, /onResult: \(r\) => transit\?\.onResult\(r\)/);
  // (the setting that turned the pirates off alone went with the skip, v1.45)
  assert.doesNotMatch(ui, /data-k="ambush"/);
  for (const lang of ['en', 'fr']) assert.doesNotMatch(read(`src/i18n/${lang}.js`), /'set\.ambush': '/);
});
