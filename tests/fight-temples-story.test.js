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
import { colourById, colourName, coloursData, unlockColours } from '../src/kit-colours.js';
import { PEOPLE as DESERT_PEOPLE } from '../src/temples/desert-data.js';
import { PEOPLE as LORN_PEOPLE } from '../src/temples/perdide-data.js';
import { DRONE_LINES, ONCE } from '../src/companion.js';

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

test('Items names each colour by the house it came from (issue #483: “Ember · the Sunken Hall”)', () => {
  for (const g of GAMES) assert.equal(colourName(colourById(g.table.colours)), `${colourById(g.table.colours).name} · the ${g.table.name.replace(/^The /, '')}`);
  assert.equal(colourName(colourById('makers')), 'Makers’ jade');
  const flags = {}, s = { data: { flags }, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; return v; } };
  unlockColours(s, 'ember');   // (won: worn at once)
  assert.equal(coloursData(s).find((r) => r.piece === 'shield').colour, 'Ember · the Sunken Hall');
});

test('the small hooks: Sabri and Teasel speak of the ink, Plumb names the Blade Gate once (issue #483)', () => {
  assert.ok(DESERT_PEOPLE.sabri.lines.some((l) => /ink comes up/i.test(l) && TONES.includes(parseLine(l).tone)));
  assert.ok(LORN_PEOPLE.teasel.lines.some((l) => /Gert’s mill/.test(l) && TONES.includes(parseLine(l).tone)));
  assert.ok(ONCE.includes('bladegate'), 'Blade Gate warning remains once per save');
  assert.match(DRONE_LINES.bladegate, /blades.*dangerous entrance.*be careful/i, 'The revised warning still identifies the hazard and asks for caution');
});

// Issue #559 (the dialogue review v1.87, finding 1): the twelve were written in one pass and read as one template, eight
// opening on their old trade in one verb form ("I ground…", "I drove…", "I greased…") and closing on "Clear the X and
// I'll Y again", "Nobody at the gear / at the levers" five times. Each has their own voice, reason and last line now.
test('the twelve hosts each in their own voice: no "Clear the … and I’ll", no two last lines alike, no shared opening shape (issue #559)', () => {
  const hosts = GAMES.map((g) => HOSTS[g.table.id]);
  const text = (l) => parseLine(l).text;
  const lastSentence = (l) => text(l).match(/[^.?!]+[.?!]+[’”]?\s*$/)?.[0].trim() ?? text(l);
  const closes = hosts.map((H) => lastSentence(H.say.at(-1)));
  assert.equal(new Set(closes).size, closes.length, `twelve last lines: ${closes.join(' | ')}`);
  const shapes = new Map();
  for (const H of hosts) {
    for (const l of [...H.say, ...H.lines]) {
      assert.doesNotMatch(text(l), /\bClear (it|them|the \w+)( out)? and I/i, `${H.name}: the old closing template: ${l}`);
      assert.doesNotMatch(text(l), /nobody[’']?s? (is )?at the (gear|levers)/i, `${H.name}: "nobody at the …": ${l}`);
    }
    for (const l of H.lines) assert.doesNotMatch(text(l), /^Hear the \w+\? Nobody/, `${H.name}: the twin balloon`);
    // (an opening on the old trade in the past tense, "I ground / I drove / I greased …": one at most)
    const open = /^I \w+ed\b/.test(text(H.say[0])) ? 'I …ed' : text(H.say[0]).split(/\s+/).slice(0, 2).join(' ').toLowerCase();
    shapes.set(open, [...(shapes.get(open) ?? []), H.name]);
  }
  for (const [shape, who] of shapes) assert.ok(who.length <= 1, `${who.join(', ')} open alike (${shape}…)`);
  for (const g of GAMES) assert.doesNotMatch(g.table.blurb, /nobody (at|to)/i, `${g.table.name}'s card: ${g.table.blurb}`);
});

test('the fight cards: sent back into the floor, no seed for players, buttons by the key system (issue #559)', async () => {
  const { readFileSync } = await import('node:fs');
  const { LOCK_ANSWER } = await import('../src/fight-temples/view.js');
  const src = readFileSync(new URL('../src/fight-temples/session.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /[`'"][^`'"]*\b[Ff]oes felled/, 'foes go back into the floor');
  assert.doesNotMatch(src, /This run: \$\{def\.seed\}|\?seed=\$\{/, 'the seed is the developer’s');
  assert.match(src, /Sent back into the floor: \$\{run\.kills\}/);
  assert.match(src, /A roll \(\{key:roll\}\)/, 'the roll’s button the player’s own');
  assert.match(LOCK_ANSWER.line, /\{key:look\}/);
  assert.doesNotMatch(LOCK_ANSWER.line, /right stick|mouse/, 'no buttons in prose');
});
