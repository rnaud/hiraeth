// The fight temples in the story (issue #483; docs/story-bible.md "The spring-houses"): every one has a host by its door
// whose two lines carry a tone and say what the floor does and what they want back, never "the altar is at the end";
// its start card says what the place was and what comes up in it, not how many rooms; its end card's first line is the
// place's own (`quiet`, naming its host), and its title says the house is quiet, not cleared.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { HOSTS } from '../src/story/hosts-data.js';
import { TONES, parseLine } from '../src/story/tone.js';
import { fightTempleGame } from '../src/fight-temples/index.js';

const dir = new URL('../src/minigames/', import.meta.url);
const GAMES = await Promise.all(readdirSync(dir).filter((f) => /^fight-\w+\.js$/.test(f)).map(async (f) => (await import(new URL(f, dir))).default));

test('twelve fight temples, one a main world', () => {
  assert.equal(GAMES.length, 12);
  assert.equal(new Set(GAMES.map((g) => g.table.world)).size, 12);
});

for (const game of GAMES) {
  const D = game.table, H = HOSTS[D.id];
  test(`${D.name}: its host, its start card and its end card speak of the place (issue #483)`, () => {
    assert.ok(H && !H.object, `${D.id}: a person by its door`);
    assert.equal(H.say.length, 2, 'two lines: the place, then the rules in their mouth');
    for (const l of [...H.say, ...H.lines]) {
      const p = parseLine(l);
      assert.ok(p.explicit && TONES.includes(p.tone), `toned: ${l}`);
    }
    for (const l of H.say) assert.doesNotMatch(l, /altar/i, `what they want back, not the makers’ altar: ${l}`);
    assert.doesNotMatch(D.blurb, /\bfour\b|: four/i, `the start card counts no rooms: ${D.blurb}`);
    assert.ok(typeof D.quiet === 'string' && D.quiet.length <= 80, `${D.id}: a short line of the place for its end card`);
    assert.ok(D.quiet.includes(H.name), `the host comes back in: ${D.quiet}`);
    assert.doesNotMatch(D.quiet, /~/, 'a card line, not a spoken one');
  });
}

test('the rules card: foes go back into the floor, nobody is "felled"', () => {
  const { rules } = fightTempleGame(GAMES[0].table);
  assert.match(rules, /back into the floor/);
  assert.doesNotMatch(rules, /felled/);
});
