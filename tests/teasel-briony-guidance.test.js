import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GameState } from '../src/game-state.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { parseLine } from '../src/story/tone.js';
import { PEOPLE as hush } from '../src/temples/perdide-data.js';
import { PEOPLE as lamp } from '../src/temples/perdide2-data.js';

const ledger = JSON.parse(readFileSync(new URL('./fixtures/teasel-briony-guidance-626.json', import.meta.url)));

test('the two repeat hints preserve all other dialogue bytes, including tones, gates and choices', () => {
  for (const file of ledger.files) {
    let source = readFileSync(new URL(`../${file.path}`, import.meta.url), 'utf8');
    for (const { before, after } of file.replacements) {
      assert.equal(source.split(after).length - 1, 1);
      assert.equal(parseLine(after).tone, parseLine(before).tone);
      source = source.replace(after, before);
    }
    assert.equal(createHash('sha256').update(source).digest('hex'), file.baseSha256, file.path);
  }
});

for (const { person, temple, node, item, words, reply } of [
  { person: hush.teasel, temple: 'perdide', node: 'still', item: 'stun', words: [/cold tool/, /jangling crystals above her/, /Once they’re still/], reply: '~neutral~ I’ll find it.' },
  { person: lamp.briony, temple: 'perdide2', node: 'hungry', item: 'bubble', words: [/bubble.*light from a lit pool/, /moth when it hangs low/, /Stand back while it drinks/], reply: '~neutral~ I will.' },
]) {
  test(`${person.name}'s real return conversation teaches the action without giving progress or tools`, () => {
    const values = new Map(), started = [];
    const game = new GameState({ getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) });
    game.set(`met.${person.id}`, true);
    game.set(`temple.${temple}.entered`, true);
    const saved = [...values.entries()];
    const ctx = { game, quests: { start: id => started.push(id) } };
    const talk = new DialogueRunner(person, ctx);
    assert.equal(talk.nodeId, 'inside');
    talk.advance(); talk.choose(0);
    assert.equal(talk.nodeId, node);
    assert.equal(person.talk.nodes[node].say.length, 1);
    for (const pattern of words) assert.match(talk.text, pattern);
    assert.equal(talk.choices().length, 1);
    assert.equal(person.talk.nodes[node].choices[0].text, reply);
    talk.choose(0);
    assert.equal(talk.ended, true);
    assert.deepEqual(started, []);
    assert.equal(!!game.flag(`temple.${temple}.done`), false);
    assert.equal(!!game.flag(`item.${item}`), false);
    assert.deepEqual([...values.entries()], saved, 'asking the repeated hint writes no new saved progress');

    game.set(`temple.${temple}.done`, true);
    assert.equal(new DialogueRunner(person, ctx).nodeId, 'after', 'completed-house greeting keeps priority over the repeat hint');
  });
}
