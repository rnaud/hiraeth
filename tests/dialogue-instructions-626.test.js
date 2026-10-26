// Editorial changes must not alter quest conditions, speaker identity or choices.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PEOPLE as buried } from '../src/temples/buried-data.js';
import { PEOPLE as foundry } from '../src/temples/moonfoundry-data.js';
import { parseLine } from '../src/story/tone.js';

const ledger = JSON.parse(readFileSync(new URL('./fixtures/dialogue-instructions-626.json', import.meta.url)));
const sources = new Map();
for (const path of ["src/temples/buried-data.js", "src/temples/moonfoundry-data.js"]) sources.set(path, readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
assert.deepEqual([...sources.keys()].sort(), ledger.files.map(file => file.path).sort(), 'every ledger input has an explicit source reader');

test('Fisk and Petra edits preserve every other source byte, including gates, effects, pages and choices', () => {
  for (const file of ledger.files) {
    let source = sources.get(file.path);
    for (const { before, after } of file.replacements) {
      assert.equal(source.split(after).length - 1, 1, `one approved replacement in ${file.path}`);
      assert.equal(parseLine(after).tone, parseLine(before).tone, 'speaker tone retained');
      source = source.replace(after, before);
    }
    assert.equal(createHash('sha256').update(source).digest('hex'), file.baseSha256, file.path);
  }
});
test('Fisk explains the complete open-vent volley and retains the optional repeated hint route', () => {
  const { nodes, entry } = buried.brann.talk;
  assert.ok(entry.some(e => e.if?.flag === 'temple.buried.entered' && e.node === 'inside'));
  assert.equal(nodes.inside.choices[0].goto, 'four');
  assert.equal(nodes.four.say.length, 1);
  assert.match(nodes.four.say[0], /all four open vents quickly/);
  assert.match(nodes.four.say[0], /bomb.*several; splash the rest/);
  assert.equal(nodes.go.choices[0].text, '~happy~ All at once. Got it.');
});
test('Petra separates tap control, the cradled-moon opening and the required heart splash', () => {
  const { nodes, entry } = foundry.ilse.talk;
  assert.equal(nodes.go.say.length, 3);
  assert.match(nodes.go.say[2], /molten iron.*Shut a tap.*stop the pour and drain/);
  assert.ok(entry.some(e => e.if?.flag === 'temple.moonfoundry.entered' && e.node === 'inside'));
  assert.equal(nodes.inside.choices[0].goto, 'cradle');
  assert.equal(nodes.cradle.say.length, 2);
  assert.match(nodes.cradle.say[0], /stop and look.*opening/);
  assert.match(nodes.cradle.say[1], /glove.*iron moon.*cradle.*splash its heart when the crucible doors open/);
});
